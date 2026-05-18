use sqlx::{MySqlPool, Row};
use crate::auth::AppError;

const BATCH_SIZE: u64 = 5000;
const RUN_INTERVAL_HOURS: u64 = 6;

pub async fn run_retention_engine(pool: MySqlPool, mut shutdown: tokio::sync::watch::Receiver<bool>) {
    let mut interval = tokio::time::interval(std::time::Duration::from_secs(RUN_INTERVAL_HOURS * 3600));
    // Run once at startup
    tokio::select! {
        _ = interval.tick() => {}
        _ = shutdown.changed() => { return; }
    }
    loop {
        tokio::select! {
            _ = interval.tick() => {
                if let Err(e) = purge_by_classifications(&pool).await {
                    tracing::warn!(error = %e, "retention engine purge failed");
                }
            }
            _ = shutdown.changed() => {
                tracing::info!("retention engine shutting down");
                return;
            }
        }
    }
}

async fn purge_by_classifications(pool: &MySqlPool) -> Result<(), AppError> {
    let rows = sqlx::query(
        "SELECT api_path, target_table, retention_days FROM data_classifications WHERE target_table IS NOT NULL AND retention_days > 0"
    ).fetch_all(pool).await?;

    let mut total = 0u64;

    for row in &rows {
        let target_table: String = row.try_get("target_table").unwrap_or_default();
        let retention_days: i32 = row.try_get("retention_days").unwrap_or(365);
        let api_path: String = row.try_get("api_path").unwrap_or_default();
        if target_table.is_empty() {
            continue;
        }
        // Validate table name against known tables (防止 SQL 注入)
        if !is_known_table(&target_table) {
            tracing::warn!(table = %target_table, api_path = %api_path, "skipping unknown target_table in classification");
            continue;
        }
        let mut table_total = 0u64;
        loop {
            // SAFETY: target_table is validated by is_known_table whitelist
            let query = format!(
                "DELETE FROM {} WHERE created_at < NOW() - INTERVAL ? DAY LIMIT {}",
                target_table, BATCH_SIZE
            );
            let affected = sqlx::query(&query)
                .bind(retention_days)
                .execute(pool)
                .await?
                .rows_affected();
            table_total += affected;
            if affected < BATCH_SIZE {
                break;
            }
        }
        if table_total > 0 {
            total += table_total;
            tracing::info!(
                deleted = table_total,
                table = %target_table,
                retention_days = retention_days,
                api_path = %api_path,
                "retention purge"
            );
        }
    }

    if total > 0 {
        tracing::info!(total_deleted = total, "retention engine cycle completed");
    }
    Ok(())
}

fn is_known_table(name: &str) -> bool {
    matches!(
        name,
        "notifications"
            | "audit_logs"
            | "login_history"
            | "user_sessions"
            | "metrics_ingest"
            | "metrics_hourly_summary"
    )
}
