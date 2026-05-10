use std::sync::Arc;
use axum::extract::{Path, Query, State};
use axum::response::IntoResponse;
use axum::{Extension, Json};
use chrono::{DateTime, Utc};
use serde_json::json;
use sqlx::Row;

use crate::AppState;
use crate::types::*;
use crate::auth::*;

pub async fn list_my_notifications(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Query(query): Query<ListNotificationsQuery>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserSelf)?;

    let user_id: String = sqlx::query_scalar("SELECT id FROM users WHERE username = ?")
        .bind(&auth.subject)
        .fetch_optional(&state.pool).await?
        .ok_or_else(|| AppError::NotFound("user not found".to_string()))?;

    let limit = query.limit.unwrap_or(20).min(100);
    let offset = query.offset.unwrap_or(0);

    let unread_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM notifications WHERE user_id = ? AND `read` = 0"
    ).bind(&user_id).fetch_one(&state.pool).await.unwrap_or(0);

    let channel_filter = query.channel.as_deref().unwrap_or("");
    let mut sql = String::from(
        "SELECT id, type, channel, title, message, `read`, email_sent, metadata, created_at FROM notifications WHERE user_id = ?"
    );
    if query.unread_only.unwrap_or(false) {
        sql.push_str(" AND `read` = 0");
    }
    if !channel_filter.is_empty() {
        sql.push_str(" AND channel IN ('both', ");
        sql.push_str("?)");
    }
    sql.push_str(" ORDER BY created_at DESC LIMIT ? OFFSET ?");

    let mut q = sqlx::query(&sql).bind(&user_id);
    if !channel_filter.is_empty() {
        q = q.bind(channel_filter);
    }
    q = q.bind(limit as i32).bind(offset as i32);

    let rows = q.fetch_all(&state.pool).await?;
    let items: Vec<NotificationItem> = rows.iter().map(|r| {
        let created_at: DateTime<Utc> = r.try_get("created_at").unwrap_or_else(|_| Utc::now());
        NotificationItem {
            id: r.try_get("id").unwrap_or_default(),
            r#type: r.try_get("type").unwrap_or_default(),
            channel: r.try_get("channel").unwrap_or_default(),
            title: r.try_get("title").unwrap_or_default(),
            message: r.try_get("message").unwrap_or_default(),
            read: r.try_get::<i8, _>("read").unwrap_or(0) == 1,
            email_sent: r.try_get::<i8, _>("email_sent").unwrap_or(0) == 1,
            metadata: r.try_get::<Option<String>, _>("metadata").ok().flatten()
                .and_then(|s| serde_json::from_str(&s).ok()),
            created_at: created_at.to_rfc3339(),
        }
    }).collect();

    Ok(Json(NotificationListResponse {
        items, unread_count, limit, offset,
    }))
}

pub async fn mark_notification_read(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Json(payload): Json<MarkReadRequest>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserSelf)?;
    let user_id: String = sqlx::query_scalar("SELECT id FROM users WHERE username = ?")
        .bind(&auth.subject)
        .fetch_optional(&state.pool).await?
        .ok_or_else(|| AppError::NotFound("user not found".to_string()))?;

    if let Some(id) = &payload.id {
        sqlx::query("UPDATE notifications SET `read` = 1 WHERE id = ? AND user_id = ?")
            .bind(id).bind(&user_id).execute(&state.pool).await?;
    } else {
        sqlx::query("UPDATE notifications SET `read` = 1 WHERE user_id = ? AND `read` = 0")
            .bind(&user_id).execute(&state.pool).await?;
    }

    let unread: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM notifications WHERE user_id = ? AND `read` = 0"
    ).bind(&user_id).fetch_one(&state.pool).await?;

    Ok(Json(json!({"marked_read": true, "unread_count": unread})))
}

pub async fn get_unread_count(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserSelf)?;
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM notifications n JOIN users u ON n.user_id = u.id WHERE u.username = ? AND n.`read` = 0"
    ).bind(&auth.subject).fetch_one(&state.pool).await?;
    Ok(Json(json!({"unread_count": count})))
}

pub async fn delete_my_notifications(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserSelf)?;
    let user_id: String = sqlx::query_scalar("SELECT id FROM users WHERE username = ?")
        .bind(&auth.subject)
        .fetch_optional(&state.pool).await?
        .ok_or_else(|| AppError::NotFound("user not found".to_string()))?;

    let deleted = sqlx::query("DELETE FROM notifications WHERE user_id = ?")
        .bind(&user_id)
        .execute(&state.pool)
        .await?
        .rows_affected();

    Ok(Json(json!({"deleted": deleted, "cleared": true})))
}

pub async fn delete_notification(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserSelf)?;
    let user_id: String = sqlx::query_scalar("SELECT id FROM users WHERE username = ?")
        .bind(&auth.subject)
        .fetch_optional(&state.pool).await?
        .ok_or_else(|| AppError::NotFound("user not found".to_string()))?;

    let affected = sqlx::query("DELETE FROM notifications WHERE id = ? AND user_id = ?")
        .bind(&id)
        .bind(&user_id)
        .execute(&state.pool)
        .await?
        .rows_affected();

    if affected == 0 {
        return Err(AppError::NotFound("notification not found".into()));
    }

    Ok(Json(json!({"id": id, "deleted": true})))
}
