use std::sync::Arc;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::{Extension, Json};
use serde_json::{json, Value};
use sqlx::Row;
use uuid::Uuid;
use crate::AppState;
use crate::types::AuditEntry;
use crate::auth::*;
use super::common::spawn_audit_log;

pub async fn create_data_classification(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<Value>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ClassificationsWrite)?;
    let id = Uuid::new_v4().to_string();
    let api_path = payload.get("api_path").and_then(|v| v.as_str()).unwrap_or("");
    let category = payload.get("data_category").and_then(|v| v.as_str()).unwrap_or("internal");
    let description = payload.get("description").and_then(|v| v.as_str()).map(|s| s.to_string());
    let pii = payload.get("contains_pii").and_then(|v| v.as_bool()).unwrap_or(false);
    let gdpr = payload.get("gdpr_relevant").and_then(|v| v.as_bool()).unwrap_or(false);
    sqlx::query("INSERT INTO data_classifications (id, api_path, data_category, description, contains_pii, gdpr_relevant) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(&id).bind(api_path).bind(category).bind(&description).bind(pii).bind(gdpr).execute(&state.pool).await?;
    let actor = resolve_actor(&auth, None);
    spawn_audit_log(&state.pool, AuditEntry {
        rule_id: None, action: "classification.create".to_string(), actor,
        success: true, message: Some(format!("Data classification '{}' created", api_path)),
        detail: Some(json!({"id": id, "api_path": api_path, "data_category": category})),
    });
    Ok((StatusCode::CREATED, Json(json!({"id": id, "created": true}))))
}

pub async fn list_classifications(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ClassificationsRead)?;
    let rows = sqlx::query("SELECT id, api_path, data_category, description, contains_pii, gdpr_relevant, retention_days, notes, classified_by, created_at FROM data_classifications").fetch_all(&state.pool).await?;
    let items: Vec<Value> = rows.iter().map(|r| json!({
        "id": r.try_get::<String,_>("id").unwrap_or_default(),
        "api_path": r.try_get::<String,_>("api_path").unwrap_or_default(),
        "data_category": r.try_get::<String,_>("data_category").unwrap_or_default(),
        "description": r.try_get::<Option<String>,_>("description").ok().flatten(),
        "contains_pii": r.try_get::<bool,_>("contains_pii").unwrap_or(false),
        "gdpr_relevant": r.try_get::<bool,_>("gdpr_relevant").unwrap_or(false),
        "retention_days": r.try_get::<i32,_>("retention_days").unwrap_or(365),
        "notes": r.try_get::<String,_>("notes").unwrap_or_default(),
        "classified_by": r.try_get::<String,_>("classified_by").unwrap_or_default(),
        "created_at": r.try_get::<String,_>("created_at").unwrap_or_default(),
    })).collect();
    Ok(Json(json!({"items": items})))
}

pub async fn get_classification(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ClassificationsRead)?;
    let row = sqlx::query("SELECT id, api_path, data_category, description, contains_pii, gdpr_relevant, retention_days, notes, classified_by, created_at FROM data_classifications WHERE id = ?")
        .bind(&id).fetch_optional(&state.pool).await?
        .ok_or_else(|| AppError::NotFound(format!("classification {} not found", id)))?;
    Ok(Json(json!({
        "id": row.try_get::<String,_>("id").unwrap_or_default(),
        "api_path": row.try_get::<String,_>("api_path").unwrap_or_default(),
        "data_category": row.try_get::<String,_>("data_category").unwrap_or_default(),
        "description": row.try_get::<Option<String>,_>("description").ok().flatten(),
        "contains_pii": row.try_get::<bool,_>("contains_pii").unwrap_or(false),
        "gdpr_relevant": row.try_get::<bool,_>("gdpr_relevant").unwrap_or(false),
        "retention_days": row.try_get::<i32,_>("retention_days").unwrap_or(365),
        "notes": row.try_get::<String,_>("notes").unwrap_or_default(),
        "classified_by": row.try_get::<String,_>("classified_by").unwrap_or_default(),
        "created_at": row.try_get::<String,_>("created_at").unwrap_or_default(),
    })))
}
pub async fn update_data_classification(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>, Json(payload): Json<Value>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ClassificationsWrite)?;
    let mut set_clauses: Vec<String> = Vec::new();
    let mut bind_values: Vec<String> = Vec::new();
    if payload.get("api_path").and_then(|v| v.as_str()).is_some() {
        set_clauses.push("api_path = ?".into());
        bind_values.push(payload["api_path"].as_str().unwrap().to_string());
    }
    if payload.get("data_category").and_then(|v| v.as_str()).is_some() {
        set_clauses.push("data_category = ?".into());
        bind_values.push(payload["data_category"].as_str().unwrap().to_string());
    }
    if payload.get("description").is_some() {
        set_clauses.push("description = ?".into());
        let desc: Option<String> = payload.get("description").and_then(|v| v.as_str()).map(|s| s.to_string());
        bind_values.push(desc.unwrap_or_default());
    }
    if payload.get("contains_pii").and_then(|v| v.as_bool()).is_some() {
        set_clauses.push("contains_pii = ?".into());
        bind_values.push(if payload["contains_pii"].as_bool().unwrap_or(false) { "1".into() } else { "0".into() });
    }
    if payload.get("gdpr_relevant").and_then(|v| v.as_bool()).is_some() {
        set_clauses.push("gdpr_relevant = ?".into());
        bind_values.push(if payload["gdpr_relevant"].as_bool().unwrap_or(false) { "1".into() } else { "0".into() });
    }
    if let Some(v) = payload.get("retention_days").and_then(|v| v.as_i64()) {
        set_clauses.push("retention_days = ?".into());
        bind_values.push(v.to_string());
    }
    if payload.get("notes").is_some() {
        set_clauses.push("notes = ?".into());
        bind_values.push(payload.get("notes").and_then(|v| v.as_str()).unwrap_or("").to_string());
    }
    if payload.get("classified_by").and_then(|v| v.as_str()).is_some() {
        set_clauses.push("classified_by = ?".into());
        bind_values.push(payload["classified_by"].as_str().unwrap().to_string());
    }
    if set_clauses.is_empty() {
        return Err(AppError::BadRequest("no fields to update".into()));
    }
    let query = format!("UPDATE data_classifications SET {} WHERE id = ?", set_clauses.join(", "));
    bind_values.push(id.clone());
    let mut q = sqlx::query(&query);
    for v in &bind_values {
        q = q.bind(v);
    }
    q.execute(&state.pool).await?;
    let actor = resolve_actor(&auth, None);
    spawn_audit_log(&state.pool, AuditEntry {
        rule_id: None, action: "classification.update".to_string(), actor,
        success: true, message: Some(format!("Data classification {} updated", id)),
        detail: Some(json!({"id": id})),
    });
    Ok(Json(json!({"updated": true})))
}
pub async fn delete_data_classification(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ClassificationsWrite)?;
    sqlx::query("DELETE FROM data_classifications WHERE id = ?").bind(&id).execute(&state.pool).await?;
    let actor = resolve_actor(&auth, None);
    spawn_audit_log(&state.pool, AuditEntry {
        rule_id: None, action: "classification.delete".to_string(), actor,
        success: true, message: Some(format!("Data classification {} deleted", id)),
        detail: Some(json!({"id": id})),
    });
    Ok(Json(json!({"deleted": true})))
}
