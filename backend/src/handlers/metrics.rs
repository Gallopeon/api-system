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

    let response = analytics_inner(&state, hours).await?;

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
    // Single merged query using pre-aggregated summary table + current hour raw data.
    // Replaces 3 separate parallel queries (agg, hourly, status) with one round-trip.
    let rows = sqlx::query(
        "SELECT \
           HOUR(hour_bucket) as hour, \
           SUM(request_count) as scnt, \
           SUM(request_count * avg_latency_ms) as weighted_lat, \
           status_code, \
           SUM(error_count) as errs \
         FROM metrics_hourly_summary \
         WHERE hour_bucket >= DATE_FORMAT(NOW() - INTERVAL ? HOUR, '%Y-%m-%d %H:00:00') \
           AND hour_bucket < DATE_FORMAT(NOW(), '%Y-%m-%d %H:00:00') \
         GROUP BY hour_bucket, status_code \
         UNION ALL \
         SELECT \
           HOUR(timestamp) as hour, \
           COUNT(*) as scnt, \
           SUM(latency_ms) as weighted_lat, \
           status_code, \
           SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as errs \
         FROM metrics_ingest \
         WHERE timestamp >= DATE_FORMAT(NOW(), '%Y-%m-%d %H:00:00') \
         GROUP BY DATE_FORMAT(timestamp, '%Y-%m-%d %H'), status_code \
         ORDER BY hour, scnt DESC"
    ).bind(hours).fetch_all(&state.pool).await
    .map_err(|e: sqlx::Error| AppError::Internal(format!("analytics query failed: {}", e)))?;

    // Compute aggregates, hourly breakdown, and status distribution in Rust
    let mut total = 0i64;
    let mut weighted_lat_sum = 0f64;
    let mut total_errs = 0i64;
    let mut hourly_map: std::collections::BTreeMap<String, (i64, f64)> = std::collections::BTreeMap::new();
    let mut status_map: std::collections::BTreeMap<i32, i64> = std::collections::BTreeMap::new();

    for row in &rows {
        let wlat: f64 = row.try_get("weighted_lat").unwrap_or(0.0);
        let sc: i32 = row.try_get("status_code").unwrap_or(0);
        let scnt: i64 = row.try_get("scnt").unwrap_or(0);
        let errs: i64 = row.try_get("errs").unwrap_or(0);
        let hour: u8 = row.try_get("hour").unwrap_or(0);

        total += scnt;
        weighted_lat_sum += wlat;
        total_errs += errs;

        let hkey = format!("{:02}:00", hour);
        let entry = hourly_map.entry(hkey).or_default();
        entry.0 += scnt;
        entry.1 += wlat;

        *status_map.entry(sc).or_default() += scnt;
    }

    let avg_latency = if total > 0 { weighted_lat_sum / total as f64 } else { 0.0 };
    let error_rate = if total > 0 { total_errs as f64 / total as f64 } else { 0.0 };

    let requests_by_hour: Vec<HourlyBucket> = hourly_map.into_iter().map(|(hour, (count, wlat))| HourlyBucket {
        count,
        avg_latency: if count > 0 { wlat / count as f64 } else { 0.0 },
        hour,
    }).collect();

    let status_distribution: Vec<StatusBucket> = status_map.into_iter().map(|(code, count)| StatusBucket {
        status_code: code,
        count,
    }).collect();

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
