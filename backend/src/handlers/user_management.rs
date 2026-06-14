use std::sync::Arc;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::{Extension, Json};
use serde_json::json;
use uuid::Uuid;

use crate::AppState;
use crate::types::*;
use crate::auth::*;
use super::common::spawn_audit_log;
use super::auth_user::row_to_user;

pub async fn list_users(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Query(query): Query<ListUsersQuery>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserRead)?;
    let limit = query.limit.unwrap_or(20).clamp(1, 100);
    let offset = query.offset.unwrap_or(0);

    let mut where_clauses: Vec<String> = Vec::new();
    let mut params: Vec<String> = Vec::new();

    if let Some(ref group) = query.user_group {
        where_clauses.push("user_group = ?".to_string());
        params.push(group.clone());
    }
    if let Some(ref status) = query.status {
        where_clauses.push("status = ?".to_string());
        params.push(status.clone());
    }
    if let Some(ref search) = query.search {
        where_clauses.push("(username LIKE ? OR email LIKE ?)".to_string());
        let pattern = format!("%{}%", search.replace('%', "\\%").replace('_', "\\_"));
        params.push(pattern.clone());
        params.push(pattern);
    }

    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {} ", where_clauses.join(" AND "))
    };

    let sql = format!(
        "SELECT id, username, password_hash, email, display_name, avatar_url, role, status, user_group, permission_template_id, custom_permissions, last_login_at, created_at, updated_at FROM users {}ORDER BY created_at DESC LIMIT ? OFFSET ?",
        where_sql
    );

    let mut q = sqlx::query(&sql);
    for p in &params {
        q = q.bind(p);
    }
    let rows = q.bind(limit).bind(offset).fetch_all(&state.pool).await?;
    let items: Vec<UserResponse> = rows.iter().map(|r| row_to_user(r)).collect();
    Ok(Json(UserListResponse { items, limit, offset }))
}

pub async fn create_user(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<CreateUserRequest>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserManage)?;
    validate_password_strength(&payload.password)?;
    let id = Uuid::new_v4().to_string();
    let pw = payload.password.clone();
    let hash = tokio::task::spawn_blocking(move || bcrypt::hash(&pw, 12))
        .await
        .map_err(|e| AppError::Internal(format!("spawn_blocking failed: {}", e)))?
        .map_err(|e| AppError::BadRequest(format!("bcrypt: {}", e)))?;
    let user_group = payload.user_group.as_deref().unwrap_or("user");
    let template_id = payload.permission_template_id.as_deref();
    let custom_perms = payload.custom_permissions.as_ref()
        .map(|v| serde_json::to_string(v))
        .transpose()
        .map_err(|e| AppError::BadRequest(format!("invalid custom_permissions JSON: {}", e)))?;
    let default_prefs = serde_json::to_string(&json!({
        "theme": "system",
        "lang": "zh",
        "notifications": {
            "email": {
                "rule_changes": true,
                "security_alerts": true,
                "product_updates": true
            },
            "in_app": {
                "approvals": true,
                "product_updates": true,
                "infrastructure": true,
                "audit": true
            }
        }
    })).map_err(|e| AppError::Internal(format!("failed to serialize default preferences: {}", e)))?;
    sqlx::query(
        "INSERT INTO users (id, username, password_hash, email, display_name, user_group, permission_template_id, custom_permissions, preferences) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(&id).bind(&payload.username).bind(&hash)
     .bind(&payload.email).bind(&payload.display_name)
     .bind(user_group).bind(template_id).bind(&custom_perms).bind(&default_prefs)
     .execute(&state.pool).await?;
    let actor = resolve_actor(&auth, payload.actor.as_deref());
    spawn_audit_log(&state.pool, AuditEntry {
        rule_id: None, action: "user_create".to_string(), actor,
        success: true, message: Some(format!("User '{}' created", payload.username)),
        detail: Some(json!({"id": id, "username": payload.username})),
    });
    Ok((StatusCode::CREATED, Json(json!({"id": id, "created": true}))))
}

pub async fn get_user(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserRead)?;
    let row = sqlx::query(
        "SELECT id, username, password_hash, email, display_name, avatar_url, role, status, user_group, permission_template_id, custom_permissions, last_login_at, created_at, updated_at FROM users WHERE id = ?"
    ).bind(&id).fetch_optional(&state.pool).await?
    .ok_or_else(|| AppError::NotFound(format!("user {} not found", id)))?;
    Ok(Json(row_to_user(&row)))
}

pub async fn update_user(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>, Json(payload): Json<UpdateUserRequest>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserManage)?;
    let mut need_revoke = false;
    let mut tx = state.pool.begin().await?;
    if let Some(ref status) = payload.status {
        sqlx::query("UPDATE users SET status = ? WHERE id = ?").bind(status).bind(&id).execute(&mut *tx).await?;
        if status == "disabled" {
            need_revoke = true;
        }
    }
    if let Some(ref display_name) = payload.display_name {
        sqlx::query("UPDATE users SET display_name = ? WHERE id = ?").bind(display_name).bind(&id).execute(&mut *tx).await?;
    }
    if let Some(ref email) = payload.email {
        sqlx::query("UPDATE users SET email = ? WHERE id = ?").bind(email).bind(&id).execute(&mut *tx).await?;
    }
    if let Some(ref template_id) = payload.permission_template_id {
        sqlx::query("UPDATE users SET permission_template_id = ? WHERE id = ?").bind(template_id).bind(&id).execute(&mut *tx).await?;
        need_revoke = true;
    }
    if let Some(ref custom_perms) = payload.custom_permissions {
        let perms_json = serde_json::to_string(custom_perms)
            .map_err(|e| AppError::BadRequest(format!("invalid custom_permissions JSON: {}", e)))?;
        sqlx::query("UPDATE users SET custom_permissions = ? WHERE id = ?").bind(&perms_json).bind(&id).execute(&mut *tx).await?;
        need_revoke = true;
    }
    if let Some(ref group) = payload.user_group {
        sqlx::query("UPDATE users SET user_group = ? WHERE id = ?").bind(group).bind(&id).execute(&mut *tx).await?;
        need_revoke = true;
    }
    tx.commit().await?;
    // Revoke all active sessions when role/permissions change or user is disabled
    if need_revoke {
        revoke_all_user_sessions(&state.pool, &state.redis, &id).await;
    }
    let actor = resolve_actor(&auth, payload.actor.as_deref());
    spawn_audit_log(&state.pool, AuditEntry {
        rule_id: None, action: "user_update".to_string(), actor,
        success: true, message: Some(format!("User {} updated", id)),
        detail: Some(json!({"id": id, "status": payload.status, "permission_template_id": payload.permission_template_id})),
    });
    Ok(Json(json!({"id": id, "updated": true})))
}

pub async fn revoke_all_user_sessions(pool: &sqlx::MySqlPool, redis: &redis::Client, user_id: &str) {
    let jtis: Vec<String> = match sqlx::query_scalar(
        "SELECT token_jti FROM user_sessions WHERE user_id = ? AND revoked = 0 AND token_expires_at > UTC_TIMESTAMP()"
    ).bind(user_id).fetch_all(pool).await {
        Ok(rows) => rows.into_iter().filter_map(|j: Option<String>| j).collect(),
        Err(e) => {
            tracing::warn!(user_id, error = %e, "failed to fetch active sessions for revocation");
            return;
        }
    };
    if jtis.is_empty() {
        return;
    }
    // Mark all active sessions as revoked
    if let Err(e) = sqlx::query("UPDATE user_sessions SET revoked = 1 WHERE user_id = ? AND revoked = 0")
        .bind(user_id).execute(pool).await {
        tracing::warn!(user_id, error = %e, "failed to revoke sessions in DB");
        return;
    }
    // Blacklist JTIs in Redis so the auth middleware rejects them immediately
    if let Ok(mut conn) = redis.get_multiplexed_async_connection().await {
        for jti in &jtis {
            let _: Result<(), _> = redis::cmd("SETEX")
                .arg(format!("jti:revoked:{}", jti))
                .arg(86400_i64)
                .arg("1")
                .query_async(&mut conn)
                .await;
        }
        tracing::info!(user_id, count = jtis.len(), "revoked all active sessions for user");
    }
}

pub async fn delete_user(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserManage)?;
    // Check admin by id to prevent deleting the built-in admin
    let is_admin: Option<String> = sqlx::query_scalar("SELECT username FROM users WHERE id = ?")
        .bind(&id).fetch_optional(&state.pool).await?.flatten();
    match is_admin {
        None => return Err(AppError::NotFound(format!("user {} not found", id))),
        Some(ref name) if name == "admin" => return Err(AppError::Forbidden("cannot delete the built-in admin user".to_string())),
        _ => {}
    }
    // Revoke all active sessions before deleting the user
    revoke_all_user_sessions(&state.pool, &state.redis, &id).await;
    sqlx::query("DELETE FROM users WHERE id = ?").bind(&id).execute(&state.pool).await?;
    let actor = resolve_actor(&auth, None);
    spawn_audit_log(&state.pool, AuditEntry {
        rule_id: None, action: "user_delete".to_string(), actor,
        success: true, message: Some(format!("User {} deleted", id)),
        detail: Some(json!({"id": id})),
    });
    Ok(Json(json!({"deleted": true})))
}
