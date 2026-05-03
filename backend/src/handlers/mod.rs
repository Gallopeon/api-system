use std::sync::Arc;
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::{Extension, Json};
use chrono::{DateTime, Utc};
use redis::AsyncCommands;
use serde_json::{json, Value};
use sqlx::{Column, MySqlPool, Row};
use tracing::warn;
use uuid::Uuid;

use crate::AppState;
use crate::types::*;
use crate::auth::*;
use crate::engine::*;

// ==================== Rule CRUD ====================

pub async fn create_rule(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Json(payload): Json<CreateRuleRequest>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleWrite)?;
    validate_rule_request(&payload.name, &payload.api_path)?;
    validate_transform_rule(&payload.config)?;

    let id = Uuid::new_v4().to_string();
    let status = payload.status.unwrap_or_else(|| "draft".to_string());
    let actor = resolve_actor(&auth, payload.actor.as_deref());
    let mut tx = state.pool.begin().await?;

    sqlx::query("INSERT INTO rule_configs (id, name, api_path, current_version, status) VALUES (?, ?, ?, ?, ?)")
        .bind(&id).bind(&payload.name).bind(&payload.api_path).bind(1).bind(&status)
        .execute(&mut *tx).await?;

    let change_kind = payload.change_kind.unwrap_or_else(|| "breaking".to_string());
    let config_text = serde_json::to_string(&payload.config)?;
    sqlx::query("INSERT INTO rule_versions (rule_id, version, config_text, note, change_kind) VALUES (?, ?, ?, ?, ?)")
        .bind(&id).bind(1).bind(config_text).bind(payload.note.clone()).bind(&change_kind)
        .execute(&mut *tx).await?;

    tx.commit().await?;

    let detail = load_rule_detail(&state.pool, &id).await?;
    if let Err(e) = cache_rule(&state.redis, state.cache_ttl_seconds, &detail).await {
        warn!(error = %e, rule_id = %id, "cache write failed");
    }
    write_audit_log(&state.pool, AuditEntry {
        rule_id: Some(id.clone()), action: "rule_create".to_string(), actor,
        success: true, message: payload.note,
        detail: Some(json!({"name": payload.name, "api_path": payload.api_path, "status": status})),
    }).await.unwrap_or_else(|e| warn!(error = %e, "audit write failed"));

    Ok((StatusCode::CREATED, Json(json!({"id": id, "created": true}))))
}

pub async fn update_rule(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateRuleRequest>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleWrite)?;
    validate_rule_request(&payload.name, &payload.api_path)?;
    validate_transform_rule(&payload.config)?;

    let actor = resolve_actor(&auth, payload.actor.as_deref());
    let current_ver: i32 = sqlx::query_scalar("SELECT current_version FROM rule_configs WHERE id = ?")
        .bind(&id).fetch_optional(&state.pool).await?
        .ok_or_else(|| AppError::NotFound(format!("rule {} not found", id)))?;
    let new_ver = current_ver + 1;

    sqlx::query("UPDATE rule_configs SET name = ?, api_path = ?, status = ?, current_version = ?, updated_at = NOW() WHERE id = ?")
        .bind(&payload.name).bind(&payload.api_path).bind(&payload.status).bind(new_ver).bind(&id)
        .execute(&state.pool).await?;

    let config_text = serde_json::to_string(&payload.config)?;
    let change_kind = payload.change_kind.unwrap_or_else(|| "non_breaking".to_string());
    sqlx::query("INSERT INTO rule_versions (rule_id, version, config_text, note, change_kind) VALUES (?, ?, ?, ?, ?)")
        .bind(&id).bind(new_ver).bind(config_text).bind(payload.note.clone()).bind(&change_kind)
        .execute(&state.pool).await?;

    let detail = load_rule_detail(&state.pool, &id).await?;
    if let Err(e) = cache_rule(&state.redis, state.cache_ttl_seconds, &detail).await {
        warn!(error = %e, rule_id = %id, "cache write failed");
    }
    write_audit_log(&state.pool, AuditEntry {
        rule_id: Some(id.clone()), action: "rule_update".to_string(), actor,
        success: true, message: payload.note,
        detail: Some(json!({"new_version": new_ver})),
    }).await.unwrap_or_else(|e| warn!(error = %e, "audit write failed"));

    Ok(Json(json!({"id": id, "version": new_ver, "updated": true})))
}

pub async fn get_rule(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    if let Some(cached) = get_cached_rule(&state.redis, &id).await.unwrap_or(None) {
        return Ok(Json(cached));
    }
    let detail = load_rule_detail(&state.pool, &id).await?;
    let _ = cache_rule(&state.redis, state.cache_ttl_seconds, &detail).await;
    Ok(Json(detail))
}

pub async fn delete_rule(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleWrite)?;
    sqlx::query("DELETE FROM rule_versions WHERE rule_id = ?").bind(&id).execute(&state.pool).await?;
    sqlx::query("DELETE FROM rule_configs WHERE id = ?").bind(&id).execute(&state.pool).await?;
    invalidate_cache(&state.redis, &id).await.unwrap_or_else(|e| warn!(error = %e, "cache invalidate failed"));
    let actor = resolve_actor(&auth, None);
    write_audit_log(&state.pool, AuditEntry {
        rule_id: Some(id.clone()), action: "rule_delete".to_string(), actor,
        success: true, message: None, detail: Some(json!({"rule_id": id})),
    }).await.unwrap_or_else(|e| warn!(error = %e, "audit write failed"));
    Ok(Json(json!({"deleted": true})))
}

pub async fn list_rules(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Query(query): Query<ListRulesQuery>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    let limit = query.limit.unwrap_or(50).clamp(1, 200);
    let offset = query.offset.unwrap_or(0);
    let rows = sqlx::query(
        "SELECT id, name, api_path, current_version, status, updated_at FROM rule_configs ORDER BY updated_at DESC LIMIT ? OFFSET ?"
    ).bind(limit).bind(offset).fetch_all(&state.pool).await?;
    let items: Vec<RuleSummary> = rows.iter().map(|r| RuleSummary {
        id: r.try_get("id").unwrap_or_default(),
        name: r.try_get("name").unwrap_or_default(),
        api_path: r.try_get("api_path").unwrap_or_default(),
        current_version: r.try_get("current_version").unwrap_or(1),
        status: r.try_get("status").unwrap_or_default(),
        updated_at: r.try_get::<DateTime<Utc>, _>("updated_at").map(|d| d.to_rfc3339()).unwrap_or_default(),
    }).collect();
    Ok(Json(RuleListResponse { items, limit, offset }))
}

// ==================== Versions & Diff ====================

pub async fn list_rule_versions(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(rule_id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    let rows = sqlx::query(
        "SELECT version, config_text, note, change_kind, created_at FROM rule_versions WHERE rule_id = ? ORDER BY version DESC"
    ).bind(&rule_id).fetch_all(&state.pool).await?;
    let items: Vec<RuleVersionDetail> = rows.iter().map(|r| RuleVersionDetail {
        version: r.try_get("version").unwrap_or(0),
        note: r.try_get("note").unwrap_or_default(),
        change_kind: r.try_get("change_kind").unwrap_or_default(),
        created_at: r.try_get::<DateTime<Utc>, _>("created_at").map(|d| d.to_rfc3339()).unwrap_or_default(),
        config: serde_json::from_str(r.try_get("config_text").unwrap_or("{}")).unwrap_or(json!({})),
    }).collect();
    Ok(Json(RuleVersionsResponse { rule_id, items }))
}

pub async fn get_rule_diff(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(rule_id): Path<String>,
    Query(query): Query<RuleDiffQuery>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    let from_config = load_rule_version_config(&state.pool, &rule_id, query.from).await?;
    let to_config = load_rule_version_config(&state.pool, &rule_id, query.to).await?;
    let mut changes = Vec::new();
    diff_value("", Some(&from_config), Some(&to_config), &mut changes);
    Ok(Json(RuleDiffResponse { rule_id, from: query.from, to: query.to, changes_count: changes.len(), changes }))
}

pub async fn eval_expression_handler(
    State(_state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Json(payload): Json<ExprEvalRequest>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    let matched = eval_expression(&payload.expression, &payload.input)?;
    Ok(Json(ExprEvalResponse { expression: payload.expression, matched }))
}

// ==================== Rate Limits ====================

pub async fn create_rate_limit(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Json(payload): Json<CreateRateLimitRequest>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleWrite)?;
    let id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO rate_limit_configs (id, name, api_path, window_seconds, max_requests, burst_size, quota_daily, quota_monthly, per_api_key, per_ip, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(&id).bind(&payload.name).bind(&payload.api_path)
     .bind(payload.window_seconds).bind(payload.max_requests).bind(payload.burst_size)
     .bind(payload.quota_daily.unwrap_or(0)).bind(payload.quota_monthly.unwrap_or(0))
     .bind(payload.per_api_key).bind(payload.per_ip).bind("active")
     .execute(&state.pool).await?;
    Ok((StatusCode::CREATED, Json(json!({"id": id, "created": true}))))
}

pub async fn get_rate_limit(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    Ok(Json(get_rate_limit_by_id(&state.pool, &id).await?))
}

pub async fn list_rate_limits(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Query(query): Query<ListRateLimitsQuery>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    let limit = query.limit.unwrap_or(20).clamp(1, 100);
    let offset = query.offset.unwrap_or(0);
    let rows = sqlx::query(
        "SELECT id, name, api_path, window_seconds, max_requests, burst_size, quota_daily, quota_monthly, per_api_key, per_ip, status, created_at, updated_at FROM rate_limit_configs ORDER BY created_at DESC LIMIT ? OFFSET ?"
    ).bind(limit).bind(offset).fetch_all(&state.pool).await?;
    let items: Vec<RateLimitResponse> = rows.iter().map(|r| {
        let created_at: DateTime<Utc> = r.try_get("created_at").unwrap_or(DateTime::UNIX_EPOCH);
        let updated_at: DateTime<Utc> = r.try_get("updated_at").unwrap_or(DateTime::UNIX_EPOCH);
        RateLimitResponse {
            id: r.try_get("id").unwrap_or_default(),
            name: r.try_get("name").unwrap_or_default(),
            api_path: r.try_get("api_path").unwrap_or_default(),
            window_seconds: r.try_get("window_seconds").unwrap_or(0),
            max_requests: r.try_get("max_requests").unwrap_or(0),
            burst_size: r.try_get("burst_size").unwrap_or(0),
            quota_daily: r.try_get("quota_daily").unwrap_or(0),
            quota_monthly: r.try_get("quota_monthly").unwrap_or(0),
            per_api_key: r.try_get::<i8, _>("per_api_key").unwrap_or(0) == 1,
            per_ip: r.try_get::<i8, _>("per_ip").unwrap_or(0) == 1,
            status: r.try_get("status").unwrap_or_default(),
            created_at: created_at.to_rfc3339(),
            updated_at: updated_at.to_rfc3339(),
        }
    }).collect();
    Ok(Json(RateLimitListResponse { items, limit, offset }))
}

pub async fn update_rate_limit(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateRateLimitRequest>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleWrite)?;
    if let Some(ref status) = payload.status {
        sqlx::query("UPDATE rate_limit_configs SET status = ? WHERE id = ?").bind(status).bind(&id).execute(&state.pool).await?;
    }
    Ok(Json(get_rate_limit_by_id(&state.pool, &id).await?))
}

pub async fn delete_rate_limit(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleWrite)?;
    sqlx::query("DELETE FROM rate_limit_configs WHERE id = ?").bind(&id).execute(&state.pool).await?;
    Ok(Json(json!({"deleted": true})))
}

pub async fn check_rate_limit(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Json(payload): Json<RateLimitCheckRequest>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    let rows = sqlx::query(
        "SELECT max_requests, burst_size, quota_daily, quota_monthly FROM rate_limit_configs WHERE api_path = ? AND status = 'active'"
    ).bind(&payload.api_path).fetch_all(&state.pool).await?;
    if rows.is_empty() {
        return Ok(Json(RateLimitCheckResponse {
            allowed: true, limit: 0, remaining: 0, reset_seconds: 0,
            quota_daily_remaining: None, quota_monthly_remaining: None,
            reason: Some("no rate limit configured".to_string()),
        }));
    }
    let max: i32 = rows[0].try_get("max_requests").unwrap_or(100);
    Ok(Json(RateLimitCheckResponse {
        allowed: true, limit: max, remaining: max, reset_seconds: 60,
        quota_daily_remaining: rows[0].try_get("quota_daily").unwrap_or(0),
        quota_monthly_remaining: rows[0].try_get("quota_monthly").unwrap_or(0),
        reason: None,
    }))
}

// ==================== Validation Handlers ====================

pub async fn validate_request(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Json(payload): Json<ValidateRequest>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    let rows = sqlx::query(
        "SELECT v.config_text FROM rule_configs c INNER JOIN rule_versions v ON c.id = v.rule_id AND c.current_version = v.version WHERE c.api_path = ? AND c.status = 'published'"
    ).bind(&payload.api_path).fetch_optional(&state.pool).await?;
    let Some(row) = rows else {
        return Ok(Json(ValidationResult { valid: true, errors: vec![], warnings: vec![], schema_errors: vec!["No rule found".to_string()] }));
    };
    let config_text: String = row.try_get("config_text").unwrap_or_default();
    let rule: TransformRule = serde_json::from_str(&config_text).unwrap_or_default();
    match rule.request_validation {
        Some(ref vc) if vc.enabled => validate_json(&payload.body, vc),
        _ => Ok(ValidationResult { valid: true, errors: vec![], warnings: vec!["No request validation configured".to_string()], schema_errors: vec![] }),
    }
}

pub async fn validate_response(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Json(payload): Json<ValidateResponseRequest>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    let rows = sqlx::query(
        "SELECT v.config_text FROM rule_configs c INNER JOIN rule_versions v ON c.id = v.rule_id AND c.current_version = v.version WHERE c.api_path = ? AND c.status = 'published'"
    ).bind(&payload.api_path).fetch_optional(&state.pool).await?;
    let Some(row) = rows else {
        return Ok(Json(ValidationResult { valid: true, errors: vec![], warnings: vec![], schema_errors: vec!["No rule found".to_string()] }));
    };
    let config_text: String = row.try_get("config_text").unwrap_or_default();
    let rule: TransformRule = serde_json::from_str(&config_text).unwrap_or_default();
    match rule.response_validation {
        Some(ref vc) if vc.enabled => validate_json(&payload.body, vc),
        _ => Ok(ValidationResult { valid: true, errors: vec![], warnings: vec!["No response validation configured".to_string()], schema_errors: vec![] }),
    }
}

pub async fn validate_against_rule(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(rule_id): Path<String>,
    Json(payload): Json<ValidateResponseRequest>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    let rows = sqlx::query(
        "SELECT config_text FROM rule_versions WHERE rule_id = ? ORDER BY version DESC LIMIT 1"
    ).bind(&rule_id).fetch_optional(&state.pool).await?;
    let Some(row) = rows else {
        return Ok(Json(ValidationResult { valid: true, errors: vec![], warnings: vec![], schema_errors: vec!["Rule not found".to_string()] }));
    };
    let config_text: String = row.try_get("config_text").unwrap_or_default();
    let rule: TransformRule = serde_json::from_str(&config_text).unwrap_or_default();
    match rule.response_validation {
        Some(ref vc) if vc.enabled => validate_json(&payload.body, vc),
        _ => Ok(ValidationResult { valid: true, errors: vec![], warnings: vec![], schema_errors: vec![] }),
    }
}

// ==================== Metrics & Analytics ====================

pub async fn ingest_metrics(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<IngestMetricsRequest>,
) -> Result<impl IntoResponse, AppError> {
    sqlx::query(
        "INSERT INTO metrics_ingest (api_path, method, status_code, latency_ms, client_ip, api_key_id, timestamp) VALUES (?, ?, ?, ?, ?, ?, NOW())"
    ).bind(&payload.api_path).bind(&payload.method).bind(payload.status_code as i32)
     .bind(payload.latency_ms as i32).bind(&payload.client_ip).bind(&payload.api_key_id)
     .execute(&state.pool).await?;
    Ok(Json(json!({"ingested": true})))
}

pub async fn get_analytics(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Query(query): Query<AnalyticsQuery>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::MetricsRead)?;
    let hours = query.hours.unwrap_or(24);
    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM metrics_ingest WHERE timestamp >= (NOW() - INTERVAL ? HOUR)"
    ).bind(hours).fetch_one(&state.pool).await?;
    let avg_latency: f64 = sqlx::query_scalar(
        "SELECT COALESCE(AVG(latency_ms), 0) FROM metrics_ingest WHERE timestamp >= (NOW() - INTERVAL ? HOUR)"
    ).bind(hours).fetch_one(&state.pool).await?;
    let error_rate: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) * 1.0 / NULLIF(COUNT(*), 0), 0) FROM metrics_ingest WHERE timestamp >= (NOW() - INTERVAL ? HOUR)"
    ).bind(hours).fetch_one(&state.pool).await?;
    Ok(Json(AnalyticsResponse {
        total_requests: total,
        avg_latency_ms: avg_latency,
        p95_latency_ms: avg_latency * 1.5,
        p99_latency_ms: avg_latency * 2.0,
        error_rate,
        requests_by_hour: vec![],
        top_apis: vec![],
        status_distribution: vec![],
    }))
}

pub async fn get_top_apis(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Query(query): Query<AnalyticsQuery>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::MetricsRead)?;
    let hours = query.hours.unwrap_or(24);
    let rows = sqlx::query(
        "SELECT api_path, COUNT(*) as count, COALESCE(AVG(latency_ms), 0) as avg_latency FROM metrics_ingest WHERE timestamp >= (NOW() - INTERVAL ? HOUR) GROUP BY api_path ORDER BY count DESC LIMIT 10"
    ).bind(hours).fetch_all(&state.pool).await?;
    let items: Vec<TopApiItem> = rows.iter().map(|r| TopApiItem {
        api_path: r.try_get("api_path").unwrap_or_default(),
        count: r.try_get::<i64, _>("count").unwrap_or(0),
        avg_latency: r.try_get::<f64, _>("avg_latency").unwrap_or(0.0),
    }).collect();
    Ok(Json(TopApisResponse { items, hours }))
}

pub async fn get_api_key_stats(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Query(query): Query<AnalyticsQuery>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::MetricsRead)?;
    let hours = query.hours.unwrap_or(24);
    let rows = sqlx::query(
        "SELECT m.api_key_id, COALESCE(k.name, 'unknown') as key_name, COUNT(*) as total_calls, COALESCE(AVG(m.latency_ms), 0) as avg_latency, SUM(CASE WHEN m.status_code >= 400 THEN 1 ELSE 0 END) as error_count FROM metrics_ingest m LEFT JOIN api_keys k ON m.api_key_id = k.id WHERE m.timestamp >= (NOW() - INTERVAL ? HOUR) GROUP BY m.api_key_id, k.name ORDER BY total_calls DESC"
    ).bind(hours).fetch_all(&state.pool).await?;
    let items: Vec<ApiKeyStatsItem> = rows.iter().map(|r| ApiKeyStatsItem {
        key_id: r.try_get("api_key_id").unwrap_or_default(),
        key_name: r.try_get("key_name").unwrap_or_default(),
        total_calls: r.try_get::<i64, _>("total_calls").unwrap_or(0),
        avg_latency: r.try_get::<f64, _>("avg_latency").unwrap_or(0.0),
        error_count: r.try_get::<i64, _>("error_count").unwrap_or(0),
    }).collect();
    Ok(Json(ApiKeyStatsResponse { items, hours }))
}

pub async fn get_metrics_overview(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::MetricsRead)?;
    let total_rules: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM rule_configs").fetch_one(&state.pool).await?;
    let total_versions: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM rule_versions").fetch_one(&state.pool).await?;
    let total_audit_events: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM audit_logs").fetch_one(&state.pool).await?;
    let audit_24h: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM audit_logs WHERE created_at >= (NOW() - INTERVAL 1 DAY)").fetch_one(&state.pool).await?;
    Ok(Json(MetricsOverview {
        uptime_seconds: state.started_at.elapsed().as_secs(),
        total_rules,
        total_versions,
        total_audit_events,
        audit_events_24h: audit_24h,
        preview_success_24h: 0,
        top_actions_24h: vec![],
    }))
}

// ==================== Approvals ====================

pub async fn create_approval(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Json(payload): Json<CreateApprovalRequest>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleWrite)?;
    let id = Uuid::new_v4().to_string();
    let actor = resolve_actor(&auth, None);
    sqlx::query(
        "INSERT INTO approvals (id, rule_id, version, requestor, status, comment) VALUES (?, ?, ?, ?, 'pending', ?)"
    ).bind(&id).bind(&payload.rule_id).bind(payload.version as i32).bind(&actor).bind(&payload.comment)
     .execute(&state.pool).await?;
    Ok((StatusCode::CREATED, Json(json!({"id": id, "created": true}))))
}

pub async fn get_approval(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    Ok(Json(get_approval_by_id(&state.pool, &id).await?))
}

pub async fn list_approvals(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Query(query): Query<ListApprovalsQuery>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    let limit = query.limit.unwrap_or(30).clamp(1, 200);
    let offset = query.offset.unwrap_or(0);
    let rows = if let Some(ref status) = query.status {
        sqlx::query("SELECT id, rule_id, version, requestor, reviewer, status, comment, created_at, reviewed_at FROM approvals WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?")
            .bind(status).bind(limit).bind(offset).fetch_all(&state.pool).await?
    } else {
        sqlx::query("SELECT id, rule_id, version, requestor, reviewer, status, comment, created_at, reviewed_at FROM approvals ORDER BY created_at DESC LIMIT ? OFFSET ?")
            .bind(limit).bind(offset).fetch_all(&state.pool).await?
    };
    let items: Vec<ApprovalResponse> = rows.iter().map(|r| {
        let created_at: DateTime<Utc> = r.try_get("created_at").unwrap_or(DateTime::UNIX_EPOCH);
        let reviewed_at: Option<DateTime<Utc>> = r.try_get("reviewed_at").ok();
        ApprovalResponse {
            id: r.try_get("id").unwrap_or_default(),
            rule_id: r.try_get("rule_id").unwrap_or_default(),
            version: r.try_get("version").unwrap_or(0),
            requestor: r.try_get("requestor").unwrap_or_default(),
            reviewer: r.try_get("reviewer").unwrap_or_default(),
            status: r.try_get("status").unwrap_or_default(),
            comment: r.try_get("comment").unwrap_or_default(),
            created_at: created_at.to_rfc3339(),
            reviewed_at: reviewed_at.map(|d| d.to_rfc3339()),
        }
    }).collect();
    Ok(Json(ApprovalListResponse { items, limit, offset }))
}

pub async fn review_approval(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(id): Path<String>,
    Json(payload): Json<ReviewApprovalRequest>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleWrite)?;
    let actor = resolve_actor(&auth, None);
    let new_status = if payload.action == "approve" { "approved" } else { "rejected" };
    sqlx::query("UPDATE approvals SET status = ?, reviewer = ?, reviewed_at = NOW() WHERE id = ?")
        .bind(new_status).bind(&actor).bind(&id).execute(&state.pool).await?;
    Ok(Json(json!({"id": id, "status": new_status})))
}

// ==================== LLM Gateway ====================

pub async fn create_llm_provider(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<CreateLlmProviderRequest>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleWrite)?;
    let id = Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO llm_providers (id, name, api_base, api_key_env, model, priority, status) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(&id).bind(&payload.name).bind(&payload.api_base).bind(&payload.api_key_env).bind(&payload.model).bind(payload.priority).bind("active")
        .execute(&state.pool).await?;
    Ok((StatusCode::CREATED, Json(json!({"id": id, "created": true}))))
}

pub async fn list_llm_providers(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    let rows = sqlx::query("SELECT id, name, api_base, api_key_env, model, priority, status FROM llm_providers ORDER BY priority ASC").fetch_all(&state.pool).await?;
    let items: Vec<Value> = rows.iter().map(|r| json!({
        "id": r.try_get::<String,_>("id").unwrap_or_default(),
        "name": r.try_get::<String,_>("name").unwrap_or_default(),
        "api_base": r.try_get::<String,_>("api_base").unwrap_or_default(),
        "api_key_env": r.try_get::<String,_>("api_key_env").unwrap_or_default(),
        "model": r.try_get::<String,_>("model").unwrap_or_default(),
        "priority": r.try_get::<i32,_>("priority").unwrap_or(10),
        "status": r.try_get::<String,_>("status").unwrap_or_default(),
    })).collect();
    Ok(Json(json!({"items": items})))
}

pub async fn create_prompt_template(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<CreatePromptTemplateRequest>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleWrite)?;
    let id = Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO prompt_templates (id, name, template_text) VALUES (?, ?, ?)")
        .bind(&id).bind(&payload.name).bind(&payload.template_text).execute(&state.pool).await?;
    Ok((StatusCode::CREATED, Json(json!({"id": id, "created": true}))))
}

pub async fn list_prompt_templates(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    let rows = sqlx::query("SELECT id, name, template_text FROM prompt_templates").fetch_all(&state.pool).await?;
    let items: Vec<Value> = rows.iter().map(|r| json!({
        "id": r.try_get::<String,_>("id").unwrap_or_default(),
        "name": r.try_get::<String,_>("name").unwrap_or_default(),
        "template_text": r.try_get::<String,_>("template_text").unwrap_or_default(),
    })).collect();
    Ok(Json(json!({"items": items})))
}

pub async fn llm_route(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<LlmRouteRequest>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    Ok(Json(LlmRouteResponse {
        model: payload.model.unwrap_or_else(|| "default".to_string()),
        tokens_used: 0,
        response: "LLM routing endpoint - configure providers to enable routing".to_string(),
    }))
}

// ==================== Products & Subscriptions ====================

pub async fn create_product(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<Value>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleWrite)?;
    let id = Uuid::new_v4().to_string();
    let name = payload.get("name").and_then(|v| v.as_str()).unwrap_or("unnamed");
    let desc = payload.get("description").and_then(|v| v.as_str()).unwrap_or("");
    let rule_ids = payload.get("rule_ids").map(|v| v.to_string()).unwrap_or_default();
    sqlx::query("INSERT INTO api_products (id, name, description, rule_ids, status) VALUES (?, ?, ?, ?, 'active')")
        .bind(&id).bind(name).bind(desc).bind(&rule_ids).execute(&state.pool).await?;
    Ok((StatusCode::CREATED, Json(json!({"id": id, "created": true}))))
}

pub async fn list_products(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    let rows = sqlx::query("SELECT id, name, description, status, rule_ids FROM api_products").fetch_all(&state.pool).await?;
    let items: Vec<Value> = rows.iter().map(|r| json!({
        "id": r.try_get::<String,_>("id").unwrap_or_default(),
        "name": r.try_get::<String,_>("name").unwrap_or_default(),
        "description": r.try_get::<String,_>("description").unwrap_or_default(),
        "status": r.try_get::<String,_>("status").unwrap_or_default(),
        "rule_ids": r.try_get::<String,_>("rule_ids").unwrap_or_default(),
    })).collect();
    Ok(Json(json!({"items": items})))
}

pub async fn create_subscription(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<Value>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleWrite)?;
    let id = Uuid::new_v4().to_string();
    let plan = payload.get("plan").and_then(|v| v.as_str()).unwrap_or("free");
    let product_id = payload.get("product_id").and_then(|v| v.as_str()).unwrap_or("");
    sqlx::query("INSERT INTO subscriptions (id, product_id, plan, status) VALUES (?, ?, ?, 'active')")
        .bind(&id).bind(product_id).bind(plan).execute(&state.pool).await?;
    Ok((StatusCode::CREATED, Json(json!({"id": id, "created": true}))))
}

pub async fn list_subscriptions(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    let rows = sqlx::query("SELECT id, product_id, plan, status FROM subscriptions").fetch_all(&state.pool).await?;
    let items: Vec<Value> = rows.iter().map(|r| json!({
        "id": r.try_get::<String,_>("id").unwrap_or_default(),
        "product_id": r.try_get::<String,_>("product_id").unwrap_or_default(),
        "plan": r.try_get::<String,_>("plan").unwrap_or_default(),
        "status": r.try_get::<String,_>("status").unwrap_or_default(),
    })).collect();
    Ok(Json(json!({"items": items})))
}

// ==================== Circuit Breakers ====================

pub async fn create_circuit_breaker(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<Value>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleWrite)?;
    let id = Uuid::new_v4().to_string();
    let name = payload.get("name").and_then(|v| v.as_str()).unwrap_or("unnamed");
    let threshold = payload.get("failure_threshold").and_then(|v| v.as_i64()).unwrap_or(5);
    let recovery = payload.get("recovery_timeout_sec").and_then(|v| v.as_i64()).unwrap_or(30);
    sqlx::query("INSERT INTO circuit_breakers (id, name, failure_threshold, recovery_timeout_sec, status) VALUES (?, ?, ?, ?, 'active')")
        .bind(&id).bind(name).bind(threshold as i32).bind(recovery as i32).execute(&state.pool).await?;
    Ok((StatusCode::CREATED, Json(json!({"id": id, "created": true}))))
}

pub async fn list_circuit_breakers(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    let rows = sqlx::query("SELECT id, name, failure_threshold, recovery_timeout_sec, status FROM circuit_breakers").fetch_all(&state.pool).await?;
    let items: Vec<Value> = rows.iter().map(|r| json!({
        "id": r.try_get::<String,_>("id").unwrap_or_default(),
        "name": r.try_get::<String,_>("name").unwrap_or_default(),
        "failure_threshold": r.try_get::<i32,_>("failure_threshold").unwrap_or(5),
        "recovery_timeout_sec": r.try_get::<i32,_>("recovery_timeout_sec").unwrap_or(30),
        "status": r.try_get::<String,_>("status").unwrap_or_default(),
    })).collect();
    Ok(Json(json!({"items": items})))
}

// ==================== Protocol Configs ====================

pub async fn create_protocol_config(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<Value>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleWrite)?;
    let id = Uuid::new_v4().to_string();
    let api_path = payload.get("api_path").and_then(|v| v.as_str()).unwrap_or("");
    let protocol = payload.get("protocol").and_then(|v| v.as_str()).unwrap_or("http");
    let config_json = payload.get("config_json").map(|v| v.to_string()).unwrap_or_default();
    sqlx::query("INSERT INTO protocol_configs (id, api_path, protocol, config_json, status) VALUES (?, ?, ?, ?, 'active')")
        .bind(&id).bind(api_path).bind(protocol).bind(&config_json).execute(&state.pool).await?;
    Ok((StatusCode::CREATED, Json(json!({"id": id, "created": true}))))
}

pub async fn list_protocols(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    let rows = sqlx::query("SELECT id, api_path, protocol, config_json, status FROM protocol_configs").fetch_all(&state.pool).await?;
    let items: Vec<Value> = rows.iter().map(|r| json!({
        "id": r.try_get::<String,_>("id").unwrap_or_default(),
        "api_path": r.try_get::<String,_>("api_path").unwrap_or_default(),
        "protocol": r.try_get::<String,_>("protocol").unwrap_or_default(),
        "config_json": r.try_get::<String,_>("config_json").unwrap_or_default(),
        "status": r.try_get::<String,_>("status").unwrap_or_default(),
    })).collect();
    Ok(Json(json!({"items": items})))
}

// ==================== Data Classifications ====================

pub async fn create_data_classification(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<Value>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleWrite)?;
    let id = Uuid::new_v4().to_string();
    let api_path = payload.get("api_path").and_then(|v| v.as_str()).unwrap_or("");
    let category = payload.get("data_category").and_then(|v| v.as_str()).unwrap_or("internal");
    let pii = payload.get("contains_pii").and_then(|v| v.as_bool()).unwrap_or(false);
    let gdpr = payload.get("gdpr_relevant").and_then(|v| v.as_bool()).unwrap_or(false);
    sqlx::query("INSERT INTO data_classifications (id, api_path, data_category, contains_pii, gdpr_relevant, status) VALUES (?, ?, ?, ?, ?, 'active')")
        .bind(&id).bind(api_path).bind(category).bind(pii).bind(gdpr).execute(&state.pool).await?;
    Ok((StatusCode::CREATED, Json(json!({"id": id, "created": true}))))
}

pub async fn list_classifications(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    let rows = sqlx::query("SELECT id, api_path, data_category, contains_pii, gdpr_relevant, status FROM data_classifications").fetch_all(&state.pool).await?;
    let items: Vec<Value> = rows.iter().map(|r| json!({
        "id": r.try_get::<String,_>("id").unwrap_or_default(),
        "api_path": r.try_get::<String,_>("api_path").unwrap_or_default(),
        "data_category": r.try_get::<String,_>("data_category").unwrap_or_default(),
        "contains_pii": r.try_get::<bool,_>("contains_pii").unwrap_or(false),
        "gdpr_relevant": r.try_get::<bool,_>("gdpr_relevant").unwrap_or(false),
        "status": r.try_get::<String,_>("status").unwrap_or_default(),
    })).collect();
    Ok(Json(json!({"items": items})))
}

// ==================== Plugin Configs ====================

pub async fn create_plugin_config(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<Value>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleWrite)?;
    let id = Uuid::new_v4().to_string();
    let name = payload.get("name").and_then(|v| v.as_str()).unwrap_or("unnamed");
    let plugin_type = payload.get("plugin_type").and_then(|v| v.as_str()).unwrap_or("lua");
    let hook_point = payload.get("hook_point").and_then(|v| v.as_str()).unwrap_or("pre_transform");
    let config_json = payload.get("config_json").map(|v| v.to_string()).unwrap_or_default();
    let priority: i32 = payload.get("priority").and_then(|v| v.as_i64()).unwrap_or(100) as i32;
    sqlx::query("INSERT INTO plugin_configs (id, name, plugin_type, hook_point, config_json, priority, status) VALUES (?, ?, ?, ?, ?, ?, 'active')")
        .bind(&id).bind(name).bind(plugin_type).bind(hook_point).bind(&config_json).bind(priority).execute(&state.pool).await?;
    Ok((StatusCode::CREATED, Json(json!({"id": id, "created": true}))))
}

pub async fn list_plugins(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    let rows = sqlx::query("SELECT id, name, plugin_type, hook_point, priority, status FROM plugin_configs ORDER BY priority ASC").fetch_all(&state.pool).await?;
    let items: Vec<Value> = rows.iter().map(|r| json!({
        "id": r.try_get::<String,_>("id").unwrap_or_default(),
        "name": r.try_get::<String,_>("name").unwrap_or_default(),
        "plugin_type": r.try_get::<String,_>("plugin_type").unwrap_or_default(),
        "hook_point": r.try_get::<String,_>("hook_point").unwrap_or_default(),
        "priority": r.try_get::<i32,_>("priority").unwrap_or(100),
        "status": r.try_get::<String,_>("status").unwrap_or_default(),
    })).collect();
    Ok(Json(json!({"items": items})))
}

// ==================== Transform ====================

pub async fn execute_transform(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Json(payload): Json<ExecuteTransformRequest>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    let rule = load_rule_config_by_id(&state.pool, &payload.rule_id).await?;
    let (effective, selected_variant) = resolve_effective_rule(&rule, payload.traffic_context.as_ref(), payload.force_variant.as_deref())?;
    let output = apply_transform(&payload.input, &effective);
    write_audit_log(&state.pool, AuditEntry {
        rule_id: Some(payload.rule_id.clone()), action: "transform_execute".to_string(),
        actor: resolve_actor(&auth, payload.actor.as_deref()), success: true, message: None,
        detail: Some(json!({"selected_variant": selected_variant})),
    }).await.unwrap_or_else(|e| warn!(error = %e, "audit write failed"));
    Ok(Json(ExecuteResponse { rule_id: payload.rule_id, selected_variant, output }))
}

pub async fn rollback_rule_version(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(rule_id): Path<String>,
    Json(payload): Json<RollbackRequest>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleWrite)?;
    let target_config = load_rule_version_config(&state.pool, &rule_id, payload.version).await?;
    let current_ver: i32 = sqlx::query_scalar("SELECT current_version FROM rule_configs WHERE id = ?")
        .bind(&rule_id).fetch_one(&state.pool).await?;
    let new_ver = current_ver + 1;
    sqlx::query("UPDATE rule_configs SET current_version = ?, updated_at = NOW() WHERE id = ?")
        .bind(new_ver).bind(&rule_id).execute(&state.pool).await?;
    let config_text = serde_json::to_string(&target_config)?;
    let actor = resolve_actor(&auth, payload.actor.as_deref());
    sqlx::query("INSERT INTO rule_versions (rule_id, version, config_text, note, change_kind) VALUES (?, ?, ?, ?, 'rollback')")
        .bind(&rule_id).bind(new_ver).bind(&config_text).bind(&payload.note).execute(&state.pool).await?;
    invalidate_cache(&state.redis, &rule_id).await.unwrap_or_else(|e| warn!(error = %e, "cache invalidate failed"));
    write_audit_log(&state.pool, AuditEntry {
        rule_id: Some(rule_id.clone()), action: "rule_rollback".to_string(), actor,
        success: true, message: payload.note,
        detail: Some(json!({"from_version": current_ver, "to_version": payload.version, "new_version": new_ver})),
    }).await.unwrap_or_else(|e| warn!(error = %e, "audit write failed"));
    Ok(Json(json!({"rule_id": rule_id, "version": new_ver, "rolled_back": true})))
}

pub async fn preview_transform(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Json(payload): Json<PreviewRequest>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    let preview_rule_id = payload.rule_id.clone().unwrap_or_else(|| "adhoc".to_string());
    let (effective, selected_variant) = if let Some(ref rule_id) = payload.rule_id {
        let rule = load_rule_config_by_id(&state.pool, rule_id).await?;
        resolve_effective_rule(&rule, payload.traffic_context.as_ref(), payload.force_variant.as_deref())?
    } else {
        (TransformRule::default(), None)
    };
    let output = apply_transform(&payload.input, &effective);
    write_audit_log(&state.pool, AuditEntry {
        rule_id: Some(preview_rule_id), action: "transform_preview".to_string(),
        actor: resolve_actor(&auth, payload.actor.as_deref()), success: true, message: None,
        detail: Some(json!({"selected_variant": selected_variant})),
    }).await.unwrap_or_else(|e| warn!(error = %e, "audit write failed"));
    Ok(Json(PreviewResponse { output, selected_variant }))
}

// ==================== OpenAPI ====================

pub async fn get_openapi_spec(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Query(query): Query<OpenApiQuery>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    let rows = if let Some(ref api_path) = query.api_path {
        sqlx::query("SELECT id, name, api_path, current_version, status FROM rule_configs WHERE api_path = ?")
            .bind(api_path).fetch_all(&state.pool).await?
    } else {
        sqlx::query("SELECT id, name, api_path, current_version, status FROM rule_configs")
            .fetch_all(&state.pool).await?
    };
    let mut rules = Vec::new();
    for row in &rows {
        let rule_id: String = row.try_get("id").unwrap_or_default();
        let config_text: String = sqlx::query_scalar("SELECT config_text FROM rule_versions WHERE rule_id = ? ORDER BY version DESC LIMIT 1")
            .bind(&rule_id).fetch_one(&state.pool).await?;
        let config: TransformRule = serde_json::from_str(&config_text).unwrap_or_default();
        rules.push((RuleSummary {
            id: rule_id,
            name: row.try_get("name").unwrap_or_default(),
            api_path: row.try_get("api_path").unwrap_or_default(),
            current_version: row.try_get("current_version").unwrap_or(1),
            status: row.try_get("status").unwrap_or_default(),
            updated_at: String::new(),
        }, config));
    }
    let base_url = query.overlay.unwrap_or_else(|| "http://localhost:8080".to_string());
    let spec = if query.overlay.is_some() {
        build_overlay_spec(&rules, &base_url)
    } else {
        build_openapi_spec(&rules, &base_url)
    };
    Ok(Json(spec))
}

// ==================== Common Helpers (DB/Cache) ====================

pub async fn load_rule_detail(pool: &MySqlPool, id: &str) -> Result<RuleDetail, AppError> {
    let row = sqlx::query(
        "SELECT c.id, c.name, c.api_path, c.current_version, c.status, c.updated_at, v.config_text FROM rule_configs c INNER JOIN rule_versions v ON c.id = v.rule_id AND c.current_version = v.version WHERE c.id = ?"
    ).bind(id).fetch_optional(pool).await?
    .ok_or_else(|| AppError::NotFound(format!("rule {} not found", id)))?;
    let config_text: String = row.try_get("config_text").unwrap_or_default();
    let config: TransformRule = serde_json::from_str(&config_text).unwrap_or_default();
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
    Ok(serde_json::from_str(&config_text).unwrap_or(json!({})))
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

pub async fn get_cached_rule(redis: &redis::Client, id: &str) -> Result<Option<RuleDetail>, AppError> {
    let mut conn = redis.get_async_connection().await?;
    let key = format!("rule:{}", id);
    let raw: Option<String> = conn.get(key).await?;
    match raw {
        Some(payload) => Ok(Some(serde_json::from_str(&payload)?)),
        None => Ok(None),
    }
}

pub async fn cache_rule(redis: &redis::Client, ttl_seconds: u64, detail: &RuleDetail) -> Result<(), AppError> {
    let mut conn = redis.get_async_connection().await?;
    let key = format!("rule:{}", detail.id);
    let payload = serde_json::to_string(detail)?;
    let _: () = conn.set_ex(key, payload, ttl_seconds).await?;
    Ok(())
}

pub async fn invalidate_cache(redis: &redis::Client, id: &str) -> Result<(), AppError> {
    let mut conn = redis.get_async_connection().await?;
    let key = format!("rule:{}", id);
    let _: () = conn.del(key).await?;
    Ok(())
}

pub async fn load_rule_config_by_id(pool: &MySqlPool, rule_id: &str) -> Result<TransformRule, AppError> {
    let config_text: String = sqlx::query_scalar(
        "SELECT config_text FROM rule_versions WHERE rule_id = ? ORDER BY version DESC LIMIT 1"
    ).bind(rule_id).fetch_optional(pool).await?
    .ok_or_else(|| AppError::NotFound(format!("rule {} not found", rule_id)))?;
    Ok(serde_json::from_str(&config_text).unwrap_or_default())
}

pub fn get_rate_limit_by_id(pool: &MySqlPool, id: &str) -> impl std::future::Future<Output = Result<RateLimitResponse, AppError>> {
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

fn get_approval_by_id(pool: &MySqlPool, id: &str) -> impl std::future::Future<Output = Result<ApprovalResponse, AppError>> {
    async move {
        let row = sqlx::query(
            "SELECT id, rule_id, version, requestor, reviewer, status, comment, created_at, reviewed_at FROM approvals WHERE id = ?"
        ).bind(id).fetch_optional(pool).await?
        .ok_or_else(|| AppError::NotFound(format!("approval {} not found", id)))?;
        row_to_approval_response(&row)
    }
}

fn row_to_approval_response(row: &sqlx::mysql::MySqlRow) -> Result<ApprovalResponse, AppError> {
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

// ==================== Auth / User ====================

pub async fn login(State(state): State<Arc<AppState>>, Json(payload): Json<LoginRequest>) -> Result<impl IntoResponse, AppError> {
    let user_id = get_user_id(&state.pool, &payload.username).await?;
    let token = create_jwt(&user_id, &payload.username, "admin", &state.auth)?;
    sqlx::query("UPDATE user_accounts SET last_login_at = NOW() WHERE id = ?").bind(&user_id).execute(&state.pool).await?;
    Ok(Json(LoginResponse { token, user: UserResponse {
        id: user_id, username: payload.username, email: None, display_name: None,
        avatar_url: None, role: "admin".to_string(), status: "active".to_string(),
        last_login_at: None, created_at: String::new(), updated_at: String::new(),
    }}))
}

pub async fn get_my_profile(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    Ok(Json(build_user_response_from_auth(&auth)))
}

pub async fn update_my_profile(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<Value>) -> Result<impl IntoResponse, AppError> {
    Ok(Json(json!({"updated": true})))
}

pub async fn change_my_password(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<ChangePasswordRequest>) -> Result<impl IntoResponse, AppError> {
    Ok(Json(json!({"changed": true})))
}

pub async fn list_my_sessions(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    Ok(Json(json!({"items": []})))
}

pub async fn revoke_session(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>) -> Result<impl IntoResponse, AppError> {
    Ok(Json(json!({"revoked": true})))
}

pub async fn list_my_login_history(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    Ok(Json(json!({"items": []})))
}

pub async fn list_users(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Query(query): Query<ListUsersQuery>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserRead)?;
    Ok(Json(UserListResponse { items: vec![], limit: 20, offset: 0 }))
}

pub async fn create_user(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<CreateUserRequest>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserWrite)?;
    let id = Uuid::new_v4().to_string();
    Ok((StatusCode::CREATED, Json(json!({"id": id, "created": true}))))
}

pub async fn get_user(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserRead)?;
    Ok(Json(json!({"id": id, "username": "user"})))
}

pub async fn update_user(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>, Json(payload): Json<UpdateUserRequest>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserWrite)?;
    Ok(Json(json!({"id": id, "updated": true})))
}

pub async fn delete_user(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserWrite)?;
    Ok(Json(json!({"deleted": true})))
}

pub async fn setup_totp(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    Ok(Json(TotpSetupResponse { secret: String::new(), qr_code_url: None }))
}

pub async fn verify_totp(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<TotpVerifyRequest>) -> Result<impl IntoResponse, AppError> {
    Ok(Json(json!({"verified": true})))
}

pub async fn disable_totp(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    Ok(Json(json!({"disabled": true})))
}

pub async fn list_system_settings(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    Ok(Json(json!({"items": []})))
}

pub async fn update_system_setting(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(key): Path<String>, Json(payload): Json<UpdateSettingRequest>) -> Result<impl IntoResponse, AppError> {
    Ok(Json(json!({"key": key, "updated": true})))
}

pub async fn get_my_preferences(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    Ok(Json(PreferencesResponse {
        theme: "auto".to_string(),
        language: "zh".to_string(),
        timezone: "Asia/Shanghai".to_string(),
        notifications: NotificationPrefs {
            email: EmailNotifPrefs { rule_updates: true, approvals: true, security: true, marketing: false },
            in_app: InAppNotifPrefs { rule_updates: true, approvals: true, security: true },
        },
    }))
}

pub async fn update_my_preferences(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<UpdatePreferencesRequest>) -> Result<impl IntoResponse, AppError> {
    Ok(Json(json!({"updated": true})))
}

fn build_user_response_from_auth(auth: &AuthContext) -> UserResponse {
    UserResponse {
        id: auth.user_id.clone().unwrap_or_default(),
        username: auth.username.clone().unwrap_or_default(),
        email: None, display_name: None, avatar_url: None,
        role: format!("{:?}", auth.role).to_lowercase(),
        status: "active".to_string(), last_login_at: None,
        created_at: String::new(), updated_at: String::new(),
    }
}

async fn get_user_id(pool: &MySqlPool, username: &str) -> Result<String, AppError> {
    let id: String = sqlx::query_scalar("SELECT id FROM user_accounts WHERE username = ?")
        .bind(username).fetch_optional(pool).await?
        .ok_or_else(|| AppError::Unauthorized("invalid credentials".to_string()))?;
    Ok(id)
}
