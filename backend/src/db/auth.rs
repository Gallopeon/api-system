use sqlx::MySqlPool;
use crate::auth::AppError;
use super::is_duplicate_error;

pub async fn bootstrap(pool: &MySqlPool) -> Result<(), AppError> {
    // Permission templates
    sqlx::query(r#"CREATE TABLE IF NOT EXISTS permission_templates (
        id VARCHAR(36) PRIMARY KEY, name VARCHAR(64) NOT NULL UNIQUE,
        description VARCHAR(255) NULL, permissions JSON NOT NULL,
        is_builtin TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_pt_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    // User management tables
    sqlx::query(r#"CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY, username VARCHAR(64) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL, email VARCHAR(128) NULL UNIQUE,
        display_name VARCHAR(128) NULL, avatar_url VARCHAR(512) NULL,
        role VARCHAR(32) NOT NULL DEFAULT '', status VARCHAR(32) NOT NULL DEFAULT 'active',
        failed_login_attempts INT NOT NULL DEFAULT 0, locked_until TIMESTAMP NULL,
        last_login_at TIMESTAMP NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_users_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    // Migrate users table: add permission_template_id, custom_permissions, user_group
    for (col, def) in &[
        ("permission_template_id", "VARCHAR(36) NULL"),
        ("custom_permissions", "JSON NULL"),
        ("user_group", "VARCHAR(32) NOT NULL DEFAULT 'user'"),
    ] {
        let has_col: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = ?"
        ).bind(col).fetch_one(pool).await?;
        if has_col == 0 {
            let stmt = format!("ALTER TABLE users ADD COLUMN {} {}", col, def);
            if let Err(e) = sqlx::query(&stmt).execute(pool).await {
                // Ignore duplicate column errors from concurrent bootstrap
                if !is_duplicate_error(&e) {
                    return Err(e.into());
                }
            }
        }
    }

    // User devices for zero-trust
    sqlx::query(r#"CREATE TABLE IF NOT EXISTS user_devices (
        id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL,
        fingerprint_hash VARCHAR(64) NOT NULL, device_name VARCHAR(128) NULL,
        user_agent_hash VARCHAR(64) NULL, last_ip VARCHAR(45) NULL,
        trust_level VARCHAR(32) NOT NULL DEFAULT 'unknown',
        is_trusted TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_dev_user (user_id), KEY idx_dev_fp (fingerprint_hash),
        UNIQUE KEY uq_dev_user_fp (user_id, fingerprint_hash),
        CONSTRAINT fk_dev_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    // Migrate user_devices: add is_trusted if missing
    {
        let has: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_devices' AND COLUMN_NAME = 'is_trusted'"
        ).fetch_one(pool).await?;
        if has == 0 {
            if let Err(e) = sqlx::query("ALTER TABLE user_devices ADD COLUMN is_trusted TINYINT(1) NOT NULL DEFAULT 0")
                .execute(pool).await {
                if !is_duplicate_error(&e) {
                    return Err(e.into());
                }
            }
        }
    }

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS user_sessions (
        id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL, token_jti VARCHAR(64) NOT NULL UNIQUE,
        token_expires_at TIMESTAMP NOT NULL, client_ip VARCHAR(45) NULL, user_agent VARCHAR(512) NULL,
        revoked TINYINT(1) NOT NULL DEFAULT 0, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_sessions_user (user_id), KEY idx_sessions_jti (token_jti),
        CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS login_history (
        id BIGINT PRIMARY KEY AUTO_INCREMENT, user_id VARCHAR(36) NULL,
        username_attempt VARCHAR(64) NOT NULL, client_ip VARCHAR(45) NULL,
        user_agent VARCHAR(512) NULL, success TINYINT(1) NOT NULL DEFAULT 0,
        failure_reason VARCHAR(128) NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_login_user (user_id), KEY idx_login_created (created_at), KEY idx_login_attempt (username_attempt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    // Migrate login_history for zero-trust
    for (col, def) in &[
        ("device_fingerprint", "VARCHAR(64) NULL"),
        ("risk_score", "INT NOT NULL DEFAULT 0"),
        ("is_suspicious", "TINYINT(1) NOT NULL DEFAULT 0"),
        ("location_hint", "VARCHAR(128) NULL"),
    ] {
        let has_col: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'login_history' AND COLUMN_NAME = ?"
        ).bind(col).fetch_one(pool).await?;
        if has_col == 0 {
            let stmt = format!("ALTER TABLE login_history ADD COLUMN {} {}", col, def);
            if let Err(e) = sqlx::query(&stmt).execute(pool).await {
                if !is_duplicate_error(&e) {
                    return Err(e.into());
                }
            }
        }
    }

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS user_totp (
        user_id VARCHAR(36) PRIMARY KEY, secret VARCHAR(128) NOT NULL,
        enabled TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_totp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    let has_prefs: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'preferences'"
    ).fetch_one(pool).await?;
    if has_prefs == 0 {
        if let Err(e) = sqlx::query("ALTER TABLE users ADD COLUMN preferences JSON NULL")
            .execute(pool).await {
            if !e.to_string().to_lowercase().contains("duplicate") {
                return Err(e.into());
            }
        }
    }

    // Add missing indexes
    let has_login_attempt_idx: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'login_history' AND INDEX_NAME = 'idx_login_attempt'"
    ).fetch_one(pool).await?;
    if has_login_attempt_idx == 0 {
        if let Err(e) = sqlx::query("ALTER TABLE login_history ADD INDEX idx_login_attempt (username_attempt)")
            .execute(pool).await {
            if !e.to_string().to_lowercase().contains("duplicate") {
                return Err(e.into());
            }
        }
    }

    Ok(())
}
