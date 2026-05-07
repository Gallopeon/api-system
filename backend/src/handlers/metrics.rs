use std::sync::Arc;
use axum::extract::{Query, State};
use axum::response::IntoResponse;
use axum::{Extension, Json};
use serde_json::json;
use sqlx::Row;

use crate::AppState;
use crate::types::*;
use crate::auth::*;
use crate::engine::*;

const METRICS_BUFFER_KEY: &str = "metrics:buffer";

pub async fn ingest_metrics(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<IngestMetricsRequest>,
) -> Result<impl IntoResponse, AppError> {
    let mut conn = state.redis.get_multiplexed_async_connection().await?;
    let payload_json = serde_json::to_string(&payload)?;
    let _: () = redis::cmd("LPUSH")
        .arg(METRICS_BUFFER_KEY)
        .arg(payload_json)
        .query_async(&mut conn)
        .await?;
    Ok(Json(json!({"ingested": true})))
}

pub async fn get_analytics(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Query(query): Query<AnalyticsQuery>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::MetricsRead)?;
    let hours = query.hours.unwrap_or(24);

    // Try cache first
    if let Ok(Some(cached)) = get_cached_analytics(&state.redis, hours).await {
        return Ok(Json(cached));
    }

    let (agg_row, hourly_rows, status_rows) = tokio::try_join!(
        sqlx::query(
            "SELECT COUNT(*) as total, COALESCE(AVG(latency_ms), 0) as avg_latency, \
             COALESCE(SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) * 1.0 / NULLIF(COUNT(*), 0), 0) as error_rate \
             FROM metrics_ingest WHERE timestamp >= (NOW() - INTERVAL ? HOUR)"
        ).bind(hours).fetch_one(&state.pool),
        sqlx::query(
            "SELECT HOUR(timestamp) as hour, COUNT(*) as count, COALESCE(AVG(latency_ms), 0) as avg_latency \
             FROM metrics_ingest WHERE timestamp >= (NOW() - INTERVAL ? HOUR) \
             GROUP BY HOUR(timestamp) ORDER BY hour"
        ).bind(hours).fetch_all(&state.pool),
        sqlx::query(
            "SELECT status_code, COUNT(*) as count \
             FROM metrics_ingest WHERE timestamp >= (NOW() - INTERVAL ? HOUR) \
             GROUP BY status_code ORDER BY count DESC"
        ).bind(hours).fetch_all(&state.pool),
    ).map_err(|e: sqlx::Error| AppError::Internal(format!("analytics query failed: {}", e)))?;

    let total: i64 = agg_row.try_get("total").unwrap_or(0);
    let avg_latency: f64 = agg_row.try_get("avg_latency").unwrap_or(0.0);
    let error_rate: f64 = agg_row.try_get("error_rate").unwrap_or(0.0);

    let (p95, p99) = if total > 0 {
        let (p95_offset, p99_offset) = compute_p95_p99_offsets(total);
        let (p95_res, p99_res) = tokio::try_join!(
            sqlx::query_scalar::<_, i32>(
                "SELECT latency_ms FROM metrics_ingest \
                 WHERE timestamp >= (NOW() - INTERVAL ? HOUR) \
                 ORDER BY latency_ms LIMIT 1 OFFSET ?"
            ).bind(hours).bind(p95_offset).fetch_optional(&state.pool),
            sqlx::query_scalar::<_, i32>(
                "SELECT latency_ms FROM metrics_ingest \
                 WHERE timestamp >= (NOW() - INTERVAL ? HOUR) \
                 ORDER BY latency_ms LIMIT 1 OFFSET ?"
            ).bind(hours).bind(p99_offset).fetch_optional(&state.pool),
        ).map_err(|e: sqlx::Error| AppError::Internal(format!("percentile query failed: {}", e)))?;

        (p95_res.unwrap_or(0) as i64, p99_res.unwrap_or(0) as i64)
    } else {
        (0, 0)
    };

    let requests_by_hour: Vec<HourlyBucket> = hourly_rows.iter().map(|r| HourlyBucket {
        hour: format!("{:02}:00", r.try_get::<u8, _>("hour").unwrap_or(0)),
        count: r.try_get("count").unwrap_or(0),
        avg_latency: r.try_get("avg_latency").unwrap_or(0.0),
    }).collect();

    let status_distribution: Vec<StatusBucket> = status_rows.iter().map(|r| StatusBucket {
        status_code: r.try_get("status_code").unwrap_or(0),
        count: r.try_get("count").unwrap_or(0),
    }).collect();

    let response = AnalyticsResponse {
        total_requests: total,
        avg_latency_ms: avg_latency,
        p95_latency_ms: p95,
        p99_latency_ms: p99,
        error_rate,
        requests_by_hour,
        top_apis: vec![],
        status_distribution,
    };

    // Write to cache (best-effort)
    let _ = cache_analytics(&state.redis, hours, &response).await;

    Ok(Json(response))
}

pub async fn get_top_apis(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Query(query): Query<AnalyticsQuery>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::MetricsRead)?;
    let hours = query.hours.unwrap_or(24);
    let rows = sqlx::query(
        "SELECT api_path, COUNT(*) as count, COALESCE(AVG(latency_ms), 0) as avg_latency FROM metrics_ingest WHERE timestamp >= (NOW() - INTERVAL ? HOUR) GROUP BY api_path ORDER BY count DESC LIMIT 10"
    ).bind(hours).fetch_all(&state.pool).await?;
    let items: Vec<TopApiItem> = rows.iter().map(|r| TopApiItem {
        api_path: r.try_get("api_path").unwrap_or_default(),
        count: r.try_get::<i64, _>("count").unwrap_or(0),
        avg_latency: r.try_get::<f64, _>("avg_latency").unwrap_or(0.0),
    }).collect();
    Ok(Json(TopApisResponse { items, hours }))
}

pub async fn get_api_key_stats(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Query(query): Query<AnalyticsQuery>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::MetricsRead)?;
    let hours = query.hours.unwrap_or(24);
    let rows = sqlx::query(
        "SELECT m.api_key_id, COALESCE(k.name, 'unknown') as key_name, COUNT(*) as total_calls, COALESCE(AVG(m.latency_ms), 0) as avg_latency, SUM(CASE WHEN m.status_code >= 400 THEN 1 ELSE 0 END) as error_count FROM metrics_ingest m LEFT JOIN api_keys k ON m.api_key_id = k.id WHERE m.timestamp >= (NOW() - INTERVAL ? HOUR) GROUP BY m.api_key_id, k.name ORDER BY total_calls DESC"
    ).bind(hours).fetch_all(&state.pool).await?;
    let items: Vec<ApiKeyStatsItem> = rows.iter().map(|r| ApiKeyStatsItem {
        key_id: r.try_get("api_key_id").unwrap_or_default(),
        key_name: r.try_get("key_name").unwrap_or_default(),
        total_calls: r.try_get::<i64, _>("total_calls").unwrap_or(0),
        avg_latency: r.try_get::<f64, _>("avg_latency").unwrap_or(0.0),
        error_count: r.try_get::<i64, _>("error_count").unwrap_or(0),
    }).collect();
    Ok(Json(ApiKeyStatsResponse { items, hours }))
}

pub async fn get_metrics_overview(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::MetricsRead)?;

    let (total_rules, total_versions, total_audit_events, audit_24h) = tokio::try_join!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM rule_configs").fetch_one(&state.pool),
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM rule_versions").fetch_one(&state.pool),
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM audit_logs").fetch_one(&state.pool),
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM audit_logs WHERE created_at >= (NOW() - INTERVAL 1 DAY)").fetch_one(&state.pool),
    ).map_err(|e: sqlx::Error| AppError::Internal(format!("overview query failed: {}", e)))?;

    Ok(Json(MetricsOverview {
        uptime_seconds: state.started_at.elapsed().as_secs(),
        total_rules,
        total_versions,
        total_audit_events,
        audit_events_24h: audit_24h,
        preview_success_24h: 0,
        top_actions_24h: vec![],
    }))
}

pub async fn get_dashboard(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Query(query): Query<AnalyticsQuery>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::MetricsRead)?;
    let hours = query.hours.unwrap_or(24);

    let (analytics, top_apis, api_key_stats) = tokio::try_join!(
        analytics_inner(&state, hours),
        top_apis_inner(&state, hours),
        api_key_stats_inner(&state, hours),
    ).map_err(|e: AppError| e)?;

    Ok(Json(DashboardResponse {
        analytics,
        top_apis,
        api_key_stats,
    }))
}

async fn analytics_inner(
    state: &AppState,
    hours: u32,
) -> Result<AnalyticsResponse, AppError> {
    let (agg_row, hourly_rows, status_rows) = tokio::try_join!(
        sqlx::query(
            "SELECT COUNT(*) as total, COALESCE(AVG(latency_ms), 0) as avg_latency, \
             COALESCE(SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) * 1.0 / NULLIF(COUNT(*), 0), 0) as error_rate \
             FROM metrics_ingest WHERE timestamp >= (NOW() - INTERVAL ? HOUR)"
        ).bind(hours).fetch_one(&state.pool),
        sqlx::query(
            "SELECT HOUR(timestamp) as hour, COUNT(*) as count, COALESCE(AVG(latency_ms), 0) as avg_latency \
             FROM metrics_ingest WHERE timestamp >= (NOW() - INTERVAL ? HOUR) \
             GROUP BY HOUR(timestamp) ORDER BY hour"
        ).bind(hours).fetch_all(&state.pool),
        sqlx::query(
            "SELECT status_code, COUNT(*) as count \
             FROM metrics_ingest WHERE timestamp >= (NOW() - INTERVAL ? HOUR) \
             GROUP BY status_code ORDER BY count DESC"
        ).bind(hours).fetch_all(&state.pool),
    ).map_err(|e: sqlx::Error| AppError::Internal(format!("analytics query failed: {}", e)))?;

    let total: i64 = agg_row.try_get("total").unwrap_or(0);
    let avg_latency: f64 = agg_row.try_get("avg_latency").unwrap_or(0.0);
    let error_rate: f64 = agg_row.try_get("error_rate").unwrap_or(0.0);

    let (p95, p99) = if total > 0 {
        let (p95_offset, p99_offset) = compute_p95_p99_offsets(total);
        let (p95_res, p99_res) = tokio::try_join!(
            sqlx::query_scalar::<_, i32>(
                "SELECT latency_ms FROM metrics_ingest \
                 WHERE timestamp >= (NOW() - INTERVAL ? HOUR) \
                 ORDER BY latency_ms LIMIT 1 OFFSET ?"
            ).bind(hours).bind(p95_offset).fetch_optional(&state.pool),
            sqlx::query_scalar::<_, i32>(
                "SELECT latency_ms FROM metrics_ingest \
                 WHERE timestamp >= (NOW() - INTERVAL ? HOUR) \
                 ORDER BY latency_ms LIMIT 1 OFFSET ?"
            ).bind(hours).bind(p99_offset).fetch_optional(&state.pool),
        ).map_err(|e: sqlx::Error| AppError::Internal(format!("percentile query failed: {}", e)))?;

        (p95_res.unwrap_or(0) as i64, p99_res.unwrap_or(0) as i64)
    } else {
        (0, 0)
    };

    let requests_by_hour: Vec<HourlyBucket> = hourly_rows.iter().map(|r| HourlyBucket {
        hour: format!("{:02}:00", r.try_get::<u8, _>("hour").unwrap_or(0)),
        count: r.try_get("count").unwrap_or(0),
        avg_latency: r.try_get("avg_latency").unwrap_or(0.0),
    }).collect();

    let status_distribution: Vec<StatusBucket> = status_rows.iter().map(|r| StatusBucket {
        status_code: r.try_get("status_code").unwrap_or(0),
        count: r.try_get("count").unwrap_or(0),
    }).collect();

    Ok(AnalyticsResponse {
        total_requests: total,
        avg_latency_ms: avg_latency,
        p95_latency_ms: p95,
        p99_latency_ms: p99,
        error_rate,
        requests_by_hour,
        top_apis: vec![],
        status_distribution,
    })
}

async fn top_apis_inner(
    state: &AppState,
    hours: u32,
) -> Result<TopApisResponse, AppError> {
    let rows = sqlx::query(
        "SELECT api_path, COUNT(*) as count, COALESCE(AVG(latency_ms), 0) as avg_latency \
         FROM metrics_ingest WHERE timestamp >= (NOW() - INTERVAL ? HOUR) \
         GROUP BY api_path ORDER BY count DESC LIMIT 10"
    ).bind(hours).fetch_all(&state.pool).await?;
    let items: Vec<TopApiItem> = rows.iter().map(|r| TopApiItem {
        api_path: r.try_get("api_path").unwrap_or_default(),
        count: r.try_get::<i64, _>("count").unwrap_or(0),
        avg_latency: r.try_get::<f64, _>("avg_latency").unwrap_or(0.0),
    }).collect();
    Ok(TopApisResponse { items, hours })
}

async fn api_key_stats_inner(
    state: &AppState,
    hours: u32,
) -> Result<ApiKeyStatsResponse, AppError> {
    let rows = sqlx::query(
        "SELECT m.api_key_id, COALESCE(k.name, 'unknown') as key_name, COUNT(*) as total_calls, \
         COALESCE(AVG(m.latency_ms), 0) as avg_latency, \
         SUM(CASE WHEN m.status_code >= 400 THEN 1 ELSE 0 END) as error_count \
         FROM metrics_ingest m LEFT JOIN api_keys k ON m.api_key_id = k.id \
         WHERE m.timestamp >= (NOW() - INTERVAL ? HOUR) \
         GROUP BY m.api_key_id, k.name ORDER BY total_calls DESC"
    ).bind(hours).fetch_all(&state.pool).await?;
    let items: Vec<ApiKeyStatsItem> = rows.iter().map(|r| ApiKeyStatsItem {
        key_id: r.try_get("api_key_id").unwrap_or_default(),
        key_name: r.try_get("key_name").unwrap_or_default(),
        total_calls: r.try_get::<i64, _>("total_calls").unwrap_or(0),
        avg_latency: r.try_get::<f64, _>("avg_latency").unwrap_or(0.0),
        error_count: r.try_get::<i64, _>("error_count").unwrap_or(0),
    }).collect();
    Ok(ApiKeyStatsResponse { items, hours })
}
