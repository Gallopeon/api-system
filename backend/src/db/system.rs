use sqlx::MySqlPool;
use crate::auth::AppError;

pub async fn bootstrap(pool: &MySqlPool) -> Result<(), AppError> {
    sqlx::query(r#"CREATE TABLE IF NOT EXISTS system_settings (
        setting_key VARCHAR(128) PRIMARY KEY, setting_value TEXT NOT NULL,
        description VARCHAR(255) NULL, editable TINYINT(1) NOT NULL DEFAULT 1,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGINT PRIMARY KEY AUTO_INCREMENT, rule_id VARCHAR(36) NULL, action VARCHAR(64) NOT NULL,
        actor VARCHAR(64) NOT NULL DEFAULT 'system', success TINYINT(1) NOT NULL DEFAULT 1,
        message VARCHAR(255) NULL, detail LONGTEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_audit_created (created_at), KEY idx_audit_rule_action (rule_id, action), KEY idx_audit_actor (actor)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    let has_detail: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_logs' AND COLUMN_NAME = 'detail'"
    ).fetch_one(pool).await?;
    if has_detail == 0 {
        if let Err(e) = sqlx::query("ALTER TABLE audit_logs ADD COLUMN detail LONGTEXT NULL")
            .execute(pool).await {
            if !e.to_string().to_lowercase().contains("duplicate") {
                return Err(e.into());
            }
        }
    }

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL,
        type VARCHAR(32) NOT NULL, channel VARCHAR(16) NOT NULL DEFAULT 'in_app',
        title VARCHAR(256) NOT NULL, message TEXT NOT NULL,
        `read` TINYINT(1) NOT NULL DEFAULT 0, email_sent TINYINT(1) NOT NULL DEFAULT 0,
        metadata JSON NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_notif_user (user_id), KEY idx_notif_read (user_id, `read`),
        CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    Ok(())
}
