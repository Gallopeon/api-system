use std::sync::Arc;
use axum::extract::State;
use axum::http::HeaderMap;
use axum::response::IntoResponse;
use axum::{Extension, Json};
use chrono::{DateTime, Utc};
use serde_json::json;
use sqlx::Row;
use uuid::Uuid;

use crate::AppState;
use crate::types::*;
use crate::auth::*;
use super::common::spawn_audit_log;
use super::totp::verify_login_totp;

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

    let user_group: String = row.try_get("user_group").unwrap_or_else(|_| "user".to_string());
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

    // Load permissions before JWT creation so they are embedded in the claims
    let permissions = load_user_permissions(&state.pool, &payload.username).await.unwrap_or_default();

    let (token, jti) = create_jwt(&payload.username, None, &state.auth.jwt_secret, 86400, &user_group, &role, &permissions)?;

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
            let (restricted_token, _) = create_jwt(&payload.username, None, &state.auth.jwt_secret, 900, &user_group, &role, &permissions)?;
            return Ok(Json(LoginResponse {
                token: restricted_token,
                user: row_to_user(&row),
                permissions: permissions.clone(),
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

        // Zero-trust: if risk score is very high (> 70), TOTP is mandatory regardless of enrollment status
        if risk.score > 70 && payload.totp_code.is_none() {
            let totp_enabled: i8 = sqlx::query_scalar("SELECT enabled FROM user_totp WHERE user_id = ?")
                .bind(&user_id).fetch_optional(&state.pool).await?.unwrap_or(0);

            if totp_enabled == 1 {
                 return Err(AppError::Unauthorized("High risk login detected. TOTP verification required.".to_string()));
            }
            // If TOTP not enrolled, fall through to totp_required restricted token below
        }
    }

    Ok(Json(LoginResponse {
        token,
        user: row_to_user(&row),
        permissions,
        risk: if risk.is_suspicious {
            Some(LoginRisk { score: risk.score, is_suspicious: true, reasons: risk.reasons.clone() })
        } else { None },
    }))
}

pub async fn get_my_profile(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserSelf)?;
    let row = sqlx::query(
        "SELECT id, username, password_hash, email, display_name, avatar_url, role, status, user_group, permission_template_id, custom_permissions, last_login_at, created_at, updated_at FROM users WHERE username = ?"
    ).bind(&auth.subject).fetch_optional(&state.pool).await?
    .ok_or_else(|| AppError::NotFound("user not found".to_string()))?;
    Ok(Json(row_to_user(&row)))
}

pub async fn update_my_profile(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<serde_json::Value>) -> Result<impl IntoResponse, AppError> {
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

// ==================== Helpers ====================

pub fn row_to_user(row: &sqlx::mysql::MySqlRow) -> UserResponse {
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
