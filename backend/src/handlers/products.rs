use std::sync::Arc;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::{Extension, Json};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::Row;
use uuid::Uuid;
use crate::AppState;
use crate::auth::*;
use crate::handlers::common::write_audit_log;
use crate::types::AuditEntry;

// ─── Products ──────────────────────────────────────────────────────────────────

pub async fn create_product(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Json(payload): Json<Value>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ProductsWrite)?;
    let id = Uuid::new_v4().to_string();
    let name = payload.get("name").and_then(|v| v.as_str()).unwrap_or("unnamed");
    let desc = payload.get("description").and_then(|v| v.as_str()).unwrap_or("");
    let rule_ids = extract_json_field(&payload, "rule_ids");
    let tags = extract_json_field(&payload, "tags");
    let doc_url = payload.get("documentation_url").and_then(|v| v.as_str()).unwrap_or("");
    let pricing = extract_json_field(&payload, "pricing_tiers");
    let owner = payload.get("owner")
        .and_then(|v| v.as_str())
        .unwrap_or(&auth.subject)
        .to_string();

    sqlx::query(
        "INSERT INTO api_products (id, name, description, rule_ids, status, tags, documentation_url, pricing_tiers, owner) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)"
    )
    .bind(&id).bind(name).bind(desc).bind(&rule_ids)
    .bind(&tags).bind(doc_url).bind(&pricing).bind(&owner)
    .execute(&state.pool).await?;

    let _ = write_audit_log(&state.pool, AuditEntry {
        rule_id: Some(id.clone()), action: "product.create".into(), actor: owner.clone(), success: true,
        message: Some(format!("created product {}", name)), detail: None,
    }).await;
    Ok((StatusCode::CREATED, Json(json!({"id": id, "created": true}))))
}

pub async fn list_products(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Query(params): Query<ProductListQuery>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ProductsRead)?;
    let limit = params.limit.unwrap_or(50).min(200);
    let offset = params.offset.unwrap_or(0);
    let search = params.search.unwrap_or_default();

    let (base_query, count_query) = if search.is_empty() {
        (
            "SELECT id, name, description, rule_ids, status, tags, documentation_url, pricing_tiers, owner, created_at, updated_at FROM api_products ORDER BY created_at DESC LIMIT ? OFFSET ?".to_string(),
            "SELECT COUNT(*) FROM api_products".to_string(),
        )
    } else {
        (
            format!("SELECT id, name, description, rule_ids, status, tags, documentation_url, pricing_tiers, owner, created_at, updated_at FROM api_products WHERE name LIKE '%{}%' OR description LIKE '%{}%' ORDER BY created_at DESC LIMIT ? OFFSET ?", search, search),
            format!("SELECT COUNT(*) FROM api_products WHERE name LIKE '%{}%' OR description LIKE '%{}%'", search, search),
        )
    };

    let total: i64 = sqlx::query_scalar(&count_query).fetch_one(&state.pool).await.unwrap_or(0);
    let rows = sqlx::query(&base_query).bind(limit).bind(offset).fetch_all(&state.pool).await?;

    let items: Vec<Value> = rows.iter().map(|r| product_row_to_json(r)).collect();
    Ok(Json(json!({"items": items, "limit": limit, "offset": offset, "total": total})))
}

pub async fn get_product(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ProductsRead)?;
    let row = sqlx::query(
        "SELECT id, name, description, rule_ids, status, tags, documentation_url, pricing_tiers, owner, created_at, updated_at FROM api_products WHERE id = ?"
    )
    .bind(&id).fetch_optional(&state.pool).await?
    .ok_or_else(|| AppError::NotFound(format!("product {} not found", id)))?;
    Ok(Json(product_row_to_json(&row)))
}

pub async fn update_product(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(id): Path<String>,
    Json(payload): Json<Value>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ProductsWrite)?;
    let mut set_clauses: Vec<String> = Vec::new();
    let mut bind_values: Vec<String> = Vec::new();

    try_append_str(&mut set_clauses, &mut bind_values, &payload, "name", "name");
    try_append_str(&mut set_clauses, &mut bind_values, &payload, "description", "description");
    try_append_str(&mut set_clauses, &mut bind_values, &payload, "status", "status");
    try_append_str(&mut set_clauses, &mut bind_values, &payload, "documentation_url", "documentation_url");
    try_append_str(&mut set_clauses, &mut bind_values, &payload, "owner", "owner");

    if payload.get("rule_ids").is_some() {
        set_clauses.push("rule_ids = ?".into());
        bind_values.push(payload["rule_ids"].to_string());
    }
    if payload.get("tags").is_some() {
        set_clauses.push("tags = ?".into());
        bind_values.push(payload["tags"].to_string());
    }
    if payload.get("pricing_tiers").is_some() {
        set_clauses.push("pricing_tiers = ?".into());
        bind_values.push(payload["pricing_tiers"].to_string());
    }

    if set_clauses.is_empty() {
        return Err(AppError::BadRequest("no fields to update".into()));
    }
    let query = format!("UPDATE api_products SET {} WHERE id = ?", set_clauses.join(", "));
    bind_values.push(id.clone());
    let mut q = sqlx::query(&query);
    for v in &bind_values { q = q.bind(v); }
    q.execute(&state.pool).await?;

    let _ = write_audit_log(&state.pool, AuditEntry { rule_id: Some(id.clone()), action: "product.update".into(), actor: auth.subject.clone(), success: true, message: Some("updated product".into()), detail: None }).await;
    Ok(Json(json!({"updated": true})))
}

pub async fn delete_product(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ProductsWrite)?;
    sqlx::query("UPDATE subscriptions SET status = 'cancelled' WHERE product_id = ? AND status = 'active'")
        .bind(&id).execute(&state.pool).await?;
    sqlx::query("DELETE FROM api_products WHERE id = ?").bind(&id).execute(&state.pool).await?;
    let _ = write_audit_log(&state.pool, AuditEntry { rule_id: Some(id.clone()), action: "product.delete".into(), actor: auth.subject.clone(), success: true, message: Some("deleted product and cancelled subscriptions".into()), detail: None }).await;
    Ok(Json(json!({"deleted": true})))
}

// ─── Product Subscriptions ─────────────────────────────────────────────────────

pub async fn list_product_subscriptions(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(product_id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ProductsRead)?;
    let rows = sqlx::query(
        "SELECT s.id, s.api_key_id, s.product_id, s.plan, s.rate_limit_rps, s.quota_daily, s.status, s.expires_at, s.created_at FROM subscriptions s WHERE s.product_id = ? ORDER BY s.created_at DESC"
    )
    .bind(&product_id).fetch_all(&state.pool).await?;
    let items: Vec<Value> = rows.iter().map(|r| sub_row_to_json(r)).collect();
    Ok(Json(json!({"product_id": product_id, "items": items})))
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct ProductListQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub search: Option<String>,
}

fn extract_json_field(payload: &Value, key: &str) -> Option<String> {
    payload.get(key).and_then(|v| if v.is_null() || v.as_array().map_or(false, |a| a.is_empty()) { None } else { Some(v.to_string()) })
}

fn product_row_to_json(r: &sqlx::mysql::MySqlRow) -> Value {
    json!({
        "id": r.try_get::<String,_>("id").unwrap_or_default(),
        "name": r.try_get::<String,_>("name").unwrap_or_default(),
        "description": r.try_get::<String,_>("description").unwrap_or_default(),
        "rule_ids": r.try_get::<String,_>("rule_ids").unwrap_or_default(),
        "status": r.try_get::<String,_>("status").unwrap_or_default(),
        "tags": r.try_get::<String,_>("tags").unwrap_or_default(),
        "documentation_url": r.try_get::<String,_>("documentation_url").unwrap_or_default(),
        "pricing_tiers": r.try_get::<String,_>("pricing_tiers").unwrap_or_default(),
        "owner": r.try_get::<String,_>("owner").unwrap_or_default(),
        "created_at": r.try_get::<String,_>("created_at").unwrap_or_default(),
        "updated_at": r.try_get::<String,_>("updated_at").unwrap_or_default(),
    })
}

fn sub_row_to_json(r: &sqlx::mysql::MySqlRow) -> Value {
    json!({
        "id": r.try_get::<String,_>("id").unwrap_or_default(),
        "api_key_id": r.try_get::<String,_>("api_key_id").unwrap_or_default(),
        "product_id": r.try_get::<String,_>("product_id").unwrap_or_default(),
        "plan": r.try_get::<String,_>("plan").unwrap_or_default(),
        "rate_limit_rps": r.try_get::<Option<i32>,_>("rate_limit_rps").ok().flatten(),
        "quota_daily": r.try_get::<Option<i32>,_>("quota_daily").ok().flatten(),
        "status": r.try_get::<String,_>("status").unwrap_or_default(),
        "expires_at": r.try_get::<Option<String>,_>("expires_at").ok().flatten(),
        "created_at": r.try_get::<String,_>("created_at").unwrap_or_default(),
    })
}

fn try_append_str(set: &mut Vec<String>, binds: &mut Vec<String>, payload: &Value, json_key: &str, col: &str) {
    if let Some(v) = payload.get(json_key).and_then(|v| v.as_str()) {
        set.push(format!("{} = ?", col));
        binds.push(v.to_string());
    }
}
