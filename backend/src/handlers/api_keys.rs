use std::sync::Arc;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::{Extension, Json};
use chrono::{DateTime, Utc};
use serde_json::json;
use sqlx::Row;
use uuid::Uuid;

use crate::AppState;
use crate::types::*;
use crate::auth::*;
use crate::engine::*;
use super::common::spawn_audit_log;

pub async fn create_api_key(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Json(payload): Json<CreateApiKeyRequest>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ApiKeyWrite)?;
    let id = Uuid::new_v4().to_string();
    let actor = resolve_actor(&auth, payload.actor.as_deref());
    let (key, key_hash) = generate_api_key();
    let scopes_json: Option<String> = payload.scopes
        .filter(|v| !v.is_empty())
        .map(|v| serde_json::to_string(&v).unwrap_or_default());
    sqlx::query(
        "INSERT INTO api_keys (id, key_hash, key_prefix, name, status, scopes, expires_at, max_calls, call_count, tenant_id, created_by) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, 0, ?, ?)"
    ).bind(&id).bind(&key_hash).bind(&key[..8].to_string()).bind(&payload.name)
     .bind(&scopes_json)
     .bind(&payload.expires_at).bind(payload.max_calls.unwrap_or(-1))
     .bind(&payload.tenant_id).bind(&actor)
     .execute(&state.pool).await?;
    spawn_audit_log(&state.pool, AuditEntry {
        rule_id: None, action: "api_key_create".to_string(), actor: actor.clone(),
        success: true, message: Some(format!("API key '{}' created", payload.name)),
        detail: Some(json!({"name": payload.name, "id": id})),
    });
    Ok((StatusCode::CREATED, Json(json!({"id": id, "api_key": key, "created": true}))))
}

pub async fn list_api_keys(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Query(query): Query<ListApiKeysQuery>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ApiKeyRead)?;
    let limit = query.limit.unwrap_or(20).clamp(1, 100);
    let offset = query.offset.unwrap_or(0);
    let rows = if let Some(ref status) = query.status {
        sqlx::query("SELECT id, key_prefix, name, status, scopes, expires_at, max_calls, call_count, tenant_id, created_by, created_at, updated_at FROM api_keys WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?")
            .bind(status).bind(limit).bind(offset).fetch_all(&state.pool).await?
    } else {
        sqlx::query("SELECT id, key_prefix, name, status, scopes, expires_at, max_calls, call_count, tenant_id, created_by, created_at, updated_at FROM api_keys ORDER BY created_at DESC LIMIT ? OFFSET ?")
            .bind(limit).bind(offset).fetch_all(&state.pool).await?
    };
    let items: Vec<ApiKeyResponse> = rows.iter().map(|r| {
        let created_at: DateTime<Utc> = r.try_get("created_at").unwrap_or(DateTime::UNIX_EPOCH);
        let updated_at: DateTime<Utc> = r.try_get("updated_at").unwrap_or(DateTime::UNIX_EPOCH);
        let scopes_str: Option<String> = r.try_get("scopes").ok();
        ApiKeyResponse {
            id: r.try_get("id").unwrap_or_default(),
            key: None,
            key_prefix: r.try_get("key_prefix").unwrap_or_default(),
            name: r.try_get("name").unwrap_or_default(),
            status: r.try_get("status").unwrap_or_default(),
            scopes: parse_scopes(scopes_str.as_deref()),
            expires_at: r.try_get("expires_at").ok(),
            max_calls: r.try_get("max_calls").ok(),
            call_count: r.try_get("call_count").unwrap_or(0),
            tenant_id: r.try_get("tenant_id").ok(),
            created_by: r.try_get("created_by").unwrap_or_default(),
            created_at: created_at.to_rfc3339(),
            updated_at: updated_at.to_rfc3339(),
        }
    }).collect();
    Ok(Json(ApiKeyListResponse { items, limit, offset }))
}

pub async fn get_api_key(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ApiKeyRead)?;
    let row = sqlx::query("SELECT id, key_prefix, name, status, scopes, expires_at, max_calls, call_count, tenant_id, created_by, created_at, updated_at FROM api_keys WHERE id = ?")
        .bind(&id).fetch_optional(&state.pool).await?
        .ok_or_else(|| AppError::NotFound(format!("api key {} not found", id)))?;
    let created_at: DateTime<Utc> = row.try_get("created_at").unwrap_or(DateTime::UNIX_EPOCH);
    let updated_at: DateTime<Utc> = row.try_get("updated_at").unwrap_or(DateTime::UNIX_EPOCH);
    let scopes_str: Option<String> = row.try_get("scopes").ok();
    Ok(Json(ApiKeyResponse {
        id: row.try_get("id").unwrap_or_default(),
        key: None,
        key_prefix: row.try_get("key_prefix").unwrap_or_default(),
        name: row.try_get("name").unwrap_or_default(),
        status: row.try_get("status").unwrap_or_default(),
        scopes: parse_scopes(scopes_str.as_deref()),
        expires_at: row.try_get("expires_at").ok(),
        max_calls: row.try_get("max_calls").ok(),
        call_count: row.try_get("call_count").unwrap_or(0),
        tenant_id: row.try_get("tenant_id").ok(),
        created_by: row.try_get("created_by").unwrap_or_default(),
        created_at: created_at.to_rfc3339(),
        updated_at: updated_at.to_rfc3339(),
    }))
}

pub async fn update_api_key(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateApiKeyRequest>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ApiKeyWrite)?;
    if let Some(ref name) = payload.name {
        sqlx::query("UPDATE api_keys SET name = ? WHERE id = ?").bind(name).bind(&id).execute(&state.pool).await?;
    }
    if let Some(ref status) = payload.status {
        sqlx::query("UPDATE api_keys SET status = ? WHERE id = ?").bind(status).bind(&id).execute(&state.pool).await?;
    }
    if let Some(ref scopes) = payload.scopes {
        if !scopes.is_empty() {
            let json_val = serde_json::to_string(scopes).unwrap_or_default();
            sqlx::query("UPDATE api_keys SET scopes = ? WHERE id = ?").bind(&json_val).bind(&id).execute(&state.pool).await?;
        }
    }
    let actor = resolve_actor(&auth, None);
    spawn_audit_log(&state.pool, AuditEntry {
        rule_id: None, action: "api_key_update".to_string(), actor,
        success: true, message: Some(format!("API key {} updated", id)),
        detail: Some(json!({"id": id, "status": payload.status, "name": payload.name})),
    });
    Ok(Json(json!({"id": id, "updated": true})))
}

pub async fn delete_api_key(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ApiKeyWrite)?;
    sqlx::query("DELETE FROM api_keys WHERE id = ?").bind(&id).execute(&state.pool).await?;
    let actor = resolve_actor(&auth, None);
    spawn_audit_log(&state.pool, AuditEntry {
        rule_id: None, action: "api_key_delete".to_string(), actor,
        success: true, message: Some(format!("API key {} deleted", id)),
        detail: Some(json!({"id": id})),
    });
    Ok(Json(json!({"deleted": true})))
}

fn parse_scopes(raw: Option<&str>) -> Option<Vec<String>> {
    let s = raw?;
    if s.is_empty() { return None; }
    serde_json::from_str::<Vec<String>>(s).ok()
}

pub async fn validate_api_key(
    State(state): State<Arc<AppState>>,
    Extension(_auth): Extension<AuthContext>,
    Json(payload): Json<ValidateApiKeyRequest>,
) -> Result<impl IntoResponse, AppError> {
    let hash = key_hash(&payload.api_key);
    let row = sqlx::query("SELECT id, status, scopes, expires_at, max_calls, call_count FROM api_keys WHERE key_hash = ?")
        .bind(&hash).fetch_optional(&state.pool).await?;
    match row {
        Some(row) => {
            let status: String = row.try_get("status").unwrap_or_default();
            if status != "active" {
                return Ok(Json(ApiKeyValidateResponse { valid: false, reason: Some("key is revoked or disabled".to_string()), scopes: None }));
            }
            Ok(Json(ApiKeyValidateResponse { valid: true, reason: None, scopes: None }))
        }
        None => Ok(Json(ApiKeyValidateResponse { valid: false, reason: Some("key not found".to_string()), scopes: None })),
    }
}
