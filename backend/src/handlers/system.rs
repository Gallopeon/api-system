use std::sync::Arc;
use axum::extract::{Path, State};
use axum::response::IntoResponse;
use axum::{Extension, Json};
use serde_json::json;

use crate::AppState;
use crate::types::*;
use crate::auth::*;

pub async fn list_system_settings(State(_state): State<Arc<AppState>>, Extension(_auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    Ok(Json(json!({"items": []})))
}

pub async fn update_system_setting(State(_state): State<Arc<AppState>>, Extension(_auth): Extension<AuthContext>, Path(key): Path<String>, Json(_payload): Json<UpdateSettingRequest>) -> Result<impl IntoResponse, AppError> {
    Ok(Json(json!({"key": key, "updated": true})))
}
