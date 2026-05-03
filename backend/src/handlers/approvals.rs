use std::sync::Arc;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::{Extension, Json};
use chrono::{DateTime, Utc};
use serde_json::json;
use sqlx::Row;
use uuid::Uuid;

use crate::AppState;
use crate::types::*;
use crate::auth::*;
use super::common::*;

pub async fn create_approval(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Json(payload): Json<CreateApprovalRequest>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleWrite)?;
    let id = Uuid::new_v4().to_string();
    let actor = resolve_actor(&auth, None);
    sqlx::query(
        "INSERT INTO approvals (id, rule_id, version, requestor, status, comment) VALUES (?, ?, ?, ?, 'pending', ?)"
    ).bind(&id).bind(&payload.rule_id).bind(payload.version as i32).bind(&actor).bind(&payload.comment)
     .execute(&state.pool).await?;
    Ok((StatusCode::CREATED, Json(json!({"id": id, "created": true}))))
}

pub async fn get_approval(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    Ok(Json(get_approval_by_id(&state.pool, &id).await?))
}

pub async fn list_approvals(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Query(query): Query<ListApprovalsQuery>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    let limit = query.limit.unwrap_or(30).clamp(1, 200);
    let offset = query.offset.unwrap_or(0);
    let rows = if let Some(ref status) = query.status {
        sqlx::query("SELECT id, rule_id, version, requestor, reviewer, status, comment, created_at, reviewed_at FROM approvals WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?")
            .bind(status).bind(limit).bind(offset).fetch_all(&state.pool).await?
    } else {
        sqlx::query("SELECT id, rule_id, version, requestor, reviewer, status, comment, created_at, reviewed_at FROM approvals ORDER BY created_at DESC LIMIT ? OFFSET ?")
            .bind(limit).bind(offset).fetch_all(&state.pool).await?
    };
    let items: Vec<ApprovalResponse> = rows.iter().map(|r| {
        let created_at: DateTime<Utc> = r.try_get("created_at").unwrap_or(DateTime::UNIX_EPOCH);
        let reviewed_at: Option<DateTime<Utc>> = r.try_get("reviewed_at").ok();
        ApprovalResponse {
            id: r.try_get("id").unwrap_or_default(),
            rule_id: r.try_get("rule_id").unwrap_or_default(),
            version: r.try_get("version").unwrap_or(0),
            requestor: r.try_get("requestor").unwrap_or_default(),
            reviewer: r.try_get("reviewer").unwrap_or_default(),
            status: r.try_get("status").unwrap_or_default(),
            comment: r.try_get("comment").unwrap_or_default(),
            created_at: created_at.to_rfc3339(),
            reviewed_at: reviewed_at.map(|d| d.to_rfc3339()),
        }
    }).collect();
    Ok(Json(ApprovalListResponse { items, limit, offset }))
}

pub async fn review_approval(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(id): Path<String>,
    Json(payload): Json<ReviewApprovalRequest>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleWrite)?;
    let actor = resolve_actor(&auth, None);
    let new_status = if payload.action == "approve" { "approved" } else { "rejected" };
    sqlx::query("UPDATE approvals SET status = ?, reviewer = ?, reviewed_at = NOW() WHERE id = ?")
        .bind(new_status).bind(&actor).bind(&id).execute(&state.pool).await?;
    Ok(Json(json!({"id": id, "status": new_status})))
}
