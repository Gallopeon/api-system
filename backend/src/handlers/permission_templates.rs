use std::sync::Arc;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::{Extension, Json};
use serde_json::json;
use sqlx::Row;
use uuid::Uuid;

use crate::AppState;
use crate::types::*;
use crate::auth::*;
use crate::handlers::common::spawn_audit_log;

pub async fn list_permission_templates(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Query(query): Query<ListPermissionTemplatesQuery>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::SystemRead)?;

    let mut sql = "SELECT id, name, description, permissions, is_builtin, created_at, updated_at FROM permission_templates".to_string();
    let mut params: Vec<String> = Vec::new();

    if let Some(ref search) = query.search {
        sql.push_str(" WHERE name LIKE ? OR description LIKE ?");
        let pattern = format!("%{}%", search);
        params.push(pattern.clone());
        params.push(pattern);
    }

    sql.push_str(" ORDER BY is_builtin DESC, name ASC");

    let mut q = sqlx::query(&sql);
    for p in &params {
        q = q.bind(p);
    }

    let rows = q.fetch_all(&state.pool).await?;
    let items: Vec<PermissionTemplate> = rows.iter().map(|r| {
        let perms_json: String = r.try_get("permissions").unwrap_or_default();
        let permissions = serde_json::from_str(&perms_json).unwrap_or_default();
        PermissionTemplate {
            id: r.try_get("id").unwrap_or_default(),
            name: r.try_get("name").unwrap_or_default(),
            description: r.try_get("description").ok(),
            permissions,
            is_builtin: r.try_get::<i8, _>("is_builtin").unwrap_or(0) == 1,
            created_at: r.try_get::<chrono::DateTime<chrono::Utc>, _>("created_at").unwrap_or(chrono::DateTime::UNIX_EPOCH).to_rfc3339(),
            updated_at: r.try_get::<chrono::DateTime<chrono::Utc>, _>("updated_at").unwrap_or(chrono::DateTime::UNIX_EPOCH).to_rfc3339(),
        }
    }).collect();

    Ok(Json(PermissionTemplateListResponse { items }))
}

pub async fn get_permission_template(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::SystemRead)?;

    let row = sqlx::query(
        "SELECT id, name, description, permissions, is_builtin, created_at, updated_at FROM permission_templates WHERE id = ?"
    )
    .bind(&id)
    .fetch_optional(&state.pool).await?
    .ok_or_else(|| AppError::NotFound(format!("permission template {} not found", id)))?;

    let perms_json: String = row.try_get("permissions").unwrap_or_default();
    let permissions = serde_json::from_str(&perms_json).unwrap_or_default();

    Ok(Json(PermissionTemplate {
        id: row.try_get("id").unwrap_or_default(),
        name: row.try_get("name").unwrap_or_default(),
        description: row.try_get("description").ok(),
        permissions,
        is_builtin: row.try_get::<i8, _>("is_builtin").unwrap_or(0) == 1,
        created_at: row.try_get::<chrono::DateTime<chrono::Utc>, _>("created_at").unwrap_or(chrono::DateTime::UNIX_EPOCH).to_rfc3339(),
        updated_at: row.try_get::<chrono::DateTime<chrono::Utc>, _>("updated_at").unwrap_or(chrono::DateTime::UNIX_EPOCH).to_rfc3339(),
    }))
}

pub async fn create_permission_template(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Json(payload): Json<CreatePermissionTemplateRequest>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::SystemWrite)?;

    let id = Uuid::new_v4().to_string();
    let perms_json = serde_json::to_string(&payload.permissions).unwrap_or_default();

    sqlx::query(
        "INSERT INTO permission_templates (id, name, description, permissions) VALUES (?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(&perms_json)
    .execute(&state.pool).await?;

    spawn_audit_log(&state.pool, AuditEntry {
        rule_id: None,
        action: "permission_template_create".to_string(),
        actor: auth.subject,
        success: true,
        message: Some(format!("Permission template '{}' created", payload.name)),
        detail: Some(json!({"id": id, "name": payload.name})),
    });

    Ok((StatusCode::CREATED, Json(json!({"id": id, "created": true}))))
}

pub async fn update_permission_template(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(id): Path<String>,
    Json(payload): Json<UpdatePermissionTemplateRequest>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::SystemWrite)?;

    // Prevent modification of built-in templates
    let is_builtin: Option<i8> = sqlx::query_scalar(
        "SELECT is_builtin FROM permission_templates WHERE id = ?"
    )
    .bind(&id)
    .fetch_optional(&state.pool).await?;

    if is_builtin == Some(1) {
        return Err(AppError::Forbidden("cannot modify built-in permission templates".to_string()));
    }

    if let Some(ref name) = payload.name {
        sqlx::query("UPDATE permission_templates SET name = ? WHERE id = ?")
            .bind(name).bind(&id).execute(&state.pool).await?;
    }
    if let Some(ref description) = payload.description {
        sqlx::query("UPDATE permission_templates SET description = ? WHERE id = ?")
            .bind(description).bind(&id).execute(&state.pool).await?;
    }
    if let Some(ref permissions) = payload.permissions {
        let perms_json = serde_json::to_string(permissions).unwrap_or_default();
        sqlx::query("UPDATE permission_templates SET permissions = ? WHERE id = ?")
            .bind(&perms_json).bind(&id).execute(&state.pool).await?;
    }

    spawn_audit_log(&state.pool, AuditEntry {
        rule_id: None,
        action: "permission_template_update".to_string(),
        actor: auth.subject,
        success: true,
        message: Some(format!("Permission template {} updated", id)),
        detail: Some(json!({"id": id})),
    });

    Ok(Json(json!({"id": id, "updated": true})))
}

pub async fn delete_permission_template(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::SystemWrite)?;

    let is_builtin: Option<i8> = sqlx::query_scalar(
        "SELECT is_builtin FROM permission_templates WHERE id = ?"
    )
    .bind(&id)
    .fetch_optional(&state.pool).await?;

    if is_builtin == Some(1) {
        return Err(AppError::Forbidden("cannot delete built-in permission templates".to_string()));
    }

    // Check if any user references this template
    let in_use: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM users WHERE permission_template_id = ?"
    )
    .bind(&id)
    .fetch_one(&state.pool).await?;

    if in_use > 0 {
        return Err(AppError::Conflict(format!(
            "cannot delete template {}: {} user(s) are still using it", id, in_use
        )));
    }

    sqlx::query("DELETE FROM permission_templates WHERE id = ?")
        .bind(&id).execute(&state.pool).await?;

    spawn_audit_log(&state.pool, AuditEntry {
        rule_id: None,
        action: "permission_template_delete".to_string(),
        actor: auth.subject,
        success: true,
        message: Some(format!("Permission template {} deleted", id)),
        detail: Some(json!({"id": id})),
    });

    Ok(Json(json!({"deleted": true})))
}
