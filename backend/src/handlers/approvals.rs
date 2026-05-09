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
use crate::engine::notify::notify_user;

pub async fn create_approval(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Json(payload): Json<CreateApprovalRequest>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleWrite)?;
    let id = Uuid::new_v4().to_string();
    let actor = resolve_actor(&auth, payload.actor.as_deref());
    let reviewer = payload.reviewer.as_deref().filter(|v| !v.is_empty());
    sqlx::query(
        "INSERT INTO approvals (id, rule_id, version, requestor, reviewer, status, comment) VALUES (?, ?, ?, ?, ?, 'pending', ?)"
    ).bind(&id).bind(&payload.rule_id).bind(payload.version as i32).bind(&actor).bind(reviewer).bind(&payload.comment)
     .execute(&state.pool).await?;
    spawn_audit_log(&state.pool, AuditEntry {
        rule_id: Some(payload.rule_id.clone()), action: "approval_create".to_string(), actor: actor.clone(),
        success: true, message: Some("Approval request created".to_string()), detail: None,
    });

    // Directly notify the reviewer(s) regardless of preference settings.
    // If a specific reviewer is named, notify them. Otherwise notify all admins and reviewers.
    let pool = state.pool.clone();
    let requestor = actor;
    let rule_id = payload.rule_id.clone();
    let reviewer_name = reviewer.map(|r| r.to_string());
    tokio::spawn(async move {
        let title = "New Approval Request";
        let message = format!("{} requests approval for rule {}", requestor, rule_id);
        if let Some(ref rname) = reviewer_name {
            if let Ok(Some(uid)) = sqlx::query_scalar::<_, String>(
                "SELECT id FROM users WHERE username = ? AND status = 'active'"
            ).bind(rname).fetch_optional(&pool).await {
                notify_user(&pool, &uid, "approval", "in_app", title, &message, None).await;
            }
        } else {
            // No specific reviewer — notify all admins and reviewers
            if let Ok(rows) = sqlx::query(
                "SELECT id FROM users WHERE role IN ('admin', 'reviewer') AND status = 'active'"
            ).fetch_all(&pool).await {
                for row in rows {
                    let uid: String = row.try_get("id").unwrap_or_default();
                    notify_user(&pool, &uid, "approval", "in_app", title, &message, None).await;
                }
            }
        }
    });

    Ok((StatusCode::CREATED, Json(json!({"id": id, "created": true}))))
}

pub async fn my_pending_approvals(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserSelf)?;
    let rows = if auth.role == Role::Admin || auth.role == Role::Reviewer {
        sqlx::query(
            "SELECT id, rule_id, version, requestor, reviewer, status, comment, created_at, reviewed_at \
             FROM approvals WHERE status = 'pending' AND (reviewer = ? OR reviewer IS NULL) \
             ORDER BY created_at DESC LIMIT 30"
        ).bind(&auth.subject).fetch_all(&state.pool).await?
    } else {
        sqlx::query(
            "SELECT id, rule_id, version, requestor, reviewer, status, comment, created_at, reviewed_at \
             FROM approvals WHERE status = 'pending' AND reviewer = ? \
             ORDER BY created_at DESC LIMIT 30"
        ).bind(&auth.subject).fetch_all(&state.pool).await?
    };
    let items = rows.iter().map(approval_row_to_response).collect::<Vec<_>>();
    Ok(Json(json!({"items": items})))
}

pub async fn my_approval_requests(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserSelf)?;
    let rows = sqlx::query(
        "SELECT id, rule_id, version, requestor, reviewer, status, comment, created_at, reviewed_at \
         FROM approvals WHERE requestor = ? ORDER BY created_at DESC LIMIT 30"
    ).bind(&auth.subject).fetch_all(&state.pool).await?;
    let items = rows.iter().map(approval_row_to_response).collect::<Vec<_>>();
    Ok(Json(json!({"items": items})))
}

fn approval_row_to_response(r: &sqlx::mysql::MySqlRow) -> ApprovalResponse {
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
}

pub async fn get_approval(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ApprovalRead)?;
    Ok(Json(get_approval_by_id(&state.pool, &id).await?))
}

pub async fn list_approvals(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Query(query): Query<ListApprovalsQuery>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ApprovalRead)?;
    let limit = query.limit.unwrap_or(30).clamp(1, 200);
    let offset = query.offset.unwrap_or(0);
    let rows = if let Some(ref status) = query.status {
        sqlx::query("SELECT id, rule_id, version, requestor, reviewer, status, comment, created_at, reviewed_at FROM approvals WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?")
            .bind(status).bind(limit as i64).bind(offset as i64).fetch_all(&state.pool).await?
    } else {
        sqlx::query("SELECT id, rule_id, version, requestor, reviewer, status, comment, created_at, reviewed_at FROM approvals ORDER BY created_at DESC LIMIT ? OFFSET ?")
            .bind(limit as i64).bind(offset as i64).fetch_all(&state.pool).await?
    };
    let items = rows.iter().map(approval_row_to_response).collect::<Vec<_>>();
    Ok(Json(ApprovalListResponse { items, limit, offset }))
}

pub async fn review_approval(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(id): Path<String>,
    Json(payload): Json<ReviewApprovalRequest>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ApprovalReview)?;
    let actor = resolve_actor(&auth, payload.actor.as_deref());
    let new_status = if payload.action == "approve" { "approved" } else { "rejected" };
    sqlx::query("UPDATE approvals SET status = ?, reviewer = COALESCE(NULLIF(?, ''), reviewer), reviewed_at = NOW() WHERE id = ?")
        .bind(new_status).bind(&actor).bind(&id).execute(&state.pool).await?;
    spawn_audit_log(&state.pool, AuditEntry {
        rule_id: None, action: format!("approval_{}", new_status), actor,
        success: true, message: Some(format!("Approval {} {}", id, new_status)), detail: None,
    });
    Ok(Json(json!({"id": id, "status": new_status})))
}
