use sqlx::{MySqlPool, Row};
use serde_json::Value;
use uuid::Uuid;

/// Create an in-app notification for a specific user.
pub async fn notify_user(
    pool: &MySqlPool,
    user_id: &str,
    r#type: &str,
    channel: &str,
    title: &str,
    message: &str,
    metadata: Option<&Value>,
) {
    let id = Uuid::new_v4().to_string();
    let meta_json = metadata.map(|v| serde_json::to_string(v).unwrap_or_default());
    if let Err(e) = sqlx::query(
        "INSERT INTO notifications (id, user_id, type, channel, title, message, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id).bind(user_id).bind(r#type).bind(channel).bind(title).bind(message).bind(&meta_json)
    .execute(pool).await
    {
        tracing::warn!(error = %e, user_id = %user_id, "failed to create notification");
    }
}

/// Notify users who have a given preference enabled.
pub async fn notify_pref_users(
    pool: &MySqlPool,
    pref_path: &str, // e.g. "notifications.email.rule_changes"
    r#type: &str,
    channel: &str,
    title: &str,
    message: &str,
    metadata: Option<&Value>,
) {
    let parts: Vec<&str> = pref_path.split('.').collect();
    if parts.len() < 3 {
        return;
    }
    // parts = ["notifications", "email"|"in_app", "rule_changes"|...]
    let notif_channel = parts[1];
    let notif_key = parts[2];

    let rows = sqlx::query("SELECT id, username, preferences FROM users WHERE status = 'active'")
        .fetch_all(pool).await;
    let Ok(rows) = rows else { return };

    for row in rows {
        let user_id: String = row.try_get("id").unwrap_or_default();
        // preferences is a JSON column — read as Value directly, not as String
        let prefs: Value = row.try_get("preferences").unwrap_or(Value::Null);
        if prefs.is_null() { continue; }

        let enabled = prefs
            .get("notifications")
            .and_then(|n| n.get(notif_channel))
            .and_then(|ch| ch.get(notif_key))
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        if enabled {
            notify_user(pool, &user_id, r#type, channel, title, message, metadata).await;
        }
    }
}
