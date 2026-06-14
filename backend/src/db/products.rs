use sqlx::MySqlPool;
use crate::auth::AppError;
use super::is_duplicate_error;

pub async fn bootstrap(pool: &MySqlPool) -> Result<(), AppError> {
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
        ).bind(col).fetch_one(pool).await?;
        if has_col == 0 {
            let stmt = format!("ALTER TABLE api_products ADD COLUMN {} {}", col, def);
            if let Err(e) = sqlx::query(&stmt).execute(pool).await {
                if !is_duplicate_error(&e) {
                    return Err(e.into());
                }
            }
        }
    }

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS subscriptions (
        id VARCHAR(36) PRIMARY KEY, api_key_id VARCHAR(36) NOT NULL, product_id VARCHAR(36) NOT NULL,
        plan VARCHAR(32) NOT NULL DEFAULT 'free', rate_limit_rps INT NULL, quota_daily INT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'active', expires_at TIMESTAMP NULL,
        user_id VARCHAR(64) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_sub_active (api_key_id, product_id, status),
        KEY idx_sub_key (api_key_id), KEY idx_sub_product (product_id), KEY idx_sub_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    // Migrate: add unique constraint for active subscriptions if missing
    let has_uq: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions' AND INDEX_NAME = 'uq_sub_active'"
    ).fetch_one(pool).await?;
    if has_uq == 0 {
        if let Err(e) = sqlx::query("ALTER TABLE subscriptions ADD UNIQUE KEY uq_sub_active (api_key_id, product_id, status)")
            .execute(pool).await {
            if !is_duplicate_error(&e) {
                return Err(e.into());
            }
        }
    }

    Ok(())
}
