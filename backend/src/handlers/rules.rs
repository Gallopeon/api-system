use std::sync::Arc;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::{Extension, Json};
use chrono::{DateTime, Utc};
use serde_json::json;
use sqlx::Row;
use tracing::warn;
use uuid::Uuid;

use crate::AppState;
use crate::types::*;
use crate::auth::*;
use crate::engine::*;
use super::common::*;

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
    // Invalidate full list cache so next list_rules sees the new rule
    if let Err(e) = invalidate_all_rules_cache(&state.redis).await {
        warn!(error = %e, "all-rules cache invalidate failed");
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
    if let (Some(ref name), Some(ref api_path)) = (&payload.name, &payload.api_path) {
        validate_rule_request(name, api_path)?;
    }
    validate_transform_rule(&payload.config)?;

    let actor = resolve_actor(&auth, payload.actor.as_deref());
    let mut tx = state.pool.begin().await?;

    let current_ver: i32 = sqlx::query_scalar("SELECT current_version FROM rule_configs WHERE id = ?")
        .bind(&id).fetch_optional(&mut *tx).await?
        .ok_or_else(|| AppError::NotFound(format!("rule {} not found", id)))?;
    let new_ver = current_ver + 1;

    if let Some(ref name) = payload.name {
        sqlx::query("UPDATE rule_configs SET name = ? WHERE id = ?").bind(name).bind(&id)
            .execute(&mut *tx).await?;
    }
    if let Some(ref api_path) = payload.api_path {
        sqlx::query("UPDATE rule_configs SET api_path = ? WHERE id = ?").bind(api_path).bind(&id)
            .execute(&mut *tx).await?;
    }
    sqlx::query("UPDATE rule_configs SET status = ?, current_version = ?, updated_at = NOW() WHERE id = ?")
        .bind(&payload.status).bind(new_ver).bind(&id)
        .execute(&mut *tx).await?;

    let config_text = serde_json::to_string(&payload.config)?;
    let change_kind = payload.change_kind.unwrap_or_else(|| "non_breaking".to_string());
    sqlx::query("INSERT INTO rule_versions (rule_id, version, config_text, note, change_kind) VALUES (?, ?, ?, ?, ?)")
        .bind(&id).bind(new_ver).bind(config_text).bind(payload.note.clone()).bind(&change_kind)
        .execute(&mut *tx).await?;

    tx.commit().await?;

    let detail = load_rule_detail(&state.pool, &id).await?;
    if let Err(e) = cache_rule(&state.redis, state.cache_ttl_seconds, &detail).await {
        warn!(error = %e, rule_id = %id, "cache write failed");
    }
    if let Err(e) = invalidate_all_rules_cache(&state.redis).await {
        warn!(error = %e, "all-rules cache invalidate failed");
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
    // Read-through with cache-stampede protection using a Redis SET NX mutex.
    if let Some(cached) = get_cached_rule(&state.redis, &id).await.unwrap_or(None) {
        return Ok(Json(cached));
    }
    // Try to acquire the recompute lock. If another request already holds it,
    // retry the cache after a short wait instead of piling onto MySQL.
    let lock_key = format!("rule:lock:{}", id);
    if let Ok(mut conn) = state.redis.get_multiplexed_async_connection().await {
        let acquired: bool = redis::cmd("SET")
            .arg(&lock_key).arg("1").arg("NX").arg("EX").arg(5_u32)
            .query_async(&mut conn).await.unwrap_or(false);
        if !acquired {
            // Another request is refreshing — poll the cache briefly
            for _ in 0..6 {
                tokio::time::sleep(std::time::Duration::from_millis(50)).await;
                if let Some(cached) = get_cached_rule(&state.redis, &id).await.unwrap_or(None) {
                    return Ok(Json(cached));
                }
            }
        }
    }
    let detail = load_rule_detail(&state.pool, &id).await?;
    let _ = cache_rule(&state.redis, state.cache_ttl_seconds, &detail).await;
    // Release the lock (best-effort)
    if let Ok(mut conn) = state.redis.get_multiplexed_async_connection().await {
        let _: Result<(), _> = redis::cmd("DEL").arg(&lock_key).query_async(&mut conn).await;
    }
    Ok(Json(detail))
}

pub async fn delete_rule(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleWrite)?;
    let mut tx = state.pool.begin().await?;
    sqlx::query("DELETE FROM rule_versions WHERE rule_id = ?").bind(&id).execute(&mut *tx).await?;
    sqlx::query("DELETE FROM rule_configs WHERE id = ?").bind(&id).execute(&mut *tx).await?;
    tx.commit().await?;
    invalidate_cache(&state.redis, &id).await.unwrap_or_else(|e| warn!(error = %e, "cache invalidate failed"));
    if let Err(e) = invalidate_all_rules_cache(&state.redis).await {
        warn!(error = %e, "all-rules cache invalidate failed");
    }
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
    let status_filter = query.status.unwrap_or_default();
    let name_filter = query.name.unwrap_or_default();
    let api_path_filter = query.api_path.unwrap_or_default();

    let has_filters = !status_filter.is_empty() || !name_filter.is_empty() || !api_path_filter.is_empty();

    // Cache only unfiltered full list (most common case)
    if !has_filters {
        if let Ok(Some(cached)) = get_cached_all_rules(&state.redis).await {
            let total = cached.len() as i64;
            let items: Vec<RuleSummary> = cached.into_iter()
                .skip(offset as usize)
                .take(limit as usize)
                .collect();
            return Ok(Json(RuleListResponse { items, limit, offset, total }));
        }
    }

    let like_name = format!("%{}%", &name_filter);
    let like_path = format!("%{}%", &api_path_filter);

    let (rows, total) = tokio::try_join!(
        sqlx::query(
            "SELECT id, name, api_path, current_version, status, updated_at FROM rule_configs \
             WHERE (status = ? OR ? = '') \
             AND (name LIKE ? OR ? = '') \
             AND (api_path LIKE ? OR ? = '') \
             ORDER BY updated_at DESC LIMIT ? OFFSET ?"
        )
        .bind(&status_filter).bind(&status_filter)
        .bind(&like_name).bind(&name_filter)
        .bind(&like_path).bind(&api_path_filter)
        .bind(limit).bind(offset)
        .fetch_all(&state.pool),
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM rule_configs \
             WHERE (status = ? OR ? = '') \
             AND (name LIKE ? OR ? = '') \
             AND (api_path LIKE ? OR ? = '')"
        )
        .bind(&status_filter).bind(&status_filter)
        .bind(&like_name).bind(&name_filter)
        .bind(&like_path).bind(&api_path_filter)
        .fetch_one(&state.pool),
    ).map_err(|e: sqlx::Error| AppError::Internal(format!("list rules query failed: {}", e)))?;

    let items: Vec<RuleSummary> = rows.iter().map(|r| RuleSummary {
        id: r.try_get("id").unwrap_or_default(),
        name: r.try_get("name").unwrap_or_default(),
        api_path: r.try_get("api_path").unwrap_or_default(),
        current_version: r.try_get("current_version").unwrap_or(1),
        status: r.try_get("status").unwrap_or_default(),
        updated_at: r.try_get::<DateTime<Utc>, _>("updated_at").map(|d| d.to_rfc3339()).unwrap_or_default(),
    }).collect();

    // Cache the unfiltered full list for subsequent cache hits
    if !has_filters {
        let all_items: Vec<RuleSummary> = rows.into_iter().map(|r| RuleSummary {
            id: r.try_get("id").unwrap_or_default(),
            name: r.try_get("name").unwrap_or_default(),
            api_path: r.try_get("api_path").unwrap_or_default(),
            current_version: r.try_get("current_version").unwrap_or(1),
            status: r.try_get("status").unwrap_or_default(),
            updated_at: r.try_get::<DateTime<Utc>, _>("updated_at").map(|d| d.to_rfc3339()).unwrap_or_default(),
        }).collect();
        let ttl = state.cache_ttl_seconds.min(60); // cap list cache at 60s
        if let Err(e) = cache_all_rules(&state.redis, ttl, &all_items).await {
            warn!(error = %e, "all-rules cache write failed");
        }
    }

    Ok(Json(RuleListResponse { items, limit, offset, total }))
}
