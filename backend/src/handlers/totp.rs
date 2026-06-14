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

    let encoded: String = totp_row.try_get("secret").unwrap_or_default();
    let totp = build_totp_from_db(&encoded, user_id)?;
    let verified = totp.check_current(code)
        .map_err(|e| AppError::Internal(format!("TOTP check error: {}", e)))?;

    if !verified {
        return Err(AppError::Unauthorized("invalid TOTP code".to_string()));
    }
    Ok(())
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
    if bits > 0 && (buf << (8 - bits)) & 0xFF != 0 {
        return None; // unused bits must be zero
    }
    Some(out)
}
