use std::sync::Arc;
use axum::extract::{Path, State};
use axum::response::IntoResponse;
use axum::{Extension, Json};
use chrono::{DateTime, Utc};
use serde_json::{json, Value};
use sqlx::Row;

use crate::AppState;
use crate::auth::*;

pub async fn list_my_sessions(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserSelf)?;
    let current_jti = auth.jti.clone();
    let rows = sqlx::query("SELECT id, token_jti, token_expires_at, client_ip, user_agent, revoked, created_at FROM user_sessions WHERE user_id = (SELECT id FROM users WHERE username = ?) AND revoked = 0 AND token_expires_at > UTC_TIMESTAMP()")
        .bind(&auth.subject).fetch_all(&state.pool).await?;
    let items: Vec<Value> = rows.iter().map(|r| {
        let jti: Option<String> = r.try_get("token_jti").ok().flatten();
        let is_current = current_jti.as_ref().and_then(|c| jti.as_ref().map(|j| c == j)).unwrap_or(false);
        let expires_at: DateTime<Utc> = r.try_get("token_expires_at").unwrap_or(DateTime::UNIX_EPOCH);
        let created_at: DateTime<Utc> = r.try_get("created_at").unwrap_or(DateTime::UNIX_EPOCH);
        json!({
            "id": r.try_get::<String,_>("id").unwrap_or_default(),
            "client_ip": r.try_get::<String,_>("client_ip").unwrap_or_default(),
            "user_agent": r.try_get::<String,_>("user_agent").unwrap_or_default(),
            "expires_at": expires_at.to_rfc3339(),
            "created_at": created_at.to_rfc3339(),
            "current": is_current,
        })
    }).collect();
    Ok(Json(json!({"items": items})))
}

pub async fn revoke_session(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserSelf)?;
    // Get the JTI before revoking so we can blacklist it in Redis
    let jti: Option<String> = sqlx::query_scalar(
        "SELECT token_jti FROM user_sessions WHERE id = ? AND user_id = (SELECT id FROM users WHERE username = ?)"
    ).bind(&id).bind(&auth.subject).fetch_optional(&state.pool).await?.flatten();
    let result = sqlx::query("UPDATE user_sessions SET revoked = 1 WHERE id = ? AND user_id = (SELECT id FROM users WHERE username = ?)")
        .bind(&id).bind(&auth.subject).execute(&state.pool).await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("session not found".into()));
    }
    // Blacklist the JTI in Redis so the middleware rejects it immediately (best-effort)
    if let Some(jti) = jti {
        match state.redis.get_multiplexed_async_connection().await {
            Ok(mut conn) => {
                if let Err(e) = redis::cmd("SETEX")
                    .arg(format!("jti:revoked:{}", jti))
                    .arg(86400_i64)
                    .arg("1")
                    .query_async::<()>(&mut conn)
                    .await
                {
                    tracing::warn!(%jti, error = %e, "failed to blacklist revoked JTI in Redis; token will expire naturally");
                }
            }
            Err(e) => {
                tracing::warn!(%jti, error = %e, "Redis unavailable during session revocation; token will expire naturally");
            }
        }
    }
    Ok(Json(json!({"revoked": true})))
}

pub async fn list_my_login_history(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserSelf)?;
    let rows = sqlx::query("SELECT id, username_attempt, client_ip, user_agent, success, failure_reason, created_at FROM login_history WHERE user_id = (SELECT id FROM users WHERE username = ?) ORDER BY created_at DESC LIMIT 50")
        .bind(&auth.subject).fetch_all(&state.pool).await?;
    let items: Vec<Value> = rows.iter().map(|r| {
        let created_at: DateTime<Utc> = r.try_get("created_at").unwrap_or(DateTime::UNIX_EPOCH);
        json!({
            "id": r.try_get::<i64,_>("id").unwrap_or(0),
            "username_attempt": r.try_get::<String,_>("username_attempt").unwrap_or_default(),
            "client_ip": r.try_get::<String,_>("client_ip").unwrap_or_default(),
            "user_agent": r.try_get::<String,_>("user_agent").unwrap_or_default(),
            "success": r.try_get::<i8,_>("success").unwrap_or(0) == 1,
            "failure_reason": r.try_get::<String,_>("failure_reason").unwrap_or_default(),
            "created_at": created_at.to_rfc3339(),
        })
    }).collect();
    Ok(Json(json!({"items": items})))
}

pub async fn list_my_devices(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserSelf)?;
    let rows = sqlx::query(
        "SELECT id, fingerprint_hash, device_name, user_agent_hash, last_ip, trust_level, is_trusted, created_at, last_seen_at FROM user_devices WHERE user_id = (SELECT id FROM users WHERE username = ?) ORDER BY last_seen_at DESC"
    )
    .bind(&auth.subject)
    .fetch_all(&state.pool).await?;
    let items: Vec<Value> = rows.iter().map(|r| {
        let created_at: DateTime<Utc> = r.try_get("created_at").unwrap_or(DateTime::UNIX_EPOCH);
        let last_seen: DateTime<Utc> = r.try_get("last_seen_at").unwrap_or(DateTime::UNIX_EPOCH);
        json!({
            "id": r.try_get::<String,_>("id").unwrap_or_default(),
            "fingerprint_hash": r.try_get::<String,_>("fingerprint_hash").unwrap_or_default(),
            "device_name": r.try_get::<String,_>("device_name").unwrap_or_default(),
            "last_ip": r.try_get::<String,_>("last_ip").unwrap_or_default(),
            "trust_level": r.try_get::<String,_>("trust_level").unwrap_or_default(),
            "is_trusted": r.try_get::<i8,_>("is_trusted").unwrap_or(0) == 1,
            "first_seen": created_at.to_rfc3339(),
            "last_seen": last_seen.to_rfc3339(),
        })
    }).collect();
    Ok(Json(json!({"items": items})))
}

pub async fn trust_device(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(device_id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserSelf)?;
    let result = sqlx::query("UPDATE user_devices SET trust_level = 'trusted' WHERE id = ? AND user_id = (SELECT id FROM users WHERE username = ?)")
        .bind(&device_id).bind(&auth.subject).execute(&state.pool).await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("device not found".into()));
    }
    Ok(Json(json!({"trusted": true})))
}

pub async fn revoke_device(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(device_id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserSelf)?;
    let result = sqlx::query("DELETE FROM user_devices WHERE id = ? AND user_id = (SELECT id FROM users WHERE username = ?)")
        .bind(&device_id).bind(&auth.subject).execute(&state.pool).await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("device not found".into()));
    }
    Ok(Json(json!({"revoked": true})))
}
