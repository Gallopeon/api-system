use std::sync::Arc;
use axum::extract::State;
use axum::response::IntoResponse;
use axum::{Extension, Json};
use serde_json::json;
use tracing::warn;

use crate::AppState;
use crate::types::*;
use crate::auth::*;
use crate::engine::*;
use super::common::*;

pub async fn eval_expression_handler(
    State(_state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Json(payload): Json<ExprEvalRequest>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::TransformPreview)?;
    let matched = eval_expression(&payload.expression, &payload.input)?;
    Ok(Json(ExprEvalResponse { expression: payload.expression, matched }))
}

pub async fn execute_transform(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Json(payload): Json<ExecuteTransformRequest>,
) -> Result<impl IntoResponse, AppError> {
    let rule = load_rule_config_by_id(&state.pool, &payload.rule_id).await?;
    let (effective, selected_variant) = resolve_effective_rule(&rule, payload.traffic_context.as_ref(), payload.force_variant.as_deref())?;
    let output = apply_transform(&payload.input, &effective);
    write_audit_log(&state.pool, AuditEntry {
        rule_id: Some(payload.rule_id.clone()), action: "transform_execute".to_string(),
        actor: resolve_actor(&auth, payload.actor.as_deref()), success: true, message: None,
        detail: Some(json!({"selected_variant": selected_variant})),
    }).await.unwrap_or_else(|e| warn!(error = %e, "audit write failed"));
    Ok(Json(ExecuteResponse { rule_id: payload.rule_id, selected_variant, output }))
}

pub async fn preview_transform(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Json(payload): Json<PreviewRequest>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::TransformPreview)?;
    let preview_rule_id = payload.rule_id.clone().unwrap_or_else(|| "adhoc".to_string());
    let (effective, selected_variant) = if let Some(ref rule_id) = payload.rule_id {
        let rule = load_rule_config_by_id(&state.pool, rule_id).await?;
        resolve_effective_rule(&rule, payload.traffic_context.as_ref(), payload.force_variant.as_deref())?
    } else {
        (TransformRule::default(), None)
    };
    let output = apply_transform(&payload.input, &effective);
    write_audit_log(&state.pool, AuditEntry {
        rule_id: Some(preview_rule_id), action: "transform_preview".to_string(),
        actor: resolve_actor(&auth, payload.actor.as_deref()), success: true, message: None,
        detail: Some(json!({"selected_variant": selected_variant})),
    }).await.unwrap_or_else(|e| warn!(error = %e, "audit write failed"));
    Ok(Json(PreviewResponse { output, selected_variant }))
}
