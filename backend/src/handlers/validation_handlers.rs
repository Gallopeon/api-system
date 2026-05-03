use std::sync::Arc;
use axum::extract::{Path, State};
use axum::response::IntoResponse;
use axum::{Extension, Json};
use sqlx::Row;

use crate::AppState;
use crate::types::*;
use crate::auth::*;
use crate::engine::*;

pub async fn validate_request(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Json(payload): Json<ValidateRequest>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    let rows = sqlx::query(
        "SELECT v.config_text FROM rule_configs c INNER JOIN rule_versions v ON c.id = v.rule_id AND c.current_version = v.version WHERE c.api_path = ? AND c.status = 'published'"
    ).bind(&payload.api_path).fetch_optional(&state.pool).await?;
    let Some(row) = rows else {
        return Ok(Json(ValidationResult { valid: true, errors: vec![], warnings: vec![], schema_errors: vec!["No rule found".to_string()] }));
    };
    let config_text: String = row.try_get("config_text").unwrap_or_default();
    let rule: TransformRule = serde_json::from_str(&config_text).unwrap_or_default();
    match rule.request_validation {
        Some(ref vc) if vc.enabled => Ok(Json(validate_json(&payload.body, vc)?)),
        _ => Ok(Json(ValidationResult { valid: true, errors: vec![], warnings: vec!["No request validation configured".to_string()], schema_errors: vec![] })),
    }
}

pub async fn validate_response(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Json(payload): Json<ValidateResponseRequest>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    let rows = sqlx::query(
        "SELECT v.config_text FROM rule_configs c INNER JOIN rule_versions v ON c.id = v.rule_id AND c.current_version = v.version WHERE c.api_path = ? AND c.status = 'published'"
    ).bind(&payload.api_path).fetch_optional(&state.pool).await?;
    let Some(row) = rows else {
        return Ok(Json(ValidationResult { valid: true, errors: vec![], warnings: vec![], schema_errors: vec!["No rule found".to_string()] }));
    };
    let config_text: String = row.try_get("config_text").unwrap_or_default();
    let rule: TransformRule = serde_json::from_str(&config_text).unwrap_or_default();
    match rule.response_validation {
        Some(ref vc) if vc.enabled => Ok(Json(validate_json(&payload.body, vc)?)),
        _ => Ok(Json(ValidationResult { valid: true, errors: vec![], warnings: vec!["No response validation configured".to_string()], schema_errors: vec![] })),
    }
}

pub async fn validate_against_rule(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(rule_id): Path<String>,
    Json(payload): Json<ValidateResponseRequest>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    let rows = sqlx::query(
        "SELECT config_text FROM rule_versions WHERE rule_id = ? ORDER BY version DESC LIMIT 1"
    ).bind(&rule_id).fetch_optional(&state.pool).await?;
    let Some(row) = rows else {
        return Ok(Json(ValidationResult { valid: true, errors: vec![], warnings: vec![], schema_errors: vec!["Rule not found".to_string()] }));
    };
    let config_text: String = row.try_get("config_text").unwrap_or_default();
    let rule: TransformRule = serde_json::from_str(&config_text).unwrap_or_default();
    match rule.response_validation {
        Some(ref vc) if vc.enabled => Ok(Json(validate_json(&payload.body, vc)?)),
        _ => Ok(Json(ValidationResult { valid: true, errors: vec![], warnings: vec![], schema_errors: vec![] })),
    }
}
