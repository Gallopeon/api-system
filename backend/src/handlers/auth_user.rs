use std::sync::Arc;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::IntoResponse;
use axum::{Extension, Json};
use chrono::{DateTime, Utc};
use serde_json::{json, Value};
use sqlx::Row;
use uuid::Uuid;

use crate::AppState;
use crate::types::*;
use crate::auth::*;
use super::common::spawn_audit_log;

// ==================== Auth / User ====================

pub async fn login(State(state): State<Arc<AppState>>, headers: HeaderMap, Json(payload): Json<LoginRequest>) -> Result<impl IntoResponse, AppError> {
    let row = sqlx::query(
        "SELECT id, username, password_hash, email, display_name, avatar_url, role, status, user_group, failed_login_attempts, locked_until, last_login_at, created_at, updated_at FROM users WHERE username = ?"
    ).bind(&payload.username).fetch_optional(&state.pool).await?
    .ok_or_else(|| {
        let pool = state.pool.clone();
        let username = payload.username.clone();
        tokio::spawn(async move {
            if let Err(e) = sqlx::query(
                "INSERT INTO login_history (username_attempt, success, failure_reason) VALUES (?, 0, 'user not found')"
            ).bind(&username).execute(&pool).await {
                tracing::warn!(error = %e, username = %username, "failed to record non-existent user login attempt");
            }
        });
        AppError::Unauthorized("invalid credentials".to_string())
    })?;

    let status: String = row.try_get("status").unwrap_or_else(|_| "active".to_string());
    if status != "active" {
        return Err(AppError::Unauthorized("account is disabled".to_string()));
    }

    let locked_until: Option<chrono::DateTime<chrono::Utc>> = row.try_get("locked_until").ok();
    if let Some(locked) = locked_until {
        if chrono::Utc::now() < locked {
            return Err(AppError::Unauthorized("account is temporarily locked due to too many failed attempts".to_string()));
        }
    }

    let password_hash: String = row.try_get("password_hash").unwrap_or_default();
    let ok = bcrypt::verify(&payload.password, &password_hash).unwrap_or(false);
    let user_id: String = row.try_get("id").unwrap_or_default();

    if !ok {
        // Increment failed login attempts and record in history
        sqlx::query("UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = ?")
            .bind(&user_id).execute(&state.pool).await?;
        let failed_count: i32 = sqlx::query_scalar("SELECT failed_login_attempts FROM users WHERE id = ?")
            .bind(&user_id).fetch_one(&state.pool).await?;
        if failed_count >= 5 {
            sqlx::query("UPDATE users SET locked_until = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE id = ?")
                .bind(&user_id).execute(&state.pool).await?;
        }
        let _ = sqlx::query(
            "INSERT INTO login_history (user_id, username_attempt, success, failure_reason) VALUES (?, ?, 0, 'wrong password')"
        ).bind(&user_id).bind(&payload.username).execute(&state.pool).await;
        return Err(AppError::Unauthorized("invalid credentials".to_string()));
    }

    // TOTP check: if user has TOTP enabled, require and validate the code
    verify_login_totp(&state.pool, &user_id, payload.totp_code.as_deref()).await?;

    let user_group: String = row.try_get("user_group").unwrap_or_else(|_| "admin_group".to_string());
    let role: String = row.try_get("role").unwrap_or_else(|_| "viewer".to_string());

    // Extract client IP and UA earlier for risk assessment
    let client_ip = headers.get("x-forwarded-for")
        .or_else(|| headers.get("x-real-ip"))
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown");
    let user_agent = headers.get("user-agent").and_then(|v| v.to_str().ok());
    let ua_str = user_agent.unwrap_or("");

    // Zero-trust: assess login risk
    let risk = crate::engine::risk::assess_login_risk(
        &state.pool, &user_id, client_ip,
        payload.device_fingerprint.as_deref(),
        Some(ua_str),
    ).await;

    let (token, jti) = create_jwt(&payload.username, None, &state.auth.jwt_secret, 86400, &user_group, &role)?;

    // Reset failed attempts on success, update last login, record successful login with risk score
    sqlx::query("UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE id = ?")
        .bind(&user_id).execute(&state.pool).await?;
    let _ = sqlx::query(
        "INSERT INTO login_history (user_id, username_attempt, success, device_fingerprint, risk_score, is_suspicious) VALUES (?, ?, 1, ?, ?, ?)"
    ).bind(&user_id).bind(&payload.username)
     .bind(&payload.device_fingerprint)
     .bind(risk.score as i32)
     .bind(risk.is_suspicious)
     .execute(&state.pool).await;
    let session_id = Uuid::new_v4().to_string();
    let _ = sqlx::query(
        "INSERT INTO user_sessions (id, user_id, token_jti, token_expires_at, client_ip, user_agent) VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 86400 SECOND), ?, ?)"
    ).bind(&session_id).bind(&user_id).bind(&jti).bind(client_ip).bind(user_agent).execute(&state.pool).await;

    // If suspicious, force TOTP enrollment if not already enabled
    if risk.is_suspicious {
        let totp_enabled: Option<i8> = sqlx::query_scalar(
            "SELECT enabled FROM user_totp WHERE user_id = ?"
        ).bind(&user_id).fetch_optional(&state.pool).await.ok().flatten();
        if totp_enabled.unwrap_or(0) == 0 {
            // Force TOTP: return a restricted token with short TTL + totp_required flag
            let (restricted_token, _) = create_jwt(&payload.username, None, &state.auth.jwt_secret, 900, &user_group, &role)?;
            return Ok(Json(LoginResponse {
                token: restricted_token,
                user: row_to_user(&row),
                risk: Some(LoginRisk { score: risk.score, is_suspicious: true, reasons: risk.reasons }),
            }));
        }
    }

    // Dispatch security notification for suspicious logins
    if risk.is_suspicious {
        spawn_audit_log(&state.pool, AuditEntry {
            rule_id: None,
            action: "security_alert".to_string(),
            actor: payload.username.clone(),
            success: true,
            message: Some(format!("Suspicious login detected for '{}' (risk score {})", payload.username, risk.score)),
            detail: Some(json!({"user_id": user_id, "risk_score": risk.score, "reasons": risk.reasons, "ip": client_ip})),
        });
    }

    Ok(Json(LoginResponse {
        token,
        user: row_to_user(&row),
        risk: if risk.is_suspicious {
            Some(LoginRisk { score: risk.score, is_suspicious: true, reasons: risk.reasons.clone() })
        } else { None },
    }))
}

fn build_totp_from_db(encoded_secret: &str, account_name: &str) -> Result<totp_rs::TOTP, AppError> {
    let raw_secret = base32_decode(encoded_secret)
        .ok_or_else(|| AppError::Internal("invalid TOTP secret encoding".to_string()))?;
    totp_rs::TOTP::new(
        totp_rs::Algorithm::SHA1, 6, 1, 30, raw_secret,
        Some("API Control Plane".to_string()),
        account_name.to_string(),
    ).map_err(|e| AppError::Internal(format!("TOTP init error: {}", e)))
}

async fn verify_login_totp(pool: &sqlx::MySqlPool, user_id: &str, totp_code: Option<&str>) -> Result<(), AppError> {
    let totp_row = sqlx::query("SELECT secret, enabled FROM user_totp WHERE user_id = ?")
        .bind(user_id).fetch_optional(pool).await?;
    let Some(totp_row) = totp_row else { return Ok(()); };
    let enabled: i8 = totp_row.try_get("enabled").unwrap_or(0);
    if enabled == 0 { return Ok(()); }

    let code = totp_code.ok_or_else(||
        AppError::Unauthorized("TOTP is enabled for this account; provide totp_code".to_string())
    )?;

    let encoded: String = totp_row.try_get("secret").unwrap_or_default();
    let totp = build_totp_from_db(&encoded, user_id)?;
    let verified = totp.check_current(code)
        .map_err(|e| AppError::Internal(format!("TOTP check error: {}", e)))?;

    if !verified {
        return Err(AppError::Unauthorized("invalid TOTP code".to_string()));
    }
    Ok(())
}

pub async fn get_my_profile(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserSelf)?;
    let row = sqlx::query(
        "SELECT id, username, password_hash, email, display_name, avatar_url, role, status, user_group, permission_template_id, custom_permissions, last_login_at, created_at, updated_at FROM users WHERE username = ?"
    ).bind(&auth.subject).fetch_optional(&state.pool).await?
    .ok_or_else(|| AppError::NotFound("user not found".to_string()))?;
    Ok(Json(row_to_user(&row)))
}

pub async fn update_my_profile(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<Value>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserSelf)?;
    if let Some(display_name) = payload.get("display_name").and_then(|v| v.as_str()) {
        sqlx::query("UPDATE users SET display_name = ? WHERE username = ?").bind(display_name).bind(&auth.subject).execute(&state.pool).await?;
    }
    if let Some(email) = payload.get("email").and_then(|v| v.as_str()) {
        sqlx::query("UPDATE users SET email = ? WHERE username = ?").bind(email).bind(&auth.subject).execute(&state.pool).await?;
    }
    if let Some(avatar_url) = payload.get("avatar_url").and_then(|v| v.as_str()) {
        sqlx::query("UPDATE users SET avatar_url = ? WHERE username = ?").bind(avatar_url).bind(&auth.subject).execute(&state.pool).await?;
    }
    let row = sqlx::query(
        "SELECT id, username, password_hash, email, display_name, avatar_url, role, status, user_group, permission_template_id, custom_permissions, last_login_at, created_at, updated_at FROM users WHERE username = ?"
    ).bind(&auth.subject).fetch_optional(&state.pool).await?
    .ok_or_else(|| AppError::NotFound("user not found".to_string()))?;
    Ok(Json(row_to_user(&row)))
}

pub async fn change_my_password(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<ChangePasswordRequest>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserSelf)?;
    validate_password_strength(&payload.new_password)?;
    let current_hash: String = sqlx::query_scalar("SELECT password_hash FROM users WHERE username = ?")
        .bind(&auth.subject).fetch_optional(&state.pool).await?
        .ok_or_else(|| AppError::NotFound("user not found".to_string()))?;
    let ok = bcrypt::verify(&payload.current_password, &current_hash).unwrap_or(false);
    if !ok {
        return Err(AppError::Unauthorized("current password is incorrect".to_string()));
    }
    let new_hash = bcrypt::hash(&payload.new_password, 12).map_err(|e| AppError::BadRequest(format!("bcrypt: {}", e)))?;
    sqlx::query("UPDATE users SET password_hash = ? WHERE username = ?").bind(&new_hash).bind(&auth.subject).execute(&state.pool).await?;
    spawn_audit_log(&state.pool, AuditEntry {
        rule_id: None, action: "user_password_change".to_string(), actor: auth.subject.clone(),
        success: true, message: Some(format!("User '{}' changed password", auth.subject)),
        detail: None,
    });
    Ok(Json(json!({"changed": true})))
}

pub async fn list_my_sessions(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserSelf)?;
    let current_jti = auth.jti.clone();
    let rows = sqlx::query("SELECT id, token_jti, token_expires_at, client_ip, user_agent, revoked, created_at FROM user_sessions WHERE user_id = (SELECT id FROM users WHERE username = ?) AND revoked = 0 AND token_expires_at > UTC_TIMESTAMP()")
        .bind(&auth.subject).fetch_all(&state.pool).await?;
    let items: Vec<Value> = rows.iter().map(|r| {
        let jti: Option<String> = r.try_get("token_jti").ok().flatten();
        let is_current = current_jti.as_ref().and_then(|c| jti.as_ref().map(|j| c == j)).unwrap_or(false);
        let expires_at: DateTime<Utc> = r.try_get("token_expires_at").unwrap_or_else(|_| Utc::now());
        let created_at: DateTime<Utc> = r.try_get("created_at").unwrap_or_else(|_| Utc::now());
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
    sqlx::query("UPDATE user_sessions SET revoked = 1 WHERE id = ? AND user_id = (SELECT id FROM users WHERE username = ?)")
        .bind(&id).bind(&auth.subject).execute(&state.pool).await?;
    // Blacklist the JTI in Redis so the middleware rejects it immediately
    if let Some(jti) = jti {
        if let Ok(mut conn) = state.redis.get_multiplexed_async_connection().await {
            let _: Result<(), _> = redis::cmd("SETEX")
                .arg(format!("jti:revoked:{}", jti))
                .arg(86400_i64) // TTL matches JWT expiry
                .arg("1")
                .query_async(&mut conn)
                .await;
        }
    }
    Ok(Json(json!({"revoked": true})))
}

pub async fn list_my_login_history(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserSelf)?;
    let rows = sqlx::query("SELECT id, username_attempt, client_ip, user_agent, success, failure_reason, created_at FROM login_history WHERE user_id = (SELECT id FROM users WHERE username = ?) ORDER BY created_at DESC LIMIT 50")
        .bind(&auth.subject).fetch_all(&state.pool).await?;
    let items: Vec<Value> = rows.iter().map(|r| {
        let created_at: DateTime<Utc> = r.try_get("created_at").unwrap_or_else(|_| Utc::now());
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
        let pattern = format!("%{}%", search);
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
    let hash = bcrypt::hash(&payload.password, 12).map_err(|e| AppError::BadRequest(format!("bcrypt: {}", e)))?;
    let user_group = payload.user_group.as_deref().unwrap_or("admin_group");
    let template_id = payload.permission_template_id.as_deref();
    let custom_perms = payload.custom_permissions.as_ref()
        .map(|v| serde_json::to_string(v).unwrap_or_default());
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
    })).unwrap_or_default();
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
    ensure_permission(&auth, Permission::UserManage)?;
    let row = sqlx::query(
        "SELECT id, username, password_hash, email, display_name, avatar_url, role, status, user_group, permission_template_id, custom_permissions, last_login_at, created_at, updated_at FROM users WHERE id = ?"
    ).bind(&id).fetch_optional(&state.pool).await?
    .ok_or_else(|| AppError::NotFound(format!("user {} not found", id)))?;
    Ok(Json(row_to_user(&row)))
}

pub async fn update_user(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>, Json(payload): Json<UpdateUserRequest>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserManage)?;
    let mut need_revoke = false;
    if let Some(ref status) = payload.status {
        sqlx::query("UPDATE users SET status = ? WHERE id = ?").bind(status).bind(&id).execute(&state.pool).await?;
        if status == "disabled" {
            need_revoke = true;
        }
    }
    if let Some(ref display_name) = payload.display_name {
        sqlx::query("UPDATE users SET display_name = ? WHERE id = ?").bind(display_name).bind(&id).execute(&state.pool).await?;
    }
    if let Some(ref email) = payload.email {
        sqlx::query("UPDATE users SET email = ? WHERE id = ?").bind(email).bind(&id).execute(&state.pool).await?;
    }
    if let Some(ref template_id) = payload.permission_template_id {
        sqlx::query("UPDATE users SET permission_template_id = ? WHERE id = ?").bind(template_id).bind(&id).execute(&state.pool).await?;
        need_revoke = true;
    }
    if let Some(ref custom_perms) = payload.custom_permissions {
        let perms_json = serde_json::to_string(custom_perms).unwrap_or_default();
        sqlx::query("UPDATE users SET custom_permissions = ? WHERE id = ?").bind(&perms_json).bind(&id).execute(&state.pool).await?;
        need_revoke = true;
    }
    if let Some(ref group) = payload.user_group {
        sqlx::query("UPDATE users SET user_group = ? WHERE id = ?").bind(group).bind(&id).execute(&state.pool).await?;
        need_revoke = true;
    }
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

async fn revoke_all_user_sessions(pool: &sqlx::MySqlPool, redis: &redis::Client, user_id: &str) {
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

pub async fn get_totp_status(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserSelf)?;
    let row = sqlx::query("SELECT enabled FROM user_totp WHERE user_id = (SELECT id FROM users WHERE username = ?)")
        .bind(&auth.subject).fetch_optional(&state.pool).await?;
    let enabled = row.map_or(0, |r| r.try_get::<i8, _>("enabled").unwrap_or(0));
    Ok(Json(json!({ "enabled": enabled == 1 })))
}

pub async fn setup_totp(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserSelf)?;
    let raw_secret: Vec<u8> = (0..20).map(|_| rand::random::<u8>()).collect();
    let encoded = base32_encode(&raw_secret);
    let totp = totp_rs::TOTP::new(
        totp_rs::Algorithm::SHA1, 6, 1, 30, raw_secret,
        Some("API Control Plane".to_string()),
        auth.subject.clone(),
    ).map_err(|e| AppError::BadRequest(format!("TOTP setup error: {}", e)))?;
    let otpauth_url = totp.get_url();
    let svg = qrcode_generator::to_svg_to_string(&otpauth_url, qrcode_generator::QrCodeEcc::Medium, 256, None::<&str>)
        .map_err(|e| AppError::Internal(format!("QR code generation error: {}", e)))?;
    let qr_code_url = format!("data:image/svg+xml;base64,{}", base64_encode(svg.as_bytes()));
    let user_id: String = sqlx::query_scalar("SELECT id FROM users WHERE username = ?")
        .bind(&auth.subject).fetch_optional(&state.pool).await?
        .ok_or_else(|| AppError::NotFound("user not found".to_string()))?;
    sqlx::query("INSERT INTO user_totp (user_id, secret, enabled) VALUES (?, ?, 0) ON DUPLICATE KEY UPDATE secret = ?, enabled = 0")
        .bind(&user_id).bind(&encoded).bind(&encoded).execute(&state.pool).await?;
    Ok(Json(TotpSetupResponse { secret: encoded, qr_code_url: Some(qr_code_url) }))
}

pub async fn verify_totp(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<TotpVerifyRequest>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserSelf)?;
    let encoded: String = sqlx::query_scalar(
        "SELECT secret FROM user_totp WHERE user_id = (SELECT id FROM users WHERE username = ?)"
    ).bind(&auth.subject).fetch_optional(&state.pool).await?
    .ok_or_else(|| AppError::NotFound("TOTP not set up".to_string()))?;

    let totp = build_totp_from_db(&encoded, &auth.subject)?;
    let verified = totp.check_current(&payload.code)
        .map_err(|e| AppError::BadRequest(format!("TOTP check error: {}", e)))?;
    if verified {
        sqlx::query("UPDATE user_totp SET enabled = 1 WHERE user_id = (SELECT id FROM users WHERE username = ?)")
            .bind(&auth.subject).execute(&state.pool).await?;
        Ok(Json(json!({"verified": true})))
    } else {
        Err(AppError::BadRequest("invalid TOTP code".to_string()))
    }
}

pub async fn disable_totp(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserSelf)?;
    sqlx::query("UPDATE user_totp SET enabled = 0 WHERE user_id = (SELECT id FROM users WHERE username = ?)")
        .bind(&auth.subject).execute(&state.pool).await?;
    Ok(Json(json!({"disabled": true})))
}

fn base32_encode(data: &[u8]) -> String {
    const ALPHABET: &[u8; 32] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let mut out = String::new();
    let mut buf = 0u32;
    let mut bits = 0u8;
    for &byte in data {
        buf = (buf << 8) | byte as u32;
        bits += 8;
        while bits >= 5 {
            bits -= 5;
            out.push(ALPHABET[((buf >> bits) & 0x1F) as usize] as char);
        }
    }
    if bits > 0 {
        out.push(ALPHABET[((buf << (5 - bits)) & 0x1F) as usize] as char);
    }
    while out.len() % 8 != 0 {
        out.push('=');
    }
    out
}

fn base64_encode(data: &[u8]) -> String {
    const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((data.len() + 2) / 3 * 4);
    let mut chunks = data.chunks_exact(3);
    for chunk in &mut chunks {
        let buf = ((chunk[0] as u32) << 16) | ((chunk[1] as u32) << 8) | (chunk[2] as u32);
        out.push(ALPHABET[((buf >> 18) & 0x3F) as usize] as char);
        out.push(ALPHABET[((buf >> 12) & 0x3F) as usize] as char);
        out.push(ALPHABET[((buf >> 6) & 0x3F) as usize] as char);
        out.push(ALPHABET[(buf & 0x3F) as usize] as char);
    }
    let rem = chunks.remainder();
    if !rem.is_empty() {
        let buf = if rem.len() == 1 {
            (rem[0] as u32) << 16
        } else {
            ((rem[0] as u32) << 16) | ((rem[1] as u32) << 8)
        };
        out.push(ALPHABET[((buf >> 18) & 0x3F) as usize] as char);
        out.push(ALPHABET[((buf >> 12) & 0x3F) as usize] as char);
        if rem.len() == 2 {
            out.push(ALPHABET[((buf >> 6) & 0x3F) as usize] as char);
        } else {
            out.push('=');
        }
        out.push('=');
    }
    out
}

fn base32_decode(encoded: &str) -> Option<Vec<u8>> {
    let encoded = encoded.trim_end_matches('=').to_uppercase();
    let mut out = Vec::new();
    let mut buf = 0u32;
    let mut bits = 0u8;
    for c in encoded.chars() {
        let val = match c {
            'A'..='Z' => c as u8 - b'A',
            '2'..='7' => c as u8 - b'2' + 26,
            _ => return None,
        };
        buf = (buf << 5) | val as u32;
        bits += 5;
        if bits >= 8 {
            bits -= 8;
            out.push((buf >> bits) as u8);
        }
    }
    Some(out)
}

pub async fn get_my_preferences(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserSelf)?;
    let row = sqlx::query("SELECT preferences FROM users WHERE username = ?")
        .bind(&auth.subject).fetch_optional(&state.pool).await?;
    let stored: Option<serde_json::Value> = row.and_then(|r| r.try_get::<serde_json::Value, _>("preferences").ok());
    Ok(Json(PreferencesResponse {
        user_id: auth.subject.clone(),
        theme: stored.as_ref().and_then(|v| v.get("theme").and_then(|t| t.as_str())).unwrap_or("system").to_string(),
        lang: stored.as_ref().and_then(|v| v.get("lang").and_then(|l| l.as_str())).unwrap_or("zh").to_string(),
        notifications: stored.as_ref().and_then(|v| v.get("notifications").cloned()),
    }))
}

pub async fn update_my_preferences(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<UpdatePreferencesRequest>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserSelf)?;

    // Merge with existing preferences so partial updates don't wipe other fields
    let existing_row = sqlx::query("SELECT preferences FROM users WHERE username = ?")
        .bind(&auth.subject).fetch_optional(&state.pool).await?;
    let existing: Option<serde_json::Value> = existing_row.and_then(|r| r.try_get::<serde_json::Value, _>("preferences").ok());
    let mut merged: serde_json::Value = existing.unwrap_or_default();

    if let Some(theme) = &payload.theme {
        merged["theme"] = serde_json::Value::String(theme.clone());
    }
    if let Some(lang) = &payload.lang {
        merged["lang"] = serde_json::Value::String(lang.clone());
    }
    if let Some(notifications) = &payload.notifications {
        let new_val = serde_json::to_value(notifications).unwrap_or_default();
        if let Some(existing_notif) = merged.get("notifications").and_then(|v| v.as_object()) {
            let mut merged_notif = existing_notif.clone();
            if let Some(new_obj) = new_val.as_object() {
                for (channel_key, channel_val) in new_obj {
                    if let (Some(existing_ch), Some(new_ch)) = (
                        merged_notif.get(channel_key).and_then(|v| v.as_object()),
                        channel_val.as_object()
                    ) {
                        let mut merged_ch = existing_ch.clone();
                        for (k, v) in new_ch { merged_ch.insert(k.clone(), v.clone()); }
                        merged_notif.insert(channel_key.clone(), serde_json::Value::Object(merged_ch));
                    } else {
                        merged_notif.insert(channel_key.clone(), channel_val.clone());
                    }
                }
            }
            merged["notifications"] = serde_json::Value::Object(merged_notif);
        } else {
            merged["notifications"] = new_val;
        }
    }

    let prefs_json = serde_json::to_string(&merged).unwrap_or_default();
    sqlx::query("UPDATE users SET preferences = ? WHERE username = ?").bind(&prefs_json).bind(&auth.subject).execute(&state.pool).await?;
    Ok(Json(PreferencesResponse {
        user_id: auth.subject.clone(),
        theme: merged.get("theme").and_then(|v| v.as_str()).unwrap_or("system").to_string(),
        lang: merged.get("lang").and_then(|v| v.as_str()).unwrap_or("zh").to_string(),
        notifications: merged.get("notifications").cloned(),
    }))
}

// ==================== Devices ====================

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
    sqlx::query("UPDATE user_devices SET trust_level = 'trusted' WHERE id = ? AND user_id = (SELECT id FROM users WHERE username = ?)")
        .bind(&device_id).bind(&auth.subject).execute(&state.pool).await?;
    Ok(Json(json!({"trusted": true})))
}

pub async fn revoke_device(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(device_id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserSelf)?;
    sqlx::query("DELETE FROM user_devices WHERE id = ? AND user_id = (SELECT id FROM users WHERE username = ?)")
        .bind(&device_id).bind(&auth.subject).execute(&state.pool).await?;
    Ok(Json(json!({"revoked": true})))
}

// ==================== Helpers ====================

fn row_to_user(row: &sqlx::mysql::MySqlRow) -> UserResponse {
    let created_at: DateTime<Utc> = row.try_get("created_at").unwrap_or(DateTime::UNIX_EPOCH);
    let updated_at: DateTime<Utc> = row.try_get("updated_at").unwrap_or(DateTime::UNIX_EPOCH);
    let last_login: Option<DateTime<Utc>> = row.try_get("last_login_at").ok();
    let custom_raw: Option<String> = row.try_get("custom_permissions").ok().flatten();
    let custom_permissions = custom_raw.and_then(|s| serde_json::from_str(&s).ok());
    UserResponse {
        id: row.try_get("id").unwrap_or_default(),
        username: row.try_get("username").unwrap_or_default(),
        email: row.try_get("email").ok(),
        display_name: row.try_get("display_name").ok(),
        avatar_url: row.try_get("avatar_url").ok(),
        status: row.try_get("status").unwrap_or_else(|_| "active".to_string()),
        role: row.try_get("role").unwrap_or_else(|_| "viewer".to_string()),
        permission_template_id: row.try_get("permission_template_id").ok().flatten(),
        custom_permissions,
        user_group: row.try_get("user_group").ok().flatten(),
        last_login_at: last_login.map(|d| d.to_rfc3339()),
        created_at: created_at.to_rfc3339(),
        updated_at: updated_at.to_rfc3339(),
    }
}

