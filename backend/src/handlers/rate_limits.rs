use std::sync::Arc;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::{Extension, Json};
use chrono::{DateTime, Utc};
use redis::AsyncCommands;
use serde_json::json;
use sqlx::Row;
use tracing::warn;
use uuid::Uuid;

use crate::AppState;
use crate::types::*;
use crate::auth::*;
use super::common::*;

pub async fn create_rate_limit(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Json(payload): Json<CreateRateLimitRequest>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RateLimitWrite)?;
    let id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO rate_limit_configs (id, name, api_path, window_seconds, max_requests, burst_size, quota_daily, quota_monthly, per_api_key, per_ip, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(&id).bind(&payload.name).bind(&payload.api_path)
     .bind(payload.window_seconds).bind(payload.max_requests).bind(payload.burst_size)
     .bind(payload.quota_daily.unwrap_or(0)).bind(payload.quota_monthly.unwrap_or(0))
     .bind(payload.per_api_key).bind(payload.per_ip).bind("active")
     .execute(&state.pool).await?;
    Ok((StatusCode::CREATED, Json(json!({"id": id, "created": true}))))
}

pub async fn get_rate_limit(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RateLimitRead)?;
    Ok(Json(get_rate_limit_by_id(&state.pool, &id).await?))
}

pub async fn list_rate_limits(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Query(query): Query<ListRateLimitsQuery>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RateLimitRead)?;
    let limit = query.limit.unwrap_or(20).clamp(1, 100);
    let offset = query.offset.unwrap_or(0);
    let rows = sqlx::query(
        "SELECT id, name, api_path, window_seconds, max_requests, burst_size, quota_daily, quota_monthly, per_api_key, per_ip, status, created_at, updated_at FROM rate_limit_configs ORDER BY created_at DESC LIMIT ? OFFSET ?"
    ).bind(limit).bind(offset).fetch_all(&state.pool).await?;
    let items: Vec<RateLimitResponse> = rows.iter().map(|r| {
        let created_at: DateTime<Utc> = r.try_get("created_at").unwrap_or(DateTime::UNIX_EPOCH);
        let updated_at: DateTime<Utc> = r.try_get("updated_at").unwrap_or(DateTime::UNIX_EPOCH);
        RateLimitResponse {
            id: r.try_get("id").unwrap_or_default(),
            name: r.try_get("name").unwrap_or_default(),
            api_path: r.try_get("api_path").unwrap_or_default(),
            window_seconds: r.try_get("window_seconds").unwrap_or(0),
            max_requests: r.try_get("max_requests").unwrap_or(0),
            burst_size: r.try_get("burst_size").unwrap_or(0),
            quota_daily: r.try_get("quota_daily").ok(),
            quota_monthly: r.try_get("quota_monthly").ok(),
            per_api_key: r.try_get::<i8, _>("per_api_key").unwrap_or(0) == 1,
            per_ip: r.try_get::<i8, _>("per_ip").unwrap_or(0) == 1,
            status: r.try_get("status").unwrap_or_default(),
            created_at: created_at.to_rfc3339(),
            updated_at: updated_at.to_rfc3339(),
        }
    }).collect();
    Ok(Json(RateLimitListResponse { items, limit, offset }))
}

pub async fn update_rate_limit(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateRateLimitRequest>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RateLimitWrite)?;
    if let Some(ref status) = payload.status {
        sqlx::query("UPDATE rate_limit_configs SET status = ? WHERE id = ?").bind(status).bind(&id).execute(&state.pool).await?;
    }
    Ok(Json(get_rate_limit_by_id(&state.pool, &id).await?))
}

pub async fn delete_rate_limit(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RateLimitWrite)?;
    sqlx::query("DELETE FROM rate_limit_configs WHERE id = ?").bind(&id).execute(&state.pool).await?;
    Ok(Json(json!({"deleted": true})))
}

pub async fn check_rate_limit(
    State(state): State<Arc<AppState>>,
    Extension(_auth): Extension<AuthContext>,
    Json(payload): Json<RateLimitCheckRequest>,
) -> Result<impl IntoResponse, AppError> {
    let row = sqlx::query(
        "SELECT window_seconds, max_requests, burst_size, quota_daily, quota_monthly FROM rate_limit_configs WHERE api_path = ? AND status = 'active'"
    ).bind(&payload.api_path).fetch_optional(&state.pool).await?;

    let (window, max_req, burst, quota_daily, quota_monthly) = match row {
        Some(r) => (
            r.try_get::<i32, _>("window_seconds").unwrap_or(60),
            r.try_get::<i32, _>("max_requests").unwrap_or(100),
            r.try_get::<i32, _>("burst_size").unwrap_or(50),
            r.try_get::<Option<i32>, _>("quota_daily").ok().flatten(),
            r.try_get::<Option<i32>, _>("quota_monthly").ok().flatten(),
        ),
        None => {
            return Ok(Json(RateLimitCheckResponse {
                allowed: true, limit: 0, remaining: 0, reset_seconds: 0,
                quota_daily_remaining: None, quota_monthly_remaining: None,
                reason: Some("no rate limit configured".to_string()),
            }));
        }
    };

    let now = Utc::now().timestamp();
    let window_key = format!("rl:{}:{}", payload.api_path, payload.api_key.as_deref().unwrap_or("anon"));
    let reset_seconds = window as i64 - (now % window as i64);

    let mut conn = match state.redis.get_async_connection().await {
        Ok(c) => c,
        Err(e) => {
            warn!(error = %e, "redis unavailable for rate limit check, allowing request");
            return Ok(Json(RateLimitCheckResponse {
                allowed: true, limit: max_req, remaining: max_req, reset_seconds,
                quota_daily_remaining: quota_daily, quota_monthly_remaining: quota_monthly,
                reason: Some("rate limit store unavailable, request allowed".to_string()),
            }));
        }
    };

    let current: i32 = conn.get(&window_key).await.unwrap_or(0);
    let limit = max_req + burst;

    if current >= limit {
        return Ok(Json(RateLimitCheckResponse {
            allowed: false, limit, remaining: 0, reset_seconds,
            quota_daily_remaining: quota_daily, quota_monthly_remaining: quota_monthly,
            reason: Some("rate limit exceeded".to_string()),
        }));
    }

    let _: () = conn.incr(&window_key, 1).await?;
    if current == 0 {
        let _: () = conn.expire(&window_key, window as i64).await?;
    }

    Ok(Json(RateLimitCheckResponse {
        allowed: true, limit, remaining: limit - current - 1, reset_seconds,
        quota_daily_remaining: quota_daily, quota_monthly_remaining: quota_monthly,
        reason: None,
    }))
}
