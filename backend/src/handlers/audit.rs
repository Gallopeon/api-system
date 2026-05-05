use std::sync::Arc;
use axum::extract::{Query, State};
use axum::response::IntoResponse;
use axum::{Extension, Json};
use chrono::{DateTime, Utc};
use serde_json::json;
use sqlx::Row;

use crate::AppState;
use crate::types::*;
use crate::auth::*;

pub async fn list_audit_logs(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Query(query): Query<AuditListQuery>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::AuditRead)?;
    let limit = query.limit.unwrap_or(30).clamp(1, 200);
    let offset = query.offset.unwrap_or(0);

    let rule_id_filter = query.rule_id.unwrap_or_default();
    let action_filter = query.action.unwrap_or_default();
    let actor_filter = query.actor.unwrap_or_default();
    let success_filter: i8 = query.success.map(|s| if s { 1 } else { 0 }).unwrap_or(-1);

    let rows = sqlx::query(
        "SELECT id, rule_id, action, actor, success, message, detail, created_at FROM audit_logs \
         WHERE (rule_id = ? OR ? = '') \
         AND (action = ? OR ? = '') \
         AND (actor = ? OR ? = '') \
         AND (success = ? OR ? < 0) \
         ORDER BY created_at DESC LIMIT ? OFFSET ?"
    )
    .bind(&rule_id_filter).bind(&rule_id_filter)
    .bind(&action_filter).bind(&action_filter)
    .bind(&actor_filter).bind(&actor_filter)
    .bind(success_filter).bind(success_filter)
    .bind(limit).bind(offset)
    .fetch_all(&state.pool).await?;
    let items: Vec<AuditLogItem> = rows.iter().map(|r| {
        let created_at: DateTime<Utc> = r.try_get("created_at").unwrap_or(DateTime::UNIX_EPOCH);
        let detail_str: Option<String> = r.try_get("detail").ok();
        AuditLogItem {
            id: r.try_get("id").unwrap_or(0),
            rule_id: r.try_get("rule_id").ok(),
            action: r.try_get("action").unwrap_or_default(),
            actor: r.try_get("actor").unwrap_or_default(),
            success: r.try_get::<i8, _>("success").unwrap_or(1) == 1,
            message: r.try_get("message").ok(),
            detail: detail_str.and_then(|s| serde_json::from_str(&s).ok()),
            created_at: created_at.to_rfc3339(),
        }
    }).collect();
    Ok(Json(json!({"items": items, "limit": limit, "offset": offset})))
}
