use std::sync::Arc;
use axum::extract::{Path, State};
use axum::response::IntoResponse;
use axum::{Extension, Json};
use serde_json::json;
use sqlx::Row;

use crate::AppState;
use crate::types::*;
use crate::auth::*;
use super::common::{spawn_audit_log, fmt_dt};

pub async fn list_system_settings(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::SystemRead)?;
    let rows = sqlx::query(
        "SELECT setting_key, setting_value, description, editable, updated_at FROM system_settings ORDER BY setting_key"
    ).fetch_all(&state.pool).await?;
    let items: Vec<SystemSettingItem> = rows.iter().map(|r| SystemSettingItem {
        key: r.try_get("setting_key").unwrap_or_default(),
        value: r.try_get("setting_value").unwrap_or_default(),
        description: r.try_get("description").ok(),
        editable: r.try_get::<i8, _>("editable").unwrap_or(1) == 1,
        updated_at: fmt_dt(r.try_get::<Option<chrono::DateTime<chrono::Utc>>, _>("updated_at").ok().flatten()),
    }).collect();
    Ok(Json(json!({"items": items})))
}

pub async fn update_system_setting(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(key): Path<String>, Json(payload): Json<UpdateSettingRequest>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::SystemWrite)?;
    let rows = sqlx::query(
        "UPDATE system_settings SET setting_value = ?, updated_at = NOW() WHERE setting_key = ? AND editable = 1"
    ).bind(&payload.value).bind(&key).execute(&state.pool).await?;
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

async fn get_setting(pool: &sqlx::MySqlPool, key: &str) -> Option<String> {
    sqlx::query_scalar("SELECT setting_value FROM system_settings WHERE setting_key = ?")
        .bind(key).fetch_optional(pool).await.ok().flatten()
}

pub async fn test_smtp(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<SmtpTestRequest>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::SystemWrite)?;

    let smtp_host = get_setting(&state.pool, "smtp_host").await.unwrap_or_default();
    let smtp_port: u16 = get_setting(&state.pool, "smtp_port").await.unwrap_or_else(|| "587".into()).parse().unwrap_or(587);
    let smtp_user = get_setting(&state.pool, "smtp_username").await.unwrap_or_default();
    let smtp_pass = get_setting(&state.pool, "smtp_password").await.unwrap_or_default();
    let from_email = get_setting(&state.pool, "smtp_from_email").await.unwrap_or_default();
    let from_name = get_setting(&state.pool, "smtp_from_name").await.unwrap_or_else(|| "API Control Plane".into());
    let encryption = get_setting(&state.pool, "smtp_encryption").await.unwrap_or_else(|| "starttls".into());

    if smtp_host.is_empty() || from_email.is_empty() {
        return Err(AppError::BadRequest("SMTP host and from email are required".to_string()));
    }

    let to_email = payload.to_email.unwrap_or_else(|| from_email.clone());

    let msg = lettre::Message::builder()
        .from(format!("{from_name} <{from_email}>").parse().map_err(|e| AppError::BadRequest(format!("invalid from: {e}")))?)
        .to(to_email.parse().map_err(|e| AppError::BadRequest(format!("invalid to: {e}")))?)
        .subject("SMTP Test — API Control Plane")
        .body("This is a test email from your API Control Plane instance. SMTP is configured correctly.".to_string())
        .map_err(|e| AppError::BadRequest(format!("failed to build email: {e}")))?;

    let transport = match encryption.as_str() {
        "tls" => lettre::transport::smtp::SmtpTransport::relay(&smtp_host)
            .map_err(|e| AppError::BadRequest(format!("smtp relay error: {e}")))?
            .port(smtp_port)
            .credentials(lettre::transport::smtp::authentication::Credentials::new(smtp_user, smtp_pass))
            .build(),
        "starttls" => lettre::transport::smtp::SmtpTransport::starttls_relay(&smtp_host)
            .map_err(|e| AppError::BadRequest(format!("smtp relay error: {e}")))?
            .port(smtp_port)
            .credentials(lettre::transport::smtp::authentication::Credentials::new(smtp_user, smtp_pass))
            .build(),
        _ => lettre::transport::smtp::SmtpTransport::builder_dangerous(&smtp_host)
            .port(smtp_port)
            .build(),
    };

    match tokio::task::spawn_blocking(move || lettre::Transport::send(&transport, &msg))
        .await
        .map_err(|e| AppError::Internal(format!("SMTP send task panicked: {e}")))?
    {
        Ok(_) => Ok(Json(json!({"success": true, "message": format!("Test email sent to {to_email}")}))),
        Err(e) => Err(AppError::BadRequest(format!("SMTP test failed: {e}"))),
    }
}
