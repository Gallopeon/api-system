use std::sync::Arc;
use axum::extract::{Path, Query, State};
use axum::response::IntoResponse;
use axum::{Extension, Json};
use chrono::{DateTime, Utc};
use serde_json::json;
use sqlx::Row;
use tracing::warn;

use crate::AppState;
use crate::types::*;
use crate::auth::*;
use crate::engine::*;
use super::common::*;

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
        config: serde_json::from_str(r.try_get("config_text").unwrap_or("{}")).unwrap_or_default(),
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

pub async fn rollback_rule_version(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(rule_id): Path<String>,
    Json(payload): Json<RollbackRequest>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleWrite)?;
    let target_config = load_rule_version_config(&state.pool, &rule_id, payload.version).await?;
    let mut txn = state.pool.begin().await?;
    let current_ver: i32 = sqlx::query_scalar("SELECT current_version FROM rule_configs WHERE id = ?")
        .bind(&rule_id).fetch_one(&mut *txn).await?;
    let new_ver = current_ver + 1;
    sqlx::query("UPDATE rule_configs SET current_version = ?, updated_at = NOW() WHERE id = ?")
        .bind(new_ver).bind(&rule_id).execute(&mut *txn).await?;
    let config_text = serde_json::to_string(&target_config)?;
    let actor = resolve_actor(&auth, payload.actor.as_deref());
    sqlx::query("INSERT INTO rule_versions (rule_id, version, config_text, note, change_kind) VALUES (?, ?, ?, ?, 'rollback')")
        .bind(&rule_id).bind(new_ver).bind(&config_text).bind(&payload.note).execute(&mut *txn).await?;
    txn.commit().await?;
    invalidate_cache(&state.redis, &rule_id).await.unwrap_or_else(|e| warn!(error = %e, "cache invalidate failed"));
    spawn_audit_log(&state.pool, AuditEntry {
        rule_id: Some(rule_id.clone()), action: "rule_rollback".to_string(), actor,
        success: true, message: payload.note,
        detail: Some(json!({"from_version": current_ver, "to_version": payload.version, "new_version": new_ver})),
    });
    Ok(Json(json!({"rule_id": rule_id, "version": new_ver, "rolled_back": true})))
}
