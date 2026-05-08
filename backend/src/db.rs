use sqlx::MySqlPool;

use crate::auth::AppError;

pub async fn bootstrap_schema(pool: &MySqlPool) -> Result<(), AppError> {
    sqlx::query(r#"CREATE TABLE IF NOT EXISTS rule_configs (
        id VARCHAR(36) PRIMARY KEY, name VARCHAR(120) NOT NULL, api_path VARCHAR(255) NOT NULL,
        current_version INT NOT NULL, status VARCHAR(32) NOT NULL DEFAULT 'draft',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS rule_versions (
        id BIGINT PRIMARY KEY AUTO_INCREMENT, rule_id VARCHAR(36) NOT NULL, version INT NOT NULL,
        config_text LONGTEXT NOT NULL, note VARCHAR(255) NULL,
        change_kind ENUM('breaking','non_breaking','rollback','minor') NOT NULL DEFAULT 'breaking',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_rule_version (rule_id, version), KEY idx_rule_id (rule_id),
        CONSTRAINT fk_rule_versions_rule FOREIGN KEY (rule_id) REFERENCES rule_configs(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    let has_ck: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rule_versions' AND COLUMN_NAME = 'change_kind'"
    ).fetch_one(pool).await.unwrap_or(0);
    if has_ck == 0 {
        sqlx::query("ALTER TABLE rule_versions ADD COLUMN change_kind ENUM('breaking','non_breaking','rollback','minor') NOT NULL DEFAULT 'breaking'")
            .execute(pool).await?;
    }

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGINT PRIMARY KEY AUTO_INCREMENT, rule_id VARCHAR(36) NULL, action VARCHAR(64) NOT NULL,
        actor VARCHAR(64) NOT NULL DEFAULT 'system', success TINYINT(1) NOT NULL DEFAULT 1,
        message VARCHAR(255) NULL, detail LONGTEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_audit_created (created_at), KEY idx_audit_rule_action (rule_id, action), KEY idx_audit_actor (actor)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    let has_detail: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_logs' AND COLUMN_NAME = 'detail'"
    ).fetch_one(pool).await.unwrap_or(0);
    if has_detail == 0 {
        sqlx::query("ALTER TABLE audit_logs ADD COLUMN detail LONGTEXT NULL")
            .execute(pool).await?;
    }

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS api_keys (
        id VARCHAR(36) PRIMARY KEY, key_prefix VARCHAR(12) NOT NULL, key_hash VARCHAR(128) NOT NULL UNIQUE,
        name VARCHAR(120) NOT NULL, status VARCHAR(32) NOT NULL DEFAULT 'active', scopes JSON NULL,
        expires_at TIMESTAMP NULL, max_calls INT NULL, call_count INT NOT NULL DEFAULT 0,
        tenant_id VARCHAR(64) NULL, created_by VARCHAR(64) NOT NULL DEFAULT 'system',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_key_hash (key_hash), KEY idx_key_status (status), KEY idx_key_tenant (tenant_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS rate_limit_configs (
        id VARCHAR(36) PRIMARY KEY, name VARCHAR(120) NOT NULL, api_path VARCHAR(255) NOT NULL,
        window_seconds INT NOT NULL DEFAULT 60, max_requests INT NOT NULL DEFAULT 100, burst_size INT NOT NULL DEFAULT 50,
        quota_daily INT NULL, quota_monthly INT NULL, per_api_key TINYINT(1) NOT NULL DEFAULT 0,
        per_ip TINYINT(1) NOT NULL DEFAULT 1, status VARCHAR(32) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_rl_api_path (api_path), KEY idx_rl_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS metrics_ingest (
        id BIGINT PRIMARY KEY AUTO_INCREMENT, api_path VARCHAR(255) NOT NULL, method VARCHAR(10) NOT NULL DEFAULT 'GET',
        status_code INT NOT NULL DEFAULT 200, latency_ms INT NOT NULL DEFAULT 0,
        api_key_id VARCHAR(36) NULL, client_ip VARCHAR(45) NULL,
        timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_metrics_api_time (api_path, timestamp), KEY idx_metrics_key (api_key_id), KEY idx_metrics_created (timestamp)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS metrics_hourly_summary (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        hour_bucket DATETIME NOT NULL,
        api_path VARCHAR(255) NOT NULL,
        method VARCHAR(10) NOT NULL DEFAULT 'GET',
        status_code INT NOT NULL DEFAULT 200,
        request_count BIGINT NOT NULL DEFAULT 0,
        avg_latency_ms DOUBLE NOT NULL DEFAULT 0,
        p95_latency_ms INT NOT NULL DEFAULT 0,
        p99_latency_ms INT NOT NULL DEFAULT 0,
        error_count BIGINT NOT NULL DEFAULT 0,
        UNIQUE KEY uq_hourly (hour_bucket, api_path, method, status_code),
        KEY idx_hourly_bucket (hour_bucket)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS approvals (
        id VARCHAR(36) PRIMARY KEY, rule_id VARCHAR(36) NOT NULL, version INT NOT NULL,
        requestor VARCHAR(64) NOT NULL, reviewer VARCHAR(64) NULL, status VARCHAR(32) NOT NULL DEFAULT 'pending',
        comment TEXT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TIMESTAMP NULL,
        KEY idx_approval_rule (rule_id), KEY idx_approval_status (status), KEY idx_approval_requestor (requestor),
        CONSTRAINT fk_approval_rule FOREIGN KEY (rule_id) REFERENCES rule_configs(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS llm_providers (
        id VARCHAR(36) PRIMARY KEY, name VARCHAR(120) NOT NULL, provider_type VARCHAR(64) NOT NULL,
        endpoint_url VARCHAR(512) NOT NULL, api_key_env VARCHAR(128) NULL, model_name VARCHAR(128) NOT NULL,
        cost_per_1k_input DECIMAL(10,6) NOT NULL DEFAULT 0, cost_per_1k_output DECIMAL(10,6) NOT NULL DEFAULT 0,
        max_tokens INT NOT NULL DEFAULT 4096, status VARCHAR(32) NOT NULL DEFAULT 'active',
        priority INT NOT NULL DEFAULT 10, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_llm_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS prompt_templates (
        id VARCHAR(36) PRIMARY KEY, name VARCHAR(120) NOT NULL, template_text LONGTEXT NOT NULL,
        variables JSON NULL, version INT NOT NULL DEFAULT 1, status VARCHAR(32) NOT NULL DEFAULT 'draft',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS llm_usage_logs (
        id BIGINT PRIMARY KEY AUTO_INCREMENT, provider_id VARCHAR(36) NULL, prompt_template_id VARCHAR(36) NULL,
        input_tokens INT NOT NULL DEFAULT 0, output_tokens INT NOT NULL DEFAULT 0,
        latency_ms INT NOT NULL DEFAULT 0, cost DECIMAL(12,6) NOT NULL DEFAULT 0,
        api_key_id VARCHAR(36) NULL, success TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_llm_created (created_at), KEY idx_llm_key (api_key_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS api_products (
        id VARCHAR(36) PRIMARY KEY, name VARCHAR(120) NOT NULL, description TEXT NULL,
        rule_ids JSON NULL, status VARCHAR(32) NOT NULL DEFAULT 'draft',
        tags JSON NULL, documentation_url VARCHAR(512) NULL,
        pricing_tiers JSON NULL, owner VARCHAR(64) NOT NULL DEFAULT 'admin',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    // Migrate existing api_products table: add missing columns (idempotent)
    for (col, def) in &[
        ("tags", "JSON NULL"),
        ("documentation_url", "VARCHAR(512) NULL"),
        ("pricing_tiers", "JSON NULL"),
        ("owner", "VARCHAR(64) NOT NULL DEFAULT 'admin'"),
        ("updated_at", "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
    ] {
        let has_col: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'api_products' AND COLUMN_NAME = ?"
        ).bind(col).fetch_one(pool).await.unwrap_or(0);
        if has_col == 0 {
            let stmt = format!("ALTER TABLE api_products ADD COLUMN {} {}", col, def);
            sqlx::query(&stmt).execute(pool).await?;
        }
    }

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS subscriptions (
        id VARCHAR(36) PRIMARY KEY, api_key_id VARCHAR(36) NOT NULL, product_id VARCHAR(36) NOT NULL,
        plan VARCHAR(32) NOT NULL DEFAULT 'free', rate_limit_rps INT NULL, quota_daily INT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'active', expires_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_sub_key (api_key_id), KEY idx_sub_product (product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS circuit_breakers (
        id VARCHAR(36) PRIMARY KEY, api_path VARCHAR(255) NOT NULL UNIQUE,
        failure_threshold INT NOT NULL DEFAULT 5, recovery_timeout_sec INT NOT NULL DEFAULT 30,
        half_open_max INT NOT NULL DEFAULT 3, retry_count INT NOT NULL DEFAULT 3,
        retry_delay_ms INT NOT NULL DEFAULT 100, timeout_ms INT NOT NULL DEFAULT 10000,
        status VARCHAR(32) NOT NULL DEFAULT 'active', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS protocol_configs (
        id VARCHAR(36) PRIMARY KEY, api_path VARCHAR(255) NOT NULL UNIQUE, protocol VARCHAR(32) NOT NULL,
        config_json LONGTEXT NULL, status VARCHAR(32) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_proto (protocol)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS data_classifications (
        id VARCHAR(36) PRIMARY KEY, api_path VARCHAR(255) NOT NULL UNIQUE,
        data_category VARCHAR(64) NOT NULL DEFAULT 'internal', contains_pii TINYINT(1) NOT NULL DEFAULT 0,
        gdpr_relevant TINYINT(1) NOT NULL DEFAULT 0, retention_days INT NOT NULL DEFAULT 365,
        notes TEXT NULL, classified_by VARCHAR(64) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_class_category (data_category)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS plugin_configs (
        id VARCHAR(36) PRIMARY KEY, name VARCHAR(120) NOT NULL, plugin_type VARCHAR(64) NOT NULL,
        hook_point VARCHAR(64) NOT NULL, config_json LONGTEXT NULL, priority INT NOT NULL DEFAULT 100,
        status VARCHAR(32) NOT NULL DEFAULT 'active', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_plugin_hook (hook_point), KEY idx_plugin_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    // User management tables
    sqlx::query(r#"CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY, username VARCHAR(64) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL, email VARCHAR(128) NULL UNIQUE,
        display_name VARCHAR(128) NULL, avatar_url VARCHAR(512) NULL,
        role VARCHAR(32) NOT NULL DEFAULT 'viewer', status VARCHAR(32) NOT NULL DEFAULT 'active',
        failed_login_attempts INT NOT NULL DEFAULT 0, locked_until TIMESTAMP NULL,
        last_login_at TIMESTAMP NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_users_username (username), KEY idx_users_email (email), KEY idx_users_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

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

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS user_totp (
        user_id VARCHAR(36) PRIMARY KEY, secret VARCHAR(128) NOT NULL,
        enabled TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_totp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    let has_prefs: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'preferences'"
    ).fetch_one(pool).await.unwrap_or(0);
    if has_prefs == 0 {
        sqlx::query("ALTER TABLE users ADD COLUMN preferences JSON NULL")
            .execute(pool).await?;
    }

    // Add missing indexes for existing tables (idempotent via IF NOT EXISTS-style checks)
    let has_approval_requestor_idx: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'approvals' AND INDEX_NAME = 'idx_approval_requestor'"
    ).fetch_one(pool).await.unwrap_or(0);
    if has_approval_requestor_idx == 0 {
        sqlx::query("ALTER TABLE approvals ADD INDEX idx_approval_requestor (requestor)")
            .execute(pool).await?;
    }

    let has_login_attempt_idx: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'login_history' AND INDEX_NAME = 'idx_login_attempt'"
    ).fetch_one(pool).await.unwrap_or(0);
    if has_login_attempt_idx == 0 {
        sqlx::query("ALTER TABLE login_history ADD INDEX idx_login_attempt (username_attempt)")
            .execute(pool).await?;
    }

    let has_llm_provider_idx: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llm_usage_logs' AND INDEX_NAME = 'idx_llm_provider'"
    ).fetch_one(pool).await.unwrap_or(0);
    if has_llm_provider_idx == 0 {
        sqlx::query("ALTER TABLE llm_usage_logs ADD INDEX idx_llm_provider (provider_id)")
            .execute(pool).await?;
    }

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS system_settings (
        setting_key VARCHAR(128) PRIMARY KEY, setting_value TEXT NOT NULL,
        description VARCHAR(255) NULL, editable TINYINT(1) NOT NULL DEFAULT 1,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL,
        type VARCHAR(32) NOT NULL, channel VARCHAR(16) NOT NULL DEFAULT 'in_app',
        title VARCHAR(256) NOT NULL, message TEXT NOT NULL,
        `read` TINYINT(1) NOT NULL DEFAULT 0, email_sent TINYINT(1) NOT NULL DEFAULT 0,
        metadata JSON NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_notif_user (user_id), KEY idx_notif_read (user_id, `read`),
        CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    seed_settings(pool).await?;
    seed_admin(pool).await?;

    Ok(())
}

async fn seed_settings(pool: &MySqlPool) -> Result<(), AppError> {
    let defaults: Vec<(&str, &str, &str, bool)> = vec![
        ("cache_ttl_seconds", "300", "Redis cache TTL in seconds", true),
        ("jwt_ttl_seconds", "86400", "JWT token expiry in seconds", true),
        ("login_max_attempts", "5", "Max failed logins before lockout", true),
        ("login_lockout_minutes", "15", "Account lockout duration in minutes", true),
        ("password_policy_enforced", "true", "Enforce password strength rules", true),
        ("jwt_secret", "****", "JWT signing secret (env-only)", false),
        ("admin_default_password", "****", "Default admin password (env-only)", false),
        ("cors_allowed_origins", "*", "CORS allowed origins", true),
        ("rust_log", "info", "Log level", true),
        // SMTP configuration
        ("smtp_host", "", "SMTP server hostname", true),
        ("smtp_port", "587", "SMTP server port", true),
        ("smtp_username", "", "SMTP authentication username", true),
        ("smtp_password", "", "SMTP authentication password", true),
        ("smtp_from_email", "", "Sender email address", true),
        ("smtp_from_name", "API Control Plane", "Sender display name", true),
        ("smtp_encryption", "tls", "SMTP encryption: tls, starttls, or none", true),
    ];
    for (key, val, desc, editable) in &defaults {
        sqlx::query(
            "INSERT IGNORE INTO system_settings (setting_key, setting_value, description, editable) VALUES (?, ?, ?, ?)"
        )
        .bind(key).bind(val).bind(desc).bind(editable)
        .execute(pool).await?;
    }
    Ok(())
}

async fn seed_admin(pool: &MySqlPool) -> Result<(), AppError> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users").fetch_one(pool).await?;
    if count > 0 {
        return Ok(());
    }
    let default_pw = std::env::var("ADMIN_DEFAULT_PASSWORD")
        .ok()
        .filter(|v| !v.is_empty())
        .ok_or_else(|| {
            tracing::error!("No users exist and ADMIN_DEFAULT_PASSWORD is not set. Cannot create default admin.");
            AppError::Internal("ADMIN_DEFAULT_PASSWORD must be set to seed the initial admin user".to_string())
        })?;
    let hash = bcrypt::hash(&default_pw, 12)
        .map_err(|e| AppError::BadRequest(format!("bcrypt hash failed: {}", e)))?;
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO users (id, username, password_hash, email, display_name, role) VALUES (?, ?, ?, ?, ?, 'admin')"
    ).bind(&id).bind("admin").bind(&hash).bind("admin@example.com").bind("Administrator")
    .execute(pool).await?;
    Ok(())
}
