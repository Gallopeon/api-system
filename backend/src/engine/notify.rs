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

/// Map notification type to the permission required to receive it.
/// Returns Some(perm) if permission is required, None if all authenticated users may receive.
fn permission_for_notif_type(notif_type: &str) -> Option<&'static str> {
    match notif_type {
        "rule_change" => Some("rule:read"),
        "security_alert" => None, // broadcast to all users
        "approval" => Some("approval:read"),
        "product_change" => Some("products:read"),
        "infrastructure_change" => None, // infrastructure alerts go to all users
        "audit_event" => Some("audit:read"),
        _ => None,
    }
}

/// Notify users who have a given preference enabled AND the required permission.
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
    let required_perm = permission_for_notif_type(r#type);

    // Fetch active users with their permissions (JOIN permission_template)
    let rows = sqlx::query(
        "SELECT u.id, u.preferences, CAST(pt.permissions AS CHAR) as template_perms, u.custom_permissions \
         FROM users u \
         LEFT JOIN permission_templates pt ON u.permission_template_id = pt.id \
         WHERE u.status = 'active'"
    )
    .fetch_all(pool).await;
    let Ok(rows) = rows else { return };

    let default_prefs: Value = serde_json::from_str(
        r#"{"notifications":{"email":{"rule_changes":true,"security_alerts":true,"product_updates":true},"in_app":{"approvals":true,"product_updates":true,"infrastructure":true,"audit":true}}}"#
    ).unwrap_or(Value::Null);

    for row in rows {
        let user_id: String = row.try_get("id").unwrap_or_default();

        // Check permission
        if let Some(perm) = required_perm {
            if !user_has_perm_from_row(&row, perm) {
                continue;
            }
        }

        // preferences is a JSON column — read as Value directly, not as String
        let stored: Value = row.try_get("preferences").unwrap_or(Value::Null);
        let prefs = if stored.is_null() { &default_prefs } else { &stored };

        let enabled = prefs
            .get("notifications")
            .and_then(|n| n.get(notif_channel))
            .and_then(|ch| ch.get(notif_key))
            .and_then(|v| v.as_bool())
            .unwrap_or(true); // default to true when preference is not explicitly set

        if enabled {
            notify_user(pool, &user_id, r#type, channel, title, message, metadata).await;
        }
    }
}

/// Resolve a user's effective permissions from a query row (template + custom).
fn user_has_perm_from_row(row: &sqlx::mysql::MySqlRow, required: &str) -> bool {
    let template_raw: Option<String> = row.try_get("template_perms").ok().flatten();
    let custom_raw: Option<String> = row.try_get("custom_permissions").ok().flatten();

    let template_perms: Vec<String> = template_raw
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();

    let custom_perms: Vec<String> = custom_raw
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();

    let mut perms: std::collections::HashSet<String> = template_perms.into_iter().collect();

    for p in &custom_perms {
        if let Some(stripped) = p.strip_prefix('!') {
            perms.remove(&stripped.to_string());
        } else {
            perms.insert(p.clone());
        }
    }

    perms.contains(required)
}
