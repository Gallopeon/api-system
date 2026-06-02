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

pub async fn create_protocol_config(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<Value>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ProtocolsWrite)?;
    let id = Uuid::new_v4().to_string();
    let api_path = payload.get("api_path").and_then(|v| v.as_str()).unwrap_or("");
    let protocol = payload.get("protocol").and_then(|v| v.as_str()).unwrap_or("http");
    let description = payload.get("description").and_then(|v| v.as_str()).map(|s| s.to_string());
    let config_json: Option<String> = payload.get("config_json").and_then(|v| if v.is_null() { None } else { Some(v.to_string()) });
    sqlx::query("INSERT INTO protocol_configs (id, api_path, protocol, description, config_json, status) VALUES (?, ?, ?, ?, ?, 'active')")
        .bind(&id).bind(api_path).bind(protocol).bind(&description).bind(&config_json).execute(&state.pool).await?;
    let actor = resolve_actor(&auth, None);
    spawn_audit_log(&state.pool, AuditEntry {
        rule_id: None, action: "protocol.create".to_string(), actor,
        success: true, message: Some(format!("Protocol config '{}' created", api_path)),
        detail: Some(json!({"id": id, "api_path": api_path, "protocol": protocol})),
    });
    Ok((StatusCode::CREATED, Json(json!({"id": id, "created": true}))))
}

pub async fn list_protocols(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ProtocolsRead)?;
    let rows = sqlx::query("SELECT id, api_path, protocol, description, config_json, status FROM protocol_configs").fetch_all(&state.pool).await?;
    let items: Vec<Value> = rows.iter().map(|r| json!({
        "id": r.try_get::<String,_>("id").unwrap_or_default(),
        "api_path": r.try_get::<String,_>("api_path").unwrap_or_default(),
        "protocol": r.try_get::<String,_>("protocol").unwrap_or_default(),
        "description": r.try_get::<Option<String>,_>("description").ok().flatten(),
        "config_json": r.try_get::<String,_>("config_json").unwrap_or_default(),
        "status": r.try_get::<String,_>("status").unwrap_or_default(),
    })).collect();
    Ok(Json(json!({"items": items})))
}

pub async fn get_protocol_config(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ProtocolsRead)?;
    let row = sqlx::query("SELECT id, api_path, protocol, description, config_json, status FROM protocol_configs WHERE id = ?")
        .bind(&id).fetch_optional(&state.pool).await?
        .ok_or_else(|| AppError::NotFound(format!("protocol config {} not found", id)))?;
    Ok(Json(json!({
        "id": row.try_get::<String,_>("id").unwrap_or_default(),
        "api_path": row.try_get::<String,_>("api_path").unwrap_or_default(),
        "protocol": row.try_get::<String,_>("protocol").unwrap_or_default(),
        "description": row.try_get::<Option<String>,_>("description").ok().flatten(),
        "config_json": row.try_get::<String,_>("config_json").unwrap_or_default(),
        "status": row.try_get::<String,_>("status").unwrap_or_default(),
    })))
}
pub async fn update_protocol_config(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>, Json(payload): Json<Value>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ProtocolsWrite)?;
    let mut set_clauses: Vec<String> = Vec::new();
    let mut bind_values: Vec<String> = Vec::new();
    if payload.get("api_path").and_then(|v| v.as_str()).is_some() {
        set_clauses.push("api_path = ?".into());
        bind_values.push(payload["api_path"].as_str().unwrap().to_string());
    }
    if payload.get("protocol").and_then(|v| v.as_str()).is_some() {
        set_clauses.push("protocol = ?".into());
        bind_values.push(payload["protocol"].as_str().unwrap().to_string());
    }
    if let Some(v) = payload.get("description") {
        if v.is_null() {
            set_clauses.push("description = NULL".into());
        } else {
            set_clauses.push("description = ?".into());
            bind_values.push(v.as_str().unwrap_or("").to_string());
        }
    }
    if let Some(v) = payload.get("config_json") {
        if v.is_null() {
            set_clauses.push("config_json = NULL".into());
        } else {
            set_clauses.push("config_json = ?".into());
            bind_values.push(v.to_string());
        }
    }
    if payload.get("status").and_then(|v| v.as_str()).is_some() {
        set_clauses.push("status = ?".into());
        bind_values.push(payload["status"].as_str().unwrap().to_string());
    }
    if set_clauses.is_empty() {
        return Err(AppError::BadRequest("no fields to update".into()));
    }
    let query = format!("UPDATE protocol_configs SET {} WHERE id = ?", set_clauses.join(", "));
    bind_values.push(id.clone());
    let mut q = sqlx::query(&query);
    for v in &bind_values {
        q = q.bind(v);
    }
    q.execute(&state.pool).await?;
    let actor = resolve_actor(&auth, None);
    spawn_audit_log(&state.pool, AuditEntry {
        rule_id: None, action: "protocol.update".to_string(), actor,
        success: true, message: Some(format!("Protocol config {} updated", id)),
        detail: Some(json!({"id": id})),
    });
    Ok(Json(json!({"updated": true})))
}
pub async fn delete_protocol_config(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ProtocolsWrite)?;
    sqlx::query("DELETE FROM protocol_configs WHERE id = ?").bind(&id).execute(&state.pool).await?;
    let actor = resolve_actor(&auth, None);
    spawn_audit_log(&state.pool, AuditEntry {
        rule_id: None, action: "protocol.delete".to_string(), actor,
        success: true, message: Some(format!("Protocol config {} deleted", id)),
        detail: Some(json!({"id": id})),
    });
    Ok(Json(json!({"deleted": true})))
}
