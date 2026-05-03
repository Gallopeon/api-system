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
    ensure_permission(&auth, Permission::RuleWrite)?;
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

pub async fn get_product(State(_state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    Ok(Json(json!({"id": id})))
}
pub async fn update_product(State(_state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>, Json(_payload): Json<Value>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleWrite)?;
    Ok(Json(json!({"id": id, "updated": true})))
}
pub async fn delete_product(State(_state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(_id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleWrite)?;
    Ok(Json(json!({"deleted": true})))
}

pub async fn create_subscription(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<Value>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleWrite)?;
    let id = Uuid::new_v4().to_string();
    let plan = payload.get("plan").and_then(|v| v.as_str()).unwrap_or("free");
    let product_id = payload.get("product_id").and_then(|v| v.as_str()).unwrap_or("");
    let api_key_id = payload.get("api_key_id").and_then(|v| v.as_str()).unwrap_or("");
    sqlx::query("INSERT INTO subscriptions (id, api_key_id, product_id, plan, status) VALUES (?, ?, ?, ?, 'active')")
        .bind(&id).bind(api_key_id).bind(product_id).bind(plan).execute(&state.pool).await?;
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

pub async fn get_subscription(State(_state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    Ok(Json(json!({"id": id})))
}
pub async fn update_subscription(State(_state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>, Json(_payload): Json<Value>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleWrite)?;
    Ok(Json(json!({"id": id, "updated": true})))
}
pub async fn delete_subscription(State(_state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(_id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleWrite)?;
    Ok(Json(json!({"deleted": true})))
}
