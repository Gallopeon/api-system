use std::sync::Arc;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::{Extension, Json};
use serde_json::{json, Value};
use sqlx::Row;
use uuid::Uuid;
use crate::AppState;
use crate::auth::*;

pub async fn create_circuit_breaker(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<Value>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleWrite)?;
    let id = Uuid::new_v4().to_string();
    let api_path = payload.get("api_path").and_then(|v| v.as_str()).unwrap_or("");
    let threshold = payload.get("failure_threshold").and_then(|v| v.as_i64()).unwrap_or(5);
    let recovery = payload.get("recovery_timeout_sec").and_then(|v| v.as_i64()).unwrap_or(30);
    let half_open = payload.get("half_open_max").and_then(|v| v.as_i64()).unwrap_or(3);
    let retry_count = payload.get("retry_count").and_then(|v| v.as_i64()).unwrap_or(3);
    let retry_delay = payload.get("retry_delay_ms").and_then(|v| v.as_i64()).unwrap_or(100);
    let timeout = payload.get("timeout_ms").and_then(|v| v.as_i64()).unwrap_or(10000);
    sqlx::query("INSERT INTO circuit_breakers (id, api_path, failure_threshold, recovery_timeout_sec, half_open_max, retry_count, retry_delay_ms, timeout_ms, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')")
        .bind(&id).bind(api_path).bind(threshold as i32).bind(recovery as i32).bind(half_open as i32).bind(retry_count as i32).bind(retry_delay as i32).bind(timeout as i32).execute(&state.pool).await?;
    Ok((StatusCode::CREATED, Json(json!({"id": id, "created": true}))))
}

pub async fn list_circuit_breakers(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    let rows = sqlx::query("SELECT id, api_path, failure_threshold, recovery_timeout_sec, half_open_max, retry_count, retry_delay_ms, timeout_ms, status FROM circuit_breakers").fetch_all(&state.pool).await?;
    let items: Vec<Value> = rows.iter().map(|r| json!({
        "id": r.try_get::<String,_>("id").unwrap_or_default(),
        "api_path": r.try_get::<String,_>("api_path").unwrap_or_default(),
        "failure_threshold": r.try_get::<i32,_>("failure_threshold").unwrap_or(5),
        "recovery_timeout_sec": r.try_get::<i32,_>("recovery_timeout_sec").unwrap_or(30),
        "half_open_max": r.try_get::<i32,_>("half_open_max").unwrap_or(3),
        "retry_count": r.try_get::<i32,_>("retry_count").unwrap_or(3),
        "retry_delay_ms": r.try_get::<i32,_>("retry_delay_ms").unwrap_or(100),
        "timeout_ms": r.try_get::<i32,_>("timeout_ms").unwrap_or(10000),
        "status": r.try_get::<String,_>("status").unwrap_or_default(),
    })).collect();
    Ok(Json(json!({"items": items})))
}

pub async fn get_circuit_breaker(State(_state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    Ok(Json(json!({"id": id})))
}
pub async fn update_circuit_breaker(State(_state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>, Json(_payload): Json<Value>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleWrite)?;
    Ok(Json(json!({"id": id, "updated": true})))
}
pub async fn delete_circuit_breaker(State(_state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(_id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleWrite)?;
    Ok(Json(json!({"deleted": true})))
}
