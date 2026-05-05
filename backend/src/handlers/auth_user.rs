use std::sync::Arc;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::{Extension, Json};
use chrono::{DateTime, Utc};
use serde_json::{json, Value};
use sqlx::Row;
use uuid::Uuid;

use crate::AppState;
use crate::types::*;
use crate::auth::*;

// ==================== Auth / User ====================

pub async fn login(State(state): State<Arc<AppState>>, Json(payload): Json<LoginRequest>) -> Result<impl IntoResponse, AppError> {
    let row = sqlx::query(
        "SELECT id, username, password_hash, email, display_name, avatar_url, role, status, failed_login_attempts, locked_until, last_login_at, created_at, updated_at FROM users WHERE username = ?"
    ).bind(&payload.username).fetch_optional(&state.pool).await?
    .ok_or_else(|| {
        // Record failed login for non-existent user
        let pool = state.pool.clone();
        let username = payload.username.clone();
        tokio::spawn(async move {
            let _ = sqlx::query(
                "INSERT INTO login_history (username_attempt, success, failure_reason) VALUES (?, 0, 'user not found')"
            ).bind(&username).execute(&pool).await;
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

    let role_str: String = row.try_get("role").unwrap_or_else(|_| "viewer".to_string());
    let role = parse_role(&role_str);

    let token = create_jwt(&payload.username, role, None, &state.auth.jwt_secret, 86400)?;

    // Reset failed attempts on success, update last login, record successful login
    sqlx::query("UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE id = ?")
        .bind(&user_id).execute(&state.pool).await?;
    let _ = sqlx::query(
        "INSERT INTO login_history (user_id, username_attempt, success) VALUES (?, ?, 1)"
    ).bind(&user_id).bind(&payload.username).execute(&state.pool).await;

    Ok(Json(LoginResponse { token, user: row_to_user(&row) }))
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
        "SELECT id, username, password_hash, email, display_name, avatar_url, role, status, last_login_at, created_at, updated_at FROM users WHERE username = ?"
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
    Ok(Json(json!({"updated": true})))
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
    Ok(Json(json!({"changed": true})))
}

pub async fn list_my_sessions(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserSelf)?;
    let rows = sqlx::query("SELECT id, token_jti, token_expires_at, client_ip, user_agent, revoked, created_at FROM user_sessions WHERE user_id = (SELECT id FROM users WHERE username = ?) AND revoked = 0 AND token_expires_at > NOW()")
        .bind(&auth.subject).fetch_all(&state.pool).await?;
    let items: Vec<Value> = rows.iter().map(|r| json!({
        "id": r.try_get::<String,_>("id").unwrap_or_default(),
        "client_ip": r.try_get::<String,_>("client_ip").unwrap_or_default(),
        "user_agent": r.try_get::<String,_>("user_agent").unwrap_or_default(),
        "expires_at": r.try_get::<String,_>("token_expires_at").unwrap_or_default(),
        "current": false,
    })).collect();
    Ok(Json(json!({"items": items})))
}

pub async fn revoke_session(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserSelf)?;
    sqlx::query("UPDATE user_sessions SET revoked = 1 WHERE id = ? AND user_id = (SELECT id FROM users WHERE username = ?)")
        .bind(&id).bind(&auth.subject).execute(&state.pool).await?;
    Ok(Json(json!({"revoked": true})))
}

pub async fn list_my_login_history(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserSelf)?;
    let rows = sqlx::query("SELECT id, username_attempt, client_ip, user_agent, success, failure_reason, created_at FROM login_history WHERE user_id = (SELECT id FROM users WHERE username = ?) ORDER BY created_at DESC LIMIT 50")
        .bind(&auth.subject).fetch_all(&state.pool).await?;
    let items: Vec<Value> = rows.iter().map(|r| json!({
        "id": r.try_get::<i64,_>("id").unwrap_or(0),
        "username_attempt": r.try_get::<String,_>("username_attempt").unwrap_or_default(),
        "client_ip": r.try_get::<String,_>("client_ip").unwrap_or_default(),
        "user_agent": r.try_get::<String,_>("user_agent").unwrap_or_default(),
        "success": r.try_get::<i8,_>("success").unwrap_or(0) == 1,
        "failure_reason": r.try_get::<String,_>("failure_reason").unwrap_or_default(),
        "created_at": r.try_get::<String,_>("created_at").unwrap_or_default(),
    })).collect();
    Ok(Json(json!({"items": items})))
}

pub async fn list_users(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Query(query): Query<ListUsersQuery>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserManage)?;
    let limit = query.limit.unwrap_or(20).clamp(1, 100);
    let offset = query.offset.unwrap_or(0);
    let rows = sqlx::query(
        "SELECT id, username, password_hash, email, display_name, avatar_url, role, status, last_login_at, created_at, updated_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?"
    ).bind(limit).bind(offset).fetch_all(&state.pool).await?;
    let items: Vec<UserResponse> = rows.iter().map(|r| row_to_user(r)).collect();
    Ok(Json(UserListResponse { items, limit, offset }))
}

pub async fn create_user(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<CreateUserRequest>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserManage)?;
    validate_password_strength(&payload.password)?;
    let id = Uuid::new_v4().to_string();
    let hash = bcrypt::hash(&payload.password, 12).map_err(|e| AppError::BadRequest(format!("bcrypt: {}", e)))?;
    sqlx::query(
        "INSERT INTO users (id, username, password_hash, email, display_name, role) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(&id).bind(&payload.username).bind(&hash)
     .bind(&payload.email).bind(&payload.display_name).bind(payload.role.as_deref().unwrap_or("viewer"))
     .execute(&state.pool).await?;
    Ok((StatusCode::CREATED, Json(json!({"id": id, "created": true}))))
}

pub async fn get_user(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserManage)?;
    let row = sqlx::query(
        "SELECT id, username, password_hash, email, display_name, avatar_url, role, status, last_login_at, created_at, updated_at FROM users WHERE username = ?"
    ).bind(&id).fetch_optional(&state.pool).await?
    .ok_or_else(|| AppError::NotFound(format!("user {} not found", id)))?;
    Ok(Json(row_to_user(&row)))
}

pub async fn update_user(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>, Json(payload): Json<UpdateUserRequest>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserManage)?;
    if let Some(ref role) = payload.role {
        sqlx::query("UPDATE users SET role = ? WHERE username = ?").bind(role).bind(&id).execute(&state.pool).await?;
    }
    if let Some(ref status) = payload.status {
        sqlx::query("UPDATE users SET status = ? WHERE username = ?").bind(status).bind(&id).execute(&state.pool).await?;
    }
    if let Some(ref display_name) = payload.display_name {
        sqlx::query("UPDATE users SET display_name = ? WHERE username = ?").bind(display_name).bind(&id).execute(&state.pool).await?;
    }
    if let Some(ref email) = payload.email {
        sqlx::query("UPDATE users SET email = ? WHERE username = ?").bind(email).bind(&id).execute(&state.pool).await?;
    }
    Ok(Json(json!({"id": id, "updated": true})))
}

pub async fn delete_user(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserManage)?;
    let username: String = sqlx::query_scalar("SELECT username FROM users WHERE username = ?")
        .bind(&id).fetch_optional(&state.pool).await?
        .ok_or_else(|| AppError::NotFound(format!("user {} not found", id)))?;
    if username == "admin" {
        return Err(AppError::Forbidden("cannot delete the built-in admin user".to_string()));
    }
    sqlx::query("DELETE FROM users WHERE username = ?").bind(&id).execute(&state.pool).await?;
    Ok(Json(json!({"deleted": true})))
}

pub async fn setup_totp(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserSelf)?;
    let raw_secret: Vec<u8> = (0..20).map(|_| rand::random::<u8>()).collect();
    let encoded = base32_encode(&raw_secret);
    let qr_code_url = totp_rs::TOTP::new(
        totp_rs::Algorithm::SHA1, 6, 1, 30, raw_secret,
        Some("API Control Plane".to_string()),
        auth.subject.clone(),
    ).map_err(|e| AppError::BadRequest(format!("TOTP setup error: {}", e)))?.get_url();
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
    let prefs: Option<String> = sqlx::query_scalar("SELECT preferences FROM users WHERE username = ?")
        .bind(&auth.subject).fetch_optional(&state.pool).await?
        .and_then(|v: Option<String>| v);
    let stored: Option<serde_json::Value> = prefs.and_then(|p| serde_json::from_str(&p).ok());
    Ok(Json(PreferencesResponse {
        user_id: auth.subject.clone(),
        theme: stored.as_ref().and_then(|v| v.get("theme").and_then(|t| t.as_str())).unwrap_or("auto").to_string(),
        lang: stored.as_ref().and_then(|v| v.get("lang").and_then(|l| l.as_str())).unwrap_or("zh").to_string(),
        notifications: stored.as_ref().and_then(|v| v.get("notifications").cloned()),
    }))
}

pub async fn update_my_preferences(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<UpdatePreferencesRequest>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserSelf)?;
    let prefs_json = serde_json::to_string(&payload).unwrap_or_default();
    sqlx::query("UPDATE users SET preferences = ? WHERE username = ?").bind(&prefs_json).bind(&auth.subject).execute(&state.pool).await?;
    Ok(Json(json!({"updated": true})))
}

// ==================== Helpers ====================

fn row_to_user(row: &sqlx::mysql::MySqlRow) -> UserResponse {
    let created_at: DateTime<Utc> = row.try_get("created_at").unwrap_or(DateTime::UNIX_EPOCH);
    let updated_at: DateTime<Utc> = row.try_get("updated_at").unwrap_or(DateTime::UNIX_EPOCH);
    let last_login: Option<DateTime<Utc>> = row.try_get("last_login_at").ok();
    UserResponse {
        id: row.try_get("id").unwrap_or_default(),
        username: row.try_get("username").unwrap_or_default(),
        email: row.try_get("email").ok(),
        display_name: row.try_get("display_name").ok(),
        avatar_url: row.try_get("avatar_url").ok(),
        role: row.try_get::<String, _>("role").unwrap_or_else(|_| "viewer".to_string()),
        status: row.try_get("status").unwrap_or_else(|_| "active".to_string()),
        last_login_at: last_login.map(|d| d.to_rfc3339()),
        created_at: created_at.to_rfc3339(),
        updated_at: updated_at.to_rfc3339(),
    }
}

fn parse_role(s: &str) -> Role {
    match s.to_lowercase().as_str() {
        "admin" => Role::Admin,
        "reviewer" => Role::Reviewer,
        "editor" => Role::Editor,
        _ => Role::Viewer,
    }
}
