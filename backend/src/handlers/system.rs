use std::sync::Arc;
use axum::extract::{Path, State};
use axum::response::IntoResponse;
use axum::{Extension, Json};
use serde_json::json;
use sqlx::Row;

use crate::AppState;
use crate::types::*;
use crate::auth::*;

pub async fn list_system_settings(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::MetricsRead)?;
    let rows = sqlx::query(
        "SELECT setting_key, setting_value, description, editable, updated_at FROM system_settings ORDER BY setting_key"
    ).fetch_all(&state.pool).await?;
    let items: Vec<SystemSettingItem> = rows.iter().map(|r| SystemSettingItem {
        key: r.try_get("setting_key").unwrap_or_default(),
        value: r.try_get("setting_value").unwrap_or_default(),
        description: r.try_get("description").ok(),
        editable: r.try_get::<i8, _>("editable").unwrap_or(1) == 1,
        updated_at: r.try_get::<String, _>("updated_at").unwrap_or_default(),
    }).collect();
    Ok(Json(json!({"items": items})))
}

pub async fn update_system_setting(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(key): Path<String>, Json(payload): Json<UpdateSettingRequest>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserManage)?;
    let rows = sqlx::query(
        "UPDATE system_settings SET setting_value = ?, updated_at = NOW() WHERE setting_key = ? AND editable = 1"
    ).bind(&payload.value).bind(&key).execute(&state.pool).await?;
    if rows.rows_affected() == 0 {
        return Err(AppError::BadRequest(format!("setting '{}' not found or is not editable", key)));
    }
    Ok(Json(json!({"key": key, "updated": true})))
}
