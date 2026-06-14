use sqlx::MySqlPool;
use crate::auth::AppError;

pub async fn bootstrap(pool: &MySqlPool) -> Result<(), AppError> {
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
    ).fetch_one(pool).await?;
    if has_ck == 0 {
        if let Err(e) = sqlx::query("ALTER TABLE rule_versions ADD COLUMN change_kind ENUM('breaking','non_breaking','rollback','minor') NOT NULL DEFAULT 'breaking'")
            .execute(pool).await {
            if !e.to_string().to_lowercase().contains("duplicate") {
                return Err(e.into());
            }
        }
    }

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS approvals (
        id VARCHAR(36) PRIMARY KEY, rule_id VARCHAR(36) NOT NULL, version INT NOT NULL,
        requestor VARCHAR(64) NOT NULL, reviewer VARCHAR(64) NULL, status VARCHAR(32) NOT NULL DEFAULT 'pending',
        comment TEXT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TIMESTAMP NULL,
        KEY idx_approval_rule (rule_id), KEY idx_approval_status (status), KEY idx_approval_requestor (requestor),
        CONSTRAINT fk_approval_rule FOREIGN KEY (rule_id) REFERENCES rule_configs(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    // Add missing indexes for approvals
    let has_approval_requestor_idx: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'approvals' AND INDEX_NAME = 'idx_approval_requestor'"
    ).fetch_one(pool).await?;
    if has_approval_requestor_idx == 0 {
        if let Err(e) = sqlx::query("ALTER TABLE approvals ADD INDEX idx_approval_requestor (requestor)")
            .execute(pool).await {
            if !e.to_string().to_lowercase().contains("duplicate") {
                return Err(e.into());
            }
        }
    }

    Ok(())
}
