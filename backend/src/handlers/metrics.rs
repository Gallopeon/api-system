use std::sync::Arc;
use axum::extract::{Query, State};
use axum::response::IntoResponse;
use axum::{Extension, Json};
use serde_json::json;
use sqlx::Row;

use crate::AppState;
use crate::types::*;
use crate::auth::*;

pub async fn ingest_metrics(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<IngestMetricsRequest>,
) -> Result<impl IntoResponse, AppError> {
    sqlx::query(
        "INSERT INTO metrics_ingest (api_path, method, status_code, latency_ms, client_ip, api_key_id, timestamp) VALUES (?, ?, ?, ?, ?, ?, NOW())"
    ).bind(&payload.api_path).bind(&payload.method).bind(payload.status_code as i32)
     .bind(payload.latency_ms as i32).bind(&payload.client_ip).bind(&payload.api_key_id)
     .execute(&state.pool).await?;
    Ok(Json(json!({"ingested": true})))
}

pub async fn get_analytics(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Query(query): Query<AnalyticsQuery>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::MetricsRead)?;
    let hours = query.hours.unwrap_or(24);
    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM metrics_ingest WHERE timestamp >= (NOW() - INTERVAL ? HOUR)"
    ).bind(hours).fetch_one(&state.pool).await?;
    let avg_latency: f64 = sqlx::query_scalar(
        "SELECT COALESCE(AVG(latency_ms), 0) FROM metrics_ingest WHERE timestamp >= (NOW() - INTERVAL ? HOUR)"
    ).bind(hours).fetch_one(&state.pool).await?;
    let error_rate: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) * 1.0 / NULLIF(COUNT(*), 0), 0) FROM metrics_ingest WHERE timestamp >= (NOW() - INTERVAL ? HOUR)"
    ).bind(hours).fetch_one(&state.pool).await?;
    Ok(Json(AnalyticsResponse {
        total_requests: total,
        avg_latency_ms: avg_latency,
        p95_latency_ms: 0,
        p99_latency_ms: 0,
        error_rate,
        requests_by_hour: vec![],
        top_apis: vec![],
        status_distribution: vec![],
    }))
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
    let total_rules: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM rule_configs").fetch_one(&state.pool).await?;
    let total_versions: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM rule_versions").fetch_one(&state.pool).await?;
    let total_audit_events: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM audit_logs").fetch_one(&state.pool).await?;
    let audit_24h: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM audit_logs WHERE created_at >= (NOW() - INTERVAL 1 DAY)").fetch_one(&state.pool).await?;
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
