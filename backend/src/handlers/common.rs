use redis::AsyncCommands;
use serde_json::{json, Value};
use sqlx::{MySqlPool, Row};
use chrono::{DateTime, Utc};

use crate::types::*;
use crate::auth::*;

pub async fn load_rule_detail(pool: &MySqlPool, id: &str) -> Result<RuleDetail, AppError> {
    let row = sqlx::query(
        "SELECT c.id, c.name, c.api_path, c.current_version, c.status, c.updated_at, v.config_text FROM rule_configs c INNER JOIN rule_versions v ON c.id = v.rule_id AND c.current_version = v.version WHERE c.id = ?"
    ).bind(id).fetch_optional(pool).await?
    .ok_or_else(|| AppError::NotFound(format!("rule {} not found", id)))?;
    let config_text: String = row.try_get("config_text").unwrap_or_default();
    let config: TransformRule = serde_json::from_str(&config_text).unwrap_or_else(|e| {
        tracing::warn!(error = %e, rule_id = %id, "corrupt rule config JSON, falling back to default");
        Default::default()
    });
    let updated_at: DateTime<Utc> = row.try_get("updated_at").unwrap_or(DateTime::UNIX_EPOCH);
    Ok(RuleDetail {
        id: row.try_get("id").unwrap_or_default(),
        name: row.try_get("name").unwrap_or_default(),
        api_path: row.try_get("api_path").unwrap_or_default(),
        current_version: row.try_get("current_version").unwrap_or(0),
        status: row.try_get("status").unwrap_or_default(),
        config,
        updated_at: updated_at.to_rfc3339(),
    })
}

pub async fn load_rule_version_config(pool: &MySqlPool, rule_id: &str, version: i32) -> Result<Value, AppError> {
    let config_text: String = sqlx::query_scalar(
        "SELECT config_text FROM rule_versions WHERE rule_id = ? AND version = ?"
    ).bind(rule_id).bind(version).fetch_optional(pool).await?
    .ok_or_else(|| AppError::NotFound(format!("version {} of rule {} not found", version, rule_id)))?;
    Ok(serde_json::from_str(&config_text).unwrap_or_else(|e| {
        tracing::warn!(error = %e, rule_id = %rule_id, version = %version, "corrupt version config JSON, falling back to empty object");
        json!({})
    }))
}

pub async fn write_audit_log(pool: &MySqlPool, entry: AuditEntry) -> Result<(), AppError> {
    let detail_json = entry.detail.map(|d| d.to_string()).unwrap_or_default();
    sqlx::query(
        "INSERT INTO audit_logs (rule_id, action, actor, success, message, detail) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(&entry.rule_id).bind(&entry.action).bind(&entry.actor)
     .bind(entry.success).bind(&entry.message).bind(&detail_json)
     .execute(pool).await?;
    Ok(())
}

/// Fire-and-forget audit log write. Spawns a background task so audit I/O
/// does not add latency to the API response.
pub fn spawn_audit_log(pool: &MySqlPool, entry: AuditEntry) {
    let pool = pool.clone();
    tokio::spawn(async move {
        if let Err(e) = write_audit_log(&pool, entry).await {
            tracing::warn!(error = %e, "async audit write failed");
        }
    });
}

pub async fn get_cached_rule(redis: &redis::Client, id: &str) -> Result<Option<RuleDetail>, AppError> {
    let mut conn = redis.get_multiplexed_async_connection().await?;
    let key = format!("rule:{}", id);
    let raw: Option<String> = conn.get(key).await?;
    match raw {
        Some(payload) => Ok(Some(serde_json::from_str(&payload)?)),
        None => Ok(None),
    }
}

pub async fn cache_rule(redis: &redis::Client, ttl_seconds: u64, detail: &RuleDetail) -> Result<(), AppError> {
    let mut conn = redis.get_multiplexed_async_connection().await?;
    let key = format!("rule:{}", detail.id);
    let payload = serde_json::to_string(detail)?;
    let _: () = conn.set_ex(key, payload, ttl_seconds).await?;
    Ok(())
}

pub async fn invalidate_cache(redis: &redis::Client, id: &str) -> Result<(), AppError> {
    let mut conn = redis.get_multiplexed_async_connection().await?;
    let key = format!("rule:{}", id);
    let _: () = conn.del(key).await?;
    Ok(())
}

const RULES_ALL_KEY: &str = "rules:all";

pub async fn get_cached_all_rules(redis: &redis::Client) -> Result<Option<Vec<RuleSummary>>, AppError> {
    let mut conn = redis.get_multiplexed_async_connection().await?;
    let raw: Option<String> = conn.get(RULES_ALL_KEY).await?;
    match raw {
        Some(payload) => Ok(Some(serde_json::from_str(&payload)?)),
        None => Ok(None),
    }
}

pub async fn cache_all_rules(redis: &redis::Client, ttl_seconds: u64, items: &[RuleSummary]) -> Result<(), AppError> {
    let mut conn = redis.get_multiplexed_async_connection().await?;
    let payload = serde_json::to_string(items)?;
    let _: () = conn.set_ex(RULES_ALL_KEY, payload, ttl_seconds).await?;
    Ok(())
}

pub async fn invalidate_all_rules_cache(redis: &redis::Client) -> Result<(), AppError> {
    let mut conn = redis.get_multiplexed_async_connection().await?;
    let _: () = conn.del(RULES_ALL_KEY).await?;
    Ok(())
}

pub const RULES_META_KEY: &str = "rules:meta";

/// Store one rule's metadata in the Redis Hash.
pub async fn cache_rule_meta(redis: &redis::Client, item: &RuleSummary) -> Result<(), AppError> {
    let mut conn = redis.get_multiplexed_async_connection().await?;
    let payload = serde_json::to_string(item)?;
    let _: () = conn.hset(RULES_META_KEY, &item.id, payload).await?;
    Ok(())
}

/// Remove one rule's metadata from the Redis Hash.
pub async fn invalidate_rule_meta(redis: &redis::Client, id: &str) -> Result<(), AppError> {
    let mut conn = redis.get_multiplexed_async_connection().await?;
    let _: () = conn.hdel(RULES_META_KEY, id).await?;
    Ok(())
}

/// Get all rules metadata from the Redis Hash. Returns empty Vec if key doesn't exist.
pub async fn get_all_rules_meta(redis: &redis::Client) -> Result<Vec<RuleSummary>, AppError> {
    let mut conn = redis.get_multiplexed_async_connection().await?;
    let raw: Vec<(String, String)> = conn.hgetall(RULES_META_KEY).await.unwrap_or_default();
    let items: Vec<RuleSummary> = raw.into_iter()
        .filter_map(|(_, json)| serde_json::from_str(&json).ok())
        .collect();
    Ok(items)
}

pub async fn load_rule_config_by_id(pool: &MySqlPool, rule_id: &str) -> Result<TransformRule, AppError> {
    let row = sqlx::query(
        "SELECT v.config_text, c.status FROM rule_versions v JOIN rule_configs c ON v.rule_id = c.id WHERE v.rule_id = ? AND c.status = 'published' ORDER BY v.version DESC LIMIT 1"
    ).bind(rule_id).fetch_optional(pool).await?
    .ok_or_else(|| AppError::NotFound(format!("rule {} not found or not published", rule_id)))?;
    let config_text: String = row.try_get("config_text").unwrap_or_default();
    Ok(serde_json::from_str(&config_text).unwrap_or_else(|e| {
        tracing::warn!(error = %e, rule_id = %rule_id, "corrupt published rule config JSON, falling back to default");
        Default::default()
    }))
}

pub fn get_rate_limit_by_id<'a>(pool: &'a MySqlPool, id: &'a str) -> impl std::future::Future<Output = Result<RateLimitResponse, AppError>> + use<'a> {
    async move {
        let row = sqlx::query(
            "SELECT id, name, api_path, window_seconds, max_requests, burst_size, quota_daily, quota_monthly, per_api_key, per_ip, status, created_at, updated_at FROM rate_limit_configs WHERE id = ?"
        ).bind(id).fetch_optional(pool).await?
        .ok_or_else(|| AppError::NotFound(format!("rate limit {} not found", id)))?;
        row_to_rate_limit_response(&row)
    }
}

pub fn row_to_rate_limit_response(row: &sqlx::mysql::MySqlRow) -> Result<RateLimitResponse, AppError> {
    let created_at: DateTime<Utc> = row.try_get("created_at")?;
    let updated_at: DateTime<Utc> = row.try_get("updated_at")?;
    Ok(RateLimitResponse {
        id: row.try_get("id")?, name: row.try_get("name")?, api_path: row.try_get("api_path")?,
        window_seconds: row.try_get("window_seconds")?, max_requests: row.try_get("max_requests")?,
        burst_size: row.try_get("burst_size")?,
        quota_daily: row.try_get("quota_daily")?, quota_monthly: row.try_get("quota_monthly")?,
        per_api_key: row.try_get::<i8, _>("per_api_key")? == 1,
        per_ip: row.try_get::<i8, _>("per_ip")? == 1,
        status: row.try_get("status")?,
        created_at: created_at.to_rfc3339(), updated_at: updated_at.to_rfc3339(),
    })
}

pub fn get_approval_by_id<'a>(pool: &'a MySqlPool, id: &'a str) -> impl std::future::Future<Output = Result<ApprovalResponse, AppError>> + use<'a> {
    async move {
        let row = sqlx::query(
            "SELECT id, rule_id, version, requestor, reviewer, status, comment, created_at, reviewed_at FROM approvals WHERE id = ?"
        ).bind(id).fetch_optional(pool).await?
        .ok_or_else(|| AppError::NotFound(format!("approval {} not found", id)))?;
        row_to_approval_response(&row)
    }
}

pub fn row_to_approval_response(row: &sqlx::mysql::MySqlRow) -> Result<ApprovalResponse, AppError> {
    let created_at: DateTime<Utc> = row.try_get("created_at")?;
    let reviewed_at: Option<DateTime<Utc>> = row.try_get("reviewed_at").ok();
    Ok(ApprovalResponse {
        id: row.try_get("id")?, rule_id: row.try_get("rule_id")?,
        version: row.try_get("version")?, requestor: row.try_get("requestor")?,
        reviewer: row.try_get("reviewer").unwrap_or_default(),
        status: row.try_get("status")?,
        comment: row.try_get("comment").unwrap_or_default(),
        created_at: created_at.to_rfc3339(),
        reviewed_at: reviewed_at.map(|d| d.to_rfc3339()),
    })
}
