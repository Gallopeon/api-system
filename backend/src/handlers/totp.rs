use std::sync::Arc;
use axum::extract::State;
use axum::response::IntoResponse;
use axum::{Extension, Json};
use serde_json::json;
use sqlx::Row;

use crate::AppState;
use crate::types::*;
use crate::auth::*;

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

pub async fn disable_totp(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<TotpVerifyRequest>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserSelf)?;
    // Require valid TOTP code before disabling to prevent stolen-session attacks
    let encoded: String = sqlx::query_scalar(
        "SELECT secret FROM user_totp WHERE user_id = (SELECT id FROM users WHERE username = ?) AND enabled = 1"
    ).bind(&auth.subject).fetch_optional(&state.pool).await?
    .ok_or_else(|| AppError::NotFound("TOTP is not enabled".to_string()))?;
    let totp = build_totp_from_db(&encoded, &auth.subject)?;
    let verified = totp.check_current(&payload.code)
        .map_err(|e| AppError::BadRequest(format!("TOTP check error: {}", e)))?;
    if !verified {
        return Err(AppError::BadRequest("invalid TOTP code".to_string()));
    }
    sqlx::query("UPDATE user_totp SET enabled = 0, secret = '' WHERE user_id = (SELECT id FROM users WHERE username = ?)")
        .bind(&auth.subject).execute(&state.pool).await?;
    Ok(Json(json!({"disabled": true})))
}

pub fn build_totp_from_db(encoded_secret: &str, account_name: &str) -> Result<totp_rs::TOTP, AppError> {
    let raw_secret = base32_decode(encoded_secret)
        .ok_or_else(|| AppError::Internal("invalid TOTP secret encoding".to_string()))?;
    totp_rs::TOTP::new(
        totp_rs::Algorithm::SHA1, 6, 1, 30, raw_secret,
        Some("API Control Plane".to_string()),
        account_name.to_string(),
    ).map_err(|e| AppError::Internal(format!("TOTP init error: {}", e)))
}

pub async fn verify_login_totp(pool: &sqlx::MySqlPool, user_id: &str, totp_code: Option<&str>) -> Result<(), AppError> {
    let totp_row = sqlx::query("SELECT secret, enabled FROM user_totp WHERE user_id = ?")
        .bind(user_id).fetch_optional(pool).await?;
    let Some(totp_row) = totp_row else { return Ok(()); };
    let enabled: i8 = totp_row.try_get("enabled").unwrap_or(0);
    if enabled == 0 { return Ok(()); }

    let code = totp_code.ok_or_else(||
        AppError::Unauthorized("TOTP is enabled for this account; provide totp_code".to_string())
    )?;

    let encoded: String = totp_row.try_get::<String, _>("secret")
        .ok()
        .filter(|s| !s.is_empty())
        .ok_or_else(|| AppError::Internal("TOTP secret is missing or empty".to_string()))?;
    let totp = build_totp_from_db(&encoded, user_id)?;
    let verified = totp.check_current(code)
        .map_err(|e| AppError::Internal(format!("TOTP check error: {}", e)))?;

    if !verified {
        // Track failed TOTP attempts to prevent brute-force (6-digit codes are only 1M possibilities)
        track_totp_failure(pool, user_id).await;
        return Err(AppError::Unauthorized("invalid TOTP code".to_string()));
    }

    // On success, reset the failure counter
    reset_totp_failure(pool, user_id).await;
    Ok(())
}

/// Increment TOTP failure counter and lock account if threshold exceeded.
/// Uses MySQL `user_totp` table is not ideal for this (no counter column), so we use a separate
/// `login_history` approach: count recent TOTP failures for this user.
async fn track_totp_failure(pool: &sqlx::MySqlPool, user_id: &str) {
    // Record the failed TOTP attempt in login_history for audit
    let _ = sqlx::query(
        "INSERT INTO login_history (user_id, username_attempt, success, failure_reason) \
         SELECT ?, username, 0, 'invalid_totp_code' FROM users WHERE id = ?"
    ).bind(user_id).bind(user_id).execute(pool).await;

    // Check if user has exceeded max TOTP failures (5 in last 15 minutes)
    let recent_failures: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM login_history WHERE user_id = ? AND failure_reason = 'invalid_totp_code' \
         AND created_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE)"
    ).bind(user_id).fetch_optional(pool).await.unwrap_or(Some(0)).unwrap_or(0);

    if recent_failures >= 5 {
        // Lock the account for 15 minutes
        let _ = sqlx::query(
            "UPDATE users SET locked_until = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE id = ?"
        ).bind(user_id).execute(pool).await;
        tracing::warn!(user_id, failures = recent_failures, "account locked due to repeated TOTP failures");
    }
}

/// Reset TOTP failure tracking on successful verification.
async fn reset_totp_failure(pool: &sqlx::MySqlPool, _user_id: &str) {
    // The counter is time-based (15 min window), so no explicit reset needed.
    // The login_history rows serve as audit trail and will age out naturally.
    let _ = pool;
}

fn base32_encode(data: &[u8]) -> String {
    data_encoding::BASE32.encode(data)
}

fn base64_encode(data: &[u8]) -> String {
    data_encoding::BASE64.encode(data)
}

fn base32_decode(encoded: &str) -> Option<Vec<u8>> {
    data_encoding::BASE32.decode(encoded.to_uppercase().as_bytes()).ok()
}
