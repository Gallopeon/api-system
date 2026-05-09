use std::sync::Arc;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::{Extension, Json};
use serde_json::{json, Value};
use sqlx::Row;
use uuid::Uuid;
use crate::AppState;
use crate::types::AuditEntry;
use crate::auth::*;
use super::common::spawn_audit_log;

pub async fn create_circuit_breaker(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<Value>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::CircuitBreakersWrite)?;
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
    let actor = resolve_actor(&auth, None);
    spawn_audit_log(&state.pool, AuditEntry {
        rule_id: None, action: "circuit_breaker.create".to_string(), actor,
        success: true, message: Some(format!("Circuit breaker '{}' created", api_path)),
        detail: Some(json!({"id": id, "api_path": api_path})),
    });
    Ok((StatusCode::CREATED, Json(json!({"id": id, "created": true}))))
}

pub async fn list_circuit_breakers(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::CircuitBreakersRead)?;
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

pub async fn get_circuit_breaker(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::CircuitBreakersRead)?;
    let row = sqlx::query("SELECT id, api_path, failure_threshold, recovery_timeout_sec, half_open_max, retry_count, retry_delay_ms, timeout_ms, status FROM circuit_breakers WHERE id = ?")
        .bind(&id).fetch_optional(&state.pool).await?
        .ok_or_else(|| AppError::NotFound(format!("circuit breaker {} not found", id)))?;
    Ok(Json(json!({
        "id": row.try_get::<String,_>("id").unwrap_or_default(),
        "api_path": row.try_get::<String,_>("api_path").unwrap_or_default(),
        "failure_threshold": row.try_get::<i32,_>("failure_threshold").unwrap_or(5),
        "recovery_timeout_sec": row.try_get::<i32,_>("recovery_timeout_sec").unwrap_or(30),
        "half_open_max": row.try_get::<i32,_>("half_open_max").unwrap_or(3),
        "retry_count": row.try_get::<i32,_>("retry_count").unwrap_or(3),
        "retry_delay_ms": row.try_get::<i32,_>("retry_delay_ms").unwrap_or(100),
        "timeout_ms": row.try_get::<i32,_>("timeout_ms").unwrap_or(10000),
        "status": row.try_get::<String,_>("status").unwrap_or_default(),
    })))
}
pub async fn update_circuit_breaker(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>, Json(payload): Json<Value>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::CircuitBreakersWrite)?;
    let mut set_clauses: Vec<String> = Vec::new();
    let mut bind_values: Vec<String> = Vec::new();
    if payload.get("api_path").and_then(|v| v.as_str()).is_some() {
        set_clauses.push("api_path = ?".into());
        bind_values.push(payload["api_path"].as_str().unwrap().to_string());
    }
    if let Some(v) = payload.get("failure_threshold").and_then(|v| v.as_i64()) {
        set_clauses.push("failure_threshold = ?".into());
        bind_values.push(v.to_string());
    }
    if let Some(v) = payload.get("recovery_timeout_sec").and_then(|v| v.as_i64()) {
        set_clauses.push("recovery_timeout_sec = ?".into());
        bind_values.push(v.to_string());
    }
    if let Some(v) = payload.get("half_open_max").and_then(|v| v.as_i64()) {
        set_clauses.push("half_open_max = ?".into());
        bind_values.push(v.to_string());
    }
    if let Some(v) = payload.get("retry_count").and_then(|v| v.as_i64()) {
        set_clauses.push("retry_count = ?".into());
        bind_values.push(v.to_string());
    }
    if let Some(v) = payload.get("retry_delay_ms").and_then(|v| v.as_i64()) {
        set_clauses.push("retry_delay_ms = ?".into());
        bind_values.push(v.to_string());
    }
    if let Some(v) = payload.get("timeout_ms").and_then(|v| v.as_i64()) {
        set_clauses.push("timeout_ms = ?".into());
        bind_values.push(v.to_string());
    }
    if payload.get("status").and_then(|v| v.as_str()).is_some() {
        set_clauses.push("status = ?".into());
        bind_values.push(payload["status"].as_str().unwrap().to_string());
    }
    if set_clauses.is_empty() {
        return Err(AppError::BadRequest("no fields to update".into()));
    }
    let query = format!("UPDATE circuit_breakers SET {} WHERE id = ?", set_clauses.join(", "));
    bind_values.push(id.clone());
    let mut q = sqlx::query(&query);
    for v in &bind_values {
        q = q.bind(v);
    }
    q.execute(&state.pool).await?;
    let actor = resolve_actor(&auth, None);
    spawn_audit_log(&state.pool, AuditEntry {
        rule_id: None, action: "circuit_breaker.update".to_string(), actor,
        success: true, message: Some(format!("Circuit breaker {} updated", id)),
        detail: Some(json!({"id": id})),
    });
    Ok(Json(json!({"updated": true})))
}
pub async fn delete_circuit_breaker(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::CircuitBreakersWrite)?;
    sqlx::query("DELETE FROM circuit_breakers WHERE id = ?").bind(&id).execute(&state.pool).await?;
    let actor = resolve_actor(&auth, None);
    spawn_audit_log(&state.pool, AuditEntry {
        rule_id: None, action: "circuit_breaker.delete".to_string(), actor,
        success: true, message: Some(format!("Circuit breaker {} deleted", id)),
        detail: Some(json!({"id": id})),
    });
    Ok(Json(json!({"deleted": true})))
}
