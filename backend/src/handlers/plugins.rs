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
    Ok((StatusCode::CREATED, Json(json!({"id": id, "created": true}))))
}

pub async fn list_plugins(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::PluginsRead)?;
    let rows = sqlx::query("SELECT id, name, plugin_type, hook_point, priority, status FROM plugin_configs ORDER BY priority ASC").fetch_all(&state.pool).await?;
    let items: Vec<Value> = rows.iter().map(|r| json!({
        "id": r.try_get::<String,_>("id").unwrap_or_default(),
        "name": r.try_get::<String,_>("name").unwrap_or_default(),
        "plugin_type": r.try_get::<String,_>("plugin_type").unwrap_or_default(),
        "hook_point": r.try_get::<String,_>("hook_point").unwrap_or_default(),
        "priority": r.try_get::<i32,_>("priority").unwrap_or(100),
        "status": r.try_get::<String,_>("status").unwrap_or_default(),
    })).collect();
    Ok(Json(json!({"items": items})))
}

pub async fn get_plugin_config(Extension(auth): Extension<AuthContext>, Path(id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::PluginsRead)?;
    Err::<Json<Value>, _>(AppError::BadRequest(format!("not implemented: get_plugin_config {}", id)))
}
pub async fn update_plugin_config(Extension(auth): Extension<AuthContext>, Path(id): Path<String>, Json(_payload): Json<Value>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::PluginsWrite)?;
    Err::<Json<Value>, _>(AppError::BadRequest(format!("not implemented: update_plugin_config {}", id)))
}
pub async fn delete_plugin_config(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::PluginsWrite)?;
    sqlx::query("DELETE FROM plugin_configs WHERE id = ?").bind(&id).execute(&state.pool).await?;
    Ok(Json(json!({"deleted": true})))
}
