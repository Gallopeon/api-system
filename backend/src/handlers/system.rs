use std::sync::Arc;
use axum::extract::{Path, State};
use axum::response::IntoResponse;
use axum::{Extension, Json};
use serde_json::json;
use sqlx::Row;

use crate::AppState;
use crate::types::*;
use crate::auth::*;
use crate::engine::email;
use super::common::{spawn_audit_log, fmt_dt};

/// Sensitive setting keys whose values must be masked in API responses.
const SENSITIVE_KEYS: &[&str] = &["smtp_password", "jwt_secret"];
/// Setting keys whose values are encrypted at rest.
const ENCRYPTED_KEYS: &[&str] = &["smtp_password"];

pub async fn list_system_settings(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::SystemRead)?;
    let rows = sqlx::query(
        "SELECT setting_key, setting_value, description, editable, updated_at FROM system_settings ORDER BY setting_key"
    ).fetch_all(&state.pool).await?;
    let items: Vec<SystemSettingItem> = rows.iter().map(|r| {
        let key: String = r.try_get("setting_key").unwrap_or_default();
        let raw: String = r.try_get("setting_value").unwrap_or_default();
        // Mask sensitive values in API response
        let value = if SENSITIVE_KEYS.contains(&key.as_str()) {
            if raw.is_empty() { String::new() } else { "••••••••".to_string() }
        } else {
            raw
        };
        SystemSettingItem {
            key,
            value,
            description: r.try_get("description").ok(),
            editable: r.try_get::<i8, _>("editable").unwrap_or(1) == 1,
            updated_at: fmt_dt(r.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("updated_at").ok().flatten()),
        }
    }).collect();
    Ok(Json(json!({"items": items})))
}

pub async fn update_system_setting(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(key): Path<String>, Json(payload): Json<UpdateSettingRequest>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::SystemWrite)?;
    let value_to_store = maybe_encrypt(&key, &payload.value, &state.auth.jwt_secret);
    let rows = sqlx::query(
        "UPDATE system_settings SET setting_value = ?, updated_at = NOW() WHERE setting_key = ? AND editable = 1"
    ).bind(&value_to_store).bind(&key).execute(&state.pool).await?;
    if rows.rows_affected() == 0 {
        return Err(AppError::BadRequest(format!("setting '{}' not found or is not editable", key)));
    }
    let actor = resolve_actor(&auth, None);
    spawn_audit_log(&state.pool, AuditEntry {
        rule_id: None, action: "system_setting_update".to_string(), actor,
        success: true, message: Some(format!("System setting '{}' updated", key)),
        detail: Some(json!({"key": key})),
    });
    Ok(Json(json!({"key": key, "updated": true})))
}

/// Batch update multiple settings in a single request (reduces N API calls to 1).
pub async fn batch_update_settings(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<BatchUpdateSettingsRequest>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::SystemWrite)?;
    let mut updated: Vec<String> = Vec::new();
    let mut failed: Vec<String> = Vec::new();
    for item in &payload.settings {
        let value_to_store = maybe_encrypt(&item.key, &item.value, &state.auth.jwt_secret);
        let rows = sqlx::query(
            "UPDATE system_settings SET setting_value = ?, updated_at = NOW() WHERE setting_key = ? AND editable = 1"
        ).bind(&value_to_store).bind(&item.key).execute(&state.pool).await?;
        if rows.rows_affected() > 0 {
            updated.push(item.key.clone());
        } else {
            failed.push(item.key.clone());
        }
    }
    let actor = resolve_actor(&auth, None);
    if !updated.is_empty() {
        spawn_audit_log(&state.pool, AuditEntry {
            rule_id: None, action: "system_setting_update".to_string(), actor,
            success: true, message: Some(format!("Batch updated {} settings", updated.len())),
            detail: Some(json!({"updated": updated, "failed": failed})),
        });
    }
    Ok(Json(json!({"updated": updated, "failed": failed})))
}

async fn get_setting(pool: &sqlx::MySqlPool, key: &str) -> Option<String> {
    sqlx::query_scalar("SELECT setting_value FROM system_settings WHERE setting_key = ?")
        .bind(key).fetch_optional(pool).await.ok().flatten()
}

/// Read a decrypted setting value.
async fn get_decrypted_setting(pool: &sqlx::MySqlPool, key: &str, jwt_secret: &str) -> Option<String> {
    let raw = get_setting(pool, key).await?;
    if ENCRYPTED_KEYS.contains(&key) {
        Some(email::decrypt_password(&raw, jwt_secret))
    } else {
        Some(raw)
    }
}

/// Encrypt the value if the key requires encryption at rest.
fn maybe_encrypt(key: &str, value: &str, jwt_secret: &str) -> String {
    if ENCRYPTED_KEYS.contains(&key) && !value.is_empty() && !email::is_encrypted(value) {
        email::encrypt_password(value, jwt_secret)
    } else {
        value.to_string()
    }
}

pub async fn test_smtp(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<SmtpTestRequest>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::SystemWrite)?;
    let jwt = &state.auth.jwt_secret;

    let smtp_host = get_setting(&state.pool, "smtp_host").await.unwrap_or_default();
    let smtp_port: u16 = get_setting(&state.pool, "smtp_port").await.unwrap_or_else(|| "587".into()).parse().unwrap_or(587);
    let smtp_user = get_decrypted_setting(&state.pool, "smtp_username", jwt).await.unwrap_or_default();
    let smtp_pass = get_decrypted_setting(&state.pool, "smtp_password", jwt).await.unwrap_or_default();
    let from_email = get_setting(&state.pool, "smtp_from_email").await.unwrap_or_default();
    let from_name = get_setting(&state.pool, "smtp_from_name").await.unwrap_or_else(|| "API Control Plane".into());
    let encryption = get_setting(&state.pool, "smtp_encryption").await.unwrap_or_else(|| "starttls".into());
    let timeout: u64 = get_setting(&state.pool, "smtp_timeout").await.unwrap_or_else(|| "30".into()).parse().unwrap_or(30);

    if smtp_host.is_empty() || from_email.is_empty() {
        return Err(AppError::BadRequest("SMTP host and from email are required".to_string()));
    }

    let to_email = payload.to_email.unwrap_or_else(|| from_email.clone());
    let subject = payload.subject.unwrap_or_else(|| "SMTP Test — API Control Plane".into());
    let body = payload.body.unwrap_or_else(|| "This is a test email from your API Control Plane instance. SMTP is configured correctly.".into());

    let msg = email::build_email_message(&from_email, &from_name, &to_email, &subject, &body)
        .map_err(|e| AppError::BadRequest(e))?;
    let transport = email::build_smtp_transport(&smtp_host, smtp_port, &smtp_user, &smtp_pass, &encryption, timeout)
        .map_err(|e| AppError::BadRequest(e))?;

    match tokio::task::spawn_blocking(move || email::send_email_sync(&transport, &msg))
        .await
        .map_err(|e| AppError::Internal(format!("SMTP send task panicked: {e}")))?
    {
        Ok(()) => Ok(Json(json!({"success": true, "message": format!("Test email sent to {to_email}")}))),
        Err(e) => Err(AppError::BadRequest(format!("SMTP test failed: {e}"))),
    }
}

/// Verify SMTP connectivity without sending an email.
pub async fn verify_smtp(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<SmtpVerifyRequest>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::SystemWrite)?;
    let jwt = &state.auth.jwt_secret;

    let host = payload.host.unwrap_or_default().trim().to_string();
    let smtp_host = if host.is_empty() { get_setting(&state.pool, "smtp_host").await.unwrap_or_default() } else { host };
    let smtp_port = if let Some(p) = payload.port { p } else {
        get_setting(&state.pool, "smtp_port").await.unwrap_or_else(|| "587".into()).parse().unwrap_or(587)
    };
    let encryption = payload.encryption.unwrap_or_default().trim().to_string();
    let enc = if encryption.is_empty() { get_setting(&state.pool, "smtp_encryption").await.unwrap_or_else(|| "starttls".into()) } else { encryption };
    let smtp_user = get_decrypted_setting(&state.pool, "smtp_username", jwt).await.unwrap_or_default();
    let smtp_pass = get_decrypted_setting(&state.pool, "smtp_password", jwt).await.unwrap_or_default();
    let timeout: u64 = get_setting(&state.pool, "smtp_timeout").await.unwrap_or_else(|| "30".into()).parse().unwrap_or(30);

    if smtp_host.is_empty() {
        return Err(AppError::BadRequest("SMTP host is required".to_string()));
    }

    match tokio::task::spawn_blocking(move || email::verify_smtp_connection(&smtp_host, smtp_port, &smtp_user, &smtp_pass, &enc, timeout))
        .await
        .map_err(|e| AppError::Internal(format!("SMTP verify task panicked: {e}")))?
    {
        Ok(msg) => Ok(Json(json!({"success": true, "message": msg}))),
        Err(e) => Err(AppError::BadRequest(e)),
    }
}
