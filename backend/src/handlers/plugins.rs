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

pub async fn create_plugin_config(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<Value>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::PluginsWrite)?;
    let id = Uuid::new_v4().to_string();
    let name = payload.get("name").and_then(|v| v.as_str()).unwrap_or("unnamed");
    let plugin_type = payload.get("plugin_type").and_then(|v| v.as_str()).unwrap_or("lua");
    let hook_point = payload.get("hook_point").and_then(|v| v.as_str()).unwrap_or("pre_transform");
    let config_json = payload.get("config_json").map(|v| v.to_string()).unwrap_or_default();
    let priority: i32 = payload.get("priority").and_then(|v| v.as_i64()).unwrap_or(100) as i32;
    sqlx::query("INSERT INTO plugin_configs (id, name, plugin_type, hook_point, config_json, priority, status) VALUES (?, ?, ?, ?, ?, ?, 'active')")
        .bind(&id).bind(name).bind(plugin_type).bind(hook_point).bind(&config_json).bind(priority).execute(&state.pool).await?;
    let actor = resolve_actor(&auth, None);
    spawn_audit_log(&state.pool, AuditEntry {
        rule_id: None, action: "plugin.create".to_string(), actor,
        success: true, message: Some(format!("Plugin config '{}' created", name)),
        detail: Some(json!({"id": id, "name": name, "plugin_type": plugin_type, "hook_point": hook_point})),
    });
    Ok((StatusCode::CREATED, Json(json!({"id": id, "created": true}))))
}

pub async fn list_plugins(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::PluginsRead)?;
    let rows = sqlx::query("SELECT id, name, plugin_type, hook_point, config_json, priority, status FROM plugin_configs ORDER BY priority ASC").fetch_all(&state.pool).await?;
    let items: Vec<Value> = rows.iter().map(|r| json!({
        "id": r.try_get::<String,_>("id").unwrap_or_default(),
        "name": r.try_get::<String,_>("name").unwrap_or_default(),
        "plugin_type": r.try_get::<String,_>("plugin_type").unwrap_or_default(),
        "hook_point": r.try_get::<String,_>("hook_point").unwrap_or_default(),
        "config_json": r.try_get::<Option<Value>, _>("config_json").ok().flatten(),
        "priority": r.try_get::<i32,_>("priority").unwrap_or(100),
        "status": r.try_get::<String,_>("status").unwrap_or_default(),
    })).collect();
    Ok(Json(json!({"items": items})))
}

pub async fn get_plugin_config(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::PluginsRead)?;
    let row = sqlx::query("SELECT id, name, plugin_type, hook_point, config_json, priority, status FROM plugin_configs WHERE id = ?")
        .bind(&id).fetch_optional(&state.pool).await?
        .ok_or_else(|| AppError::NotFound(format!("plugin config {} not found", id)))?;
    Ok(Json(json!({
        "id": row.try_get::<String,_>("id").unwrap_or_default(),
        "name": row.try_get::<String,_>("name").unwrap_or_default(),
        "plugin_type": row.try_get::<String,_>("plugin_type").unwrap_or_default(),
        "hook_point": row.try_get::<String,_>("hook_point").unwrap_or_default(),
        "config_json": row.try_get::<Value, _>("config_json").unwrap_or(Value::Null),
        "priority": row.try_get::<i32,_>("priority").unwrap_or(100),
        "status": row.try_get::<String,_>("status").unwrap_or_default(),
    })))
}
pub async fn update_plugin_config(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>, Json(payload): Json<Value>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::PluginsWrite)?;
    let mut set_clauses: Vec<String> = Vec::new();
    let mut bind_values: Vec<String> = Vec::new();
    if payload.get("name").and_then(|v| v.as_str()).is_some() {
        set_clauses.push("name = ?".into());
        bind_values.push(payload["name"].as_str().unwrap().to_string());
    }
    if payload.get("plugin_type").and_then(|v| v.as_str()).is_some() {
        set_clauses.push("plugin_type = ?".into());
        bind_values.push(payload["plugin_type"].as_str().unwrap().to_string());
    }
    if payload.get("hook_point").and_then(|v| v.as_str()).is_some() {
        set_clauses.push("hook_point = ?".into());
        bind_values.push(payload["hook_point"].as_str().unwrap().to_string());
    }
    if payload.get("config_json").is_some() {
        set_clauses.push("config_json = ?".into());
        bind_values.push(payload["config_json"].to_string());
    }
    if let Some(v) = payload.get("priority").and_then(|v| v.as_i64()) {
        set_clauses.push("priority = ?".into());
        bind_values.push(v.to_string());
    }
    if payload.get("status").and_then(|v| v.as_str()).is_some() {
        set_clauses.push("status = ?".into());
        bind_values.push(payload["status"].as_str().unwrap().to_string());
    }
    if set_clauses.is_empty() {
        return Err(AppError::BadRequest("no fields to update".into()));
    }
    let query = format!("UPDATE plugin_configs SET {} WHERE id = ?", set_clauses.join(", "));
    bind_values.push(id.clone());
    let mut q = sqlx::query(&query);
    for v in &bind_values {
        q = q.bind(v);
    }
    q.execute(&state.pool).await?;
    let actor = resolve_actor(&auth, None);
    spawn_audit_log(&state.pool, AuditEntry {
        rule_id: None, action: "plugin.update".to_string(), actor,
        success: true, message: Some(format!("Plugin config {} updated", id)),
        detail: Some(json!({"id": id})),
    });
    Ok(Json(json!({"updated": true})))
}
pub async fn delete_plugin_config(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::PluginsWrite)?;
    sqlx::query("DELETE FROM plugin_configs WHERE id = ?").bind(&id).execute(&state.pool).await?;
    let actor = resolve_actor(&auth, None);
    spawn_audit_log(&state.pool, AuditEntry {
        rule_id: None, action: "plugin.delete".to_string(), actor,
        success: true, message: Some(format!("Plugin config {} deleted", id)),
        detail: Some(json!({"id": id})),
    });
    Ok(Json(json!({"deleted": true})))
}
