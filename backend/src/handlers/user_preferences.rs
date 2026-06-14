use std::sync::Arc;
use axum::extract::State;
use axum::response::IntoResponse;
use axum::{Extension, Json};
use sqlx::Row;

use crate::AppState;
use crate::types::*;
use crate::auth::*;

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

    let mut tx = state.pool.begin().await?;
    // Merge with existing preferences so partial updates don't wipe other fields
    let existing_row = sqlx::query("SELECT preferences FROM users WHERE username = ? FOR UPDATE")
        .bind(&auth.subject).fetch_optional(&mut *tx).await?;
    let existing: Option<serde_json::Value> = existing_row.and_then(|r| r.try_get::<serde_json::Value, _>("preferences").ok());
    let mut merged: serde_json::Value = existing.unwrap_or(serde_json::json!({}));

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

    let prefs_json = serde_json::to_string(&merged)?;
    sqlx::query("UPDATE users SET preferences = ? WHERE username = ?").bind(&prefs_json).bind(&auth.subject).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(PreferencesResponse {
        user_id: auth.subject.clone(),
        theme: merged.get("theme").and_then(|v| v.as_str()).unwrap_or("system").to_string(),
        lang: merged.get("lang").and_then(|v| v.as_str()).unwrap_or("zh").to_string(),
        notifications: merged.get("notifications").cloned(),
    }))
}
