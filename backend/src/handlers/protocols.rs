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

pub async fn create_protocol_config(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<Value>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ProtocolsWrite)?;
    let id = Uuid::new_v4().to_string();
    let api_path = payload.get("api_path").and_then(|v| v.as_str()).unwrap_or("");
    let protocol = payload.get("protocol").and_then(|v| v.as_str()).unwrap_or("http");
    let config_json = payload.get("config_json").map(|v| v.to_string()).unwrap_or_default();
    sqlx::query("INSERT INTO protocol_configs (id, api_path, protocol, config_json, status) VALUES (?, ?, ?, ?, 'active')")
        .bind(&id).bind(api_path).bind(protocol).bind(&config_json).execute(&state.pool).await?;
    Ok((StatusCode::CREATED, Json(json!({"id": id, "created": true}))))
}

pub async fn list_protocols(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ProtocolsRead)?;
    let rows = sqlx::query("SELECT id, api_path, protocol, config_json, status FROM protocol_configs").fetch_all(&state.pool).await?;
    let items: Vec<Value> = rows.iter().map(|r| json!({
        "id": r.try_get::<String,_>("id").unwrap_or_default(),
        "api_path": r.try_get::<String,_>("api_path").unwrap_or_default(),
        "protocol": r.try_get::<String,_>("protocol").unwrap_or_default(),
        "config_json": r.try_get::<String,_>("config_json").unwrap_or_default(),
        "status": r.try_get::<String,_>("status").unwrap_or_default(),
    })).collect();
    Ok(Json(json!({"items": items})))
}

pub async fn get_protocol_config(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ProtocolsRead)?;
    let row = sqlx::query("SELECT id, api_path, protocol, config_json, status FROM protocol_configs WHERE id = ?")
        .bind(&id).fetch_optional(&state.pool).await?
        .ok_or_else(|| AppError::NotFound(format!("protocol config {} not found", id)))?;
    Ok(Json(json!({
        "id": row.try_get::<String,_>("id").unwrap_or_default(),
        "api_path": row.try_get::<String,_>("api_path").unwrap_or_default(),
        "protocol": row.try_get::<String,_>("protocol").unwrap_or_default(),
        "config_json": row.try_get::<String,_>("config_json").unwrap_or_default(),
        "status": row.try_get::<String,_>("status").unwrap_or_default(),
    })))
}
pub async fn update_protocol_config(State(_state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>, Json(_payload): Json<Value>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ProtocolsWrite)?;
    Err::<Json<Value>, _>(AppError::BadRequest(format!("not implemented: update_protocol_config {}", id)))
}
pub async fn delete_protocol_config(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ProtocolsWrite)?;
    sqlx::query("DELETE FROM protocol_configs WHERE id = ?").bind(&id).execute(&state.pool).await?;
    Ok(Json(json!({"deleted": true})))
}
