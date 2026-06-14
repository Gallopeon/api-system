use sqlx::MySqlPool;
use crate::auth::AppError;

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
                if !e.to_string().to_lowercase().contains("duplicate") {
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
        KEY idx_sub_key (api_key_id), KEY idx_sub_product (product_id), KEY idx_sub_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    Ok(())
}
