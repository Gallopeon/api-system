use std::sync::Arc;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::{Extension, Json};
use serde_json::{json, Value};
use sqlx::Row;
use uuid::Uuid;
use crate::AppState;
use crate::auth::*;

pub async fn create_product(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<Value>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ProductsWrite)?;
    let id = Uuid::new_v4().to_string();
    let name = payload.get("name").and_then(|v| v.as_str()).unwrap_or("unnamed");
    let desc = payload.get("description").and_then(|v| v.as_str()).unwrap_or("");
    let rule_ids: Option<String> = payload.get("rule_ids")
        .and_then(|v| if v.is_null() || v.as_array().map_or(false, |a| a.is_empty()) { None } else { Some(v.to_string()) });
    sqlx::query("INSERT INTO api_products (id, name, description, rule_ids, status) VALUES (?, ?, ?, ?, 'active')")
        .bind(&id).bind(name).bind(desc).bind(&rule_ids).execute(&state.pool).await?;
    Ok((StatusCode::CREATED, Json(json!({"id": id, "created": true}))))
}

pub async fn list_products(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ProductsRead)?;
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

pub async fn get_product(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ProductsRead)?;
    let row = sqlx::query("SELECT id, name, description, rule_ids, status FROM api_products WHERE id = ?")
        .bind(&id).fetch_optional(&state.pool).await?
        .ok_or_else(|| AppError::NotFound(format!("product {} not found", id)))?;
    Ok(Json(json!({
        "id": row.try_get::<String,_>("id").unwrap_or_default(),
        "name": row.try_get::<String,_>("name").unwrap_or_default(),
        "description": row.try_get::<String,_>("description").unwrap_or_default(),
        "rule_ids": row.try_get::<String,_>("rule_ids").unwrap_or_default(),
        "status": row.try_get::<String,_>("status").unwrap_or_default(),
    })))
}
pub async fn update_product(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>, Json(payload): Json<Value>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ProductsWrite)?;
    let mut set_clauses: Vec<String> = Vec::new();
    let mut bind_values: Vec<String> = Vec::new();
    if payload.get("name").and_then(|v| v.as_str()).is_some() {
        set_clauses.push("name = ?".into());
        bind_values.push(payload["name"].as_str().unwrap().to_string());
    }
    if payload.get("description").is_some() {
        set_clauses.push("description = ?".into());
        bind_values.push(payload.get("description").and_then(|v| v.as_str()).unwrap_or("").to_string());
    }
    if payload.get("rule_ids").is_some() {
        set_clauses.push("rule_ids = ?".into());
        bind_values.push(payload["rule_ids"].to_string());
    }
    if payload.get("status").and_then(|v| v.as_str()).is_some() {
        set_clauses.push("status = ?".into());
        bind_values.push(payload["status"].as_str().unwrap().to_string());
    }
    if set_clauses.is_empty() {
        return Err(AppError::BadRequest("no fields to update".into()));
    }
    let query = format!("UPDATE api_products SET {} WHERE id = ?", set_clauses.join(", "));
    bind_values.push(id.clone());
    let mut q = sqlx::query(&query);
    for v in &bind_values {
        q = q.bind(v);
    }
    q.execute(&state.pool).await?;
    Ok(Json(json!({"updated": true})))
}
pub async fn delete_product(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ProductsWrite)?;
    sqlx::query("DELETE FROM api_products WHERE id = ?").bind(&id).execute(&state.pool).await?;
    Ok(Json(json!({"deleted": true})))
}

pub async fn create_subscription(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<Value>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ProductsWrite)?;
    let id = Uuid::new_v4().to_string();
    let plan = payload.get("plan").and_then(|v| v.as_str()).unwrap_or("free");
    let product_id = payload.get("product_id").and_then(|v| v.as_str()).unwrap_or("");
    let api_key_id = payload.get("api_key_id").and_then(|v| v.as_str()).unwrap_or("");
    sqlx::query("INSERT INTO subscriptions (id, api_key_id, product_id, plan, status) VALUES (?, ?, ?, ?, 'active')")
        .bind(&id).bind(api_key_id).bind(product_id).bind(plan).execute(&state.pool).await?;
    Ok((StatusCode::CREATED, Json(json!({"id": id, "created": true}))))
}

pub async fn list_subscriptions(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ProductsRead)?;
    let rows = sqlx::query("SELECT id, product_id, plan, status FROM subscriptions").fetch_all(&state.pool).await?;
    let items: Vec<Value> = rows.iter().map(|r| json!({
        "id": r.try_get::<String,_>("id").unwrap_or_default(),
        "product_id": r.try_get::<String,_>("product_id").unwrap_or_default(),
        "plan": r.try_get::<String,_>("plan").unwrap_or_default(),
        "status": r.try_get::<String,_>("status").unwrap_or_default(),
    })).collect();
    Ok(Json(json!({"items": items})))
}

pub async fn get_subscription(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ProductsRead)?;
    let row = sqlx::query("SELECT id, api_key_id, product_id, plan, rate_limit_rps, quota_daily, status, expires_at, created_at FROM subscriptions WHERE id = ?")
        .bind(&id).fetch_optional(&state.pool).await?
        .ok_or_else(|| AppError::NotFound(format!("subscription {} not found", id)))?;
    Ok(Json(json!({
        "id": row.try_get::<String,_>("id").unwrap_or_default(),
        "api_key_id": row.try_get::<String,_>("api_key_id").unwrap_or_default(),
        "product_id": row.try_get::<String,_>("product_id").unwrap_or_default(),
        "plan": row.try_get::<String,_>("plan").unwrap_or_default(),
        "rate_limit_rps": row.try_get::<Option<i32>,_>("rate_limit_rps").ok().flatten(),
        "quota_daily": row.try_get::<Option<i32>,_>("quota_daily").ok().flatten(),
        "status": row.try_get::<String,_>("status").unwrap_or_default(),
        "expires_at": row.try_get::<Option<String>,_>("expires_at").ok().flatten(),
        "created_at": row.try_get::<String,_>("created_at").unwrap_or_default(),
    })))
}
pub async fn update_subscription(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>, Json(payload): Json<Value>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ProductsWrite)?;
    let mut set_clauses: Vec<String> = Vec::new();
    let mut bind_values: Vec<String> = Vec::new();
    if payload.get("plan").and_then(|v| v.as_str()).is_some() {
        set_clauses.push("plan = ?".into());
        bind_values.push(payload["plan"].as_str().unwrap().to_string());
    }
    if payload.get("status").and_then(|v| v.as_str()).is_some() {
        set_clauses.push("status = ?".into());
        bind_values.push(payload["status"].as_str().unwrap().to_string());
    }
    if let Some(v) = payload.get("rate_limit_rps").and_then(|v| v.as_i64()) {
        set_clauses.push("rate_limit_rps = ?".into());
        bind_values.push(v.to_string());
    }
    if let Some(v) = payload.get("quota_daily").and_then(|v| v.as_i64()) {
        set_clauses.push("quota_daily = ?".into());
        bind_values.push(v.to_string());
    }
    if payload.get("expires_at").is_some() {
        set_clauses.push("expires_at = ?".into());
        bind_values.push(payload.get("expires_at").and_then(|v| v.as_str()).unwrap_or("").to_string());
    }
    if set_clauses.is_empty() {
        return Err(AppError::BadRequest("no fields to update".into()));
    }
    let query = format!("UPDATE subscriptions SET {} WHERE id = ?", set_clauses.join(", "));
    bind_values.push(id.clone());
    let mut q = sqlx::query(&query);
    for v in &bind_values {
        q = q.bind(v);
    }
    q.execute(&state.pool).await?;
    Ok(Json(json!({"updated": true})))
}
pub async fn delete_subscription(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ProductsWrite)?;
    sqlx::query("DELETE FROM subscriptions WHERE id = ?").bind(&id).execute(&state.pool).await?;
    Ok(Json(json!({"deleted": true})))
}
