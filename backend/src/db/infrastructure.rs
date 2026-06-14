use sqlx::MySqlPool;
use crate::auth::AppError;
use super::is_duplicate_error;

pub async fn bootstrap(pool: &MySqlPool) -> Result<(), AppError> {
    sqlx::query(r#"CREATE TABLE IF NOT EXISTS api_keys (
        id VARCHAR(36) PRIMARY KEY, key_prefix VARCHAR(12) NOT NULL, key_hash VARCHAR(128) NOT NULL UNIQUE,
        name VARCHAR(120) NOT NULL, status VARCHAR(32) NOT NULL DEFAULT 'active', scopes JSON NULL,
        expires_at TIMESTAMP NULL, max_calls INT NULL, call_count INT NOT NULL DEFAULT 0,
        tenant_id VARCHAR(64) NULL, created_by VARCHAR(64) NOT NULL DEFAULT 'system',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_key_status (status), KEY idx_key_tenant (tenant_id)
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

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS circuit_breakers (
        id VARCHAR(36) PRIMARY KEY, api_path VARCHAR(255) NOT NULL UNIQUE,
        failure_threshold INT NOT NULL DEFAULT 5, recovery_timeout_sec INT NOT NULL DEFAULT 30,
        half_open_max INT NOT NULL DEFAULT 3, retry_count INT NOT NULL DEFAULT 3,
        retry_delay_ms INT NOT NULL DEFAULT 100, timeout_ms INT NOT NULL DEFAULT 10000,
        status VARCHAR(32) NOT NULL DEFAULT 'active', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS protocol_configs (
        id VARCHAR(36) PRIMARY KEY, api_path VARCHAR(255) NOT NULL UNIQUE, protocol VARCHAR(32) NOT NULL,
        description VARCHAR(500) NULL, config_json LONGTEXT NULL, status VARCHAR(32) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_proto (protocol)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    // Add description column if missing (migration from older schema)
    let has_desc: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'protocol_configs' AND COLUMN_NAME = 'description'"
    ).fetch_one(pool).await?;
    if has_desc == 0 {
        if let Err(e) = sqlx::query("ALTER TABLE protocol_configs ADD COLUMN description VARCHAR(500) NULL AFTER protocol")
            .execute(pool).await {
            if !is_duplicate_error(&e) {
                return Err(e.into());
            }
        }
    }

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS data_classifications (
        id VARCHAR(36) PRIMARY KEY, api_path VARCHAR(255) NOT NULL UNIQUE,
        data_category VARCHAR(64) NOT NULL DEFAULT 'internal', description VARCHAR(500) NULL,
        contains_pii TINYINT(1) NOT NULL DEFAULT 0, gdpr_relevant TINYINT(1) NOT NULL DEFAULT 0,
        retention_days INT NOT NULL DEFAULT 365, notes TEXT NULL, classified_by VARCHAR(64) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_class_category (data_category)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    // Migration: add description column if missing
    let has_cdesc: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'data_classifications' AND COLUMN_NAME = 'description'"
    ).fetch_one(pool).await?;
    if has_cdesc == 0 {
        if let Err(e) = sqlx::query("ALTER TABLE data_classifications ADD COLUMN description VARCHAR(500) NULL AFTER data_category")
            .execute(pool).await {
            if !is_duplicate_error(&e) {
                return Err(e.into());
            }
        }
    }
    // Migration: add target_table column if missing
    let has_tt: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'data_classifications' AND COLUMN_NAME = 'target_table'"
    ).fetch_one(pool).await?;
    if has_tt == 0 {
        if let Err(e) = sqlx::query("ALTER TABLE data_classifications ADD COLUMN target_table VARCHAR(64) NULL AFTER retention_days")
            .execute(pool).await {
            if !is_duplicate_error(&e) {
                return Err(e.into());
            }
        }
    }

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS plugin_configs (
        id VARCHAR(36) PRIMARY KEY, name VARCHAR(120) NOT NULL, plugin_type VARCHAR(64) NOT NULL,
        hook_point VARCHAR(64) NOT NULL, config_json LONGTEXT NULL, priority INT NOT NULL DEFAULT 100,
        status VARCHAR(32) NOT NULL DEFAULT 'active', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_plugin_hook (hook_point), KEY idx_plugin_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    // Add missing indexes
    let has_llm_provider_idx: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llm_usage_logs' AND INDEX_NAME = 'idx_llm_provider'"
    ).fetch_one(pool).await?;
    if has_llm_provider_idx == 0 {
        if let Err(e) = sqlx::query("ALTER TABLE llm_usage_logs ADD INDEX idx_llm_provider (provider_id)")
            .execute(pool).await {
            if !is_duplicate_error(&e) {
                return Err(e.into());
            }
        }
    }

    Ok(())
}
