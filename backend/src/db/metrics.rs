use sqlx::MySqlPool;
use crate::auth::AppError;

pub async fn bootstrap(pool: &MySqlPool) -> Result<(), AppError> {
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
        UNIQUE KEY uq_hourly (hour_bucket, api_path, method, status_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    Ok(())
}
