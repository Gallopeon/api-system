use redis::AsyncCommands;
use crate::auth::AppError;
use crate::types::*;

const METRICS_BUFFER_KEY: &str = "metrics:buffer";
const METRICS_FLUSH_BATCH: usize = 1000;
const METRICS_FLUSH_INTERVAL_SECS: u64 = 30;
const METRICS_AGGREGATE_INTERVAL_SECS: u64 = 300; // 5 minutes
const ANALYTICS_CACHE_KEY: &str = "analytics:agg";
const ANALYTICS_CACHE_TTL: u64 = 300;

pub async fn run_metrics_flusher(pool: sqlx::MySqlPool, redis: redis::Client, mut shutdown: tokio::sync::watch::Receiver<bool>) {
    let mut interval = tokio::time::interval(std::time::Duration::from_secs(METRICS_FLUSH_INTERVAL_SECS));
    loop {
        tokio::select! {
            _ = interval.tick() => {
                if let Err(e) = flush_metrics_buffer(&pool, &redis).await {
                    tracing::warn!(error = %e, "metrics flush failed");
                }
            }
            _ = shutdown.changed() => {
                tracing::info!("metrics flusher shutting down, final flush...");
                if let Err(e) = flush_metrics_buffer(&pool, &redis).await {
                    tracing::warn!(error = %e, "final metrics flush failed");
                }
                break;
            }
        }
    }
}

async fn flush_metrics_buffer(pool: &sqlx::MySqlPool, redis: &redis::Client) -> Result<(), AppError> {
    let mut conn = redis.get_multiplexed_async_connection().await?;
    let items: Vec<String> = redis::cmd("LRANGE")
        .arg(METRICS_BUFFER_KEY)
        .arg(0)
        .arg(METRICS_FLUSH_BATCH as i64 - 1)
        .query_async(&mut conn)
        .await?;

    if items.is_empty() {
        return Ok(());
    }

    let mut batch = Vec::with_capacity(items.len());
    for item in &items {
        if let Ok(req) = serde_json::from_str::<IngestMetricsRequest>(item) {
            batch.push(req);
        }
    }

    if !batch.is_empty() {
        let mut query_str = String::from(
            "INSERT INTO metrics_ingest (api_path, method, status_code, latency_ms, client_ip, api_key_id, timestamp) VALUES "
        );
        let mut first = true;
        for _ in &batch {
            if !first { query_str.push_str(", "); }
            query_str.push_str("(?, ?, ?, ?, ?, ?, NOW())");
            first = false;
        }

        let mut q = sqlx::query(&query_str);
        for req in &batch {
            q = q.bind(&req.api_path)
                .bind(&req.method)
                .bind(req.status_code)
                .bind(req.latency_ms)
                .bind(&req.client_ip)
                .bind(&req.api_key_id);
        }

        q.execute(pool).await?;
        tracing::info!(count = batch.len(), "metrics batch inserted");
    }

    // Safely remove processed items only AFTER successful database insertion
    let _: () = redis::cmd("LTRIM")
        .arg(METRICS_BUFFER_KEY)
        .arg(items.len() as i64)
        .arg(-1)
        .query_async(&mut conn)
        .await?;

    Ok(())
}

pub async fn run_metrics_aggregator(pool: sqlx::MySqlPool, mut shutdown: tokio::sync::watch::Receiver<bool>) {
    let mut interval = tokio::time::interval(std::time::Duration::from_secs(METRICS_AGGREGATE_INTERVAL_SECS));
    loop {
        tokio::select! {
            _ = interval.tick() => {
                if let Err(e) = aggregate_metrics_hourly(&pool).await {
                    tracing::warn!(error = %e, "metrics hourly aggregation failed");
                }
            }
            _ = shutdown.changed() => {
                tracing::info!("metrics aggregator shutting down, final aggregation...");
                if let Err(e) = aggregate_metrics_hourly(&pool).await {
                    tracing::warn!(error = %e, "final metrics aggregation failed");
                }
                break;
            }
        }
    }
}

async fn aggregate_metrics_hourly(pool: &sqlx::MySqlPool) -> Result<(), AppError> {
    // Aggregate the previous full hour's raw metrics into the summary table.
    // Current hour is skipped because it is still accumulating data.
    sqlx::query(
        r#"INSERT INTO metrics_hourly_summary
           (hour_bucket, api_path, method, status_code, request_count, avg_latency_ms, p95_latency_ms, p99_latency_ms, error_count)
           SELECT
             DATE_FORMAT(timestamp, '%Y-%m-%d %H:00:00') as hour_bucket,
             api_path,
             method,
             status_code,
             COUNT(*) as request_count,
             COALESCE(AVG(latency_ms), 0) as avg_latency_ms,
             0 as p95_latency_ms,
             0 as p99_latency_ms,
             SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as error_count
           FROM metrics_ingest
           WHERE timestamp >= DATE_FORMAT(NOW() - INTERVAL 1 HOUR, '%Y-%m-%d %H:00:00')
             AND timestamp < DATE_FORMAT(NOW(), '%Y-%m-%d %H:00:00')
           GROUP BY DATE_FORMAT(timestamp, '%Y-%m-%d %H:00:00'), api_path, method, status_code
           ON DUPLICATE KEY UPDATE
             request_count = VALUES(request_count),
             avg_latency_ms = VALUES(avg_latency_ms),
             error_count = VALUES(error_count)"#,
    )
    .execute(pool)
    .await?;

    tracing::info!("metrics hourly aggregation completed");
    Ok(())
}

pub async fn get_cached_analytics(redis: &redis::Client, hours: u32) -> Result<Option<AnalyticsResponse>, AppError> {
    let mut conn = redis.get_multiplexed_async_connection().await?;
    let key = format!("{}:{}", ANALYTICS_CACHE_KEY, hours);
    let raw: Option<String> = conn.get(&key).await?;
    match raw {
        Some(payload) => Ok(Some(serde_json::from_str(&payload)?)),
        None => Ok(None),
    }
}

pub async fn cache_analytics(redis: &redis::Client, hours: u32, data: &AnalyticsResponse) -> Result<(), AppError> {
    let mut conn = redis.get_multiplexed_async_connection().await?;
    let key = format!("{}:{}", ANALYTICS_CACHE_KEY, hours);
    let payload = serde_json::to_string(data)?;
    let _: () = conn.set_ex(&key, payload, ANALYTICS_CACHE_TTL).await?;
    Ok(())
}

const RETENTION_DAYS: u32 = 30;
const RETENTION_BATCH_SIZE: u64 = 5000;
const RETENTION_INTERVAL_HOURS: u64 = 6;

/// Background task that periodically deletes old metrics rows to prevent
/// unbounded table growth. Runs every 6 hours, removes data older than 30 days
/// in batches to avoid long table locks.
pub async fn run_metrics_retention(pool: sqlx::MySqlPool, mut shutdown: tokio::sync::watch::Receiver<bool>) {
    let mut interval = tokio::time::interval(std::time::Duration::from_secs(RETENTION_INTERVAL_HOURS * 3600));
    loop {
        tokio::select! {
            _ = interval.tick() => {
                if let Err(e) = purge_old_metrics(&pool).await {
                    tracing::warn!(error = %e, "metrics retention purge failed");
                }
            }
            _ = shutdown.changed() => {
                tracing::info!("metrics retention shutting down");
                break;
            }
        }
    }
}

async fn purge_old_metrics(pool: &sqlx::MySqlPool) -> Result<(), AppError> {
    let mut total_deleted = 0u64;
    loop {
        let result = sqlx::query(
            "DELETE FROM metrics_ingest WHERE timestamp < (NOW() - INTERVAL ? DAY) LIMIT ?"
        ).bind(RETENTION_DAYS).bind(RETENTION_BATCH_SIZE).execute(pool).await?;

        let affected = result.rows_affected();
        if affected == 0 {
            break;
        }
        total_deleted += affected;
        // Brief pause between batches to let other queries breathe
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }
    if total_deleted > 0 {
        tracing::info!(deleted = total_deleted, retention_days = RETENTION_DAYS, "metrics retention purge completed");
    }
    Ok(())
}
