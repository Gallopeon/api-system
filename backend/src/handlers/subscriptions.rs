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
use crate::handlers::common::spawn_audit_log;
use crate::types::AuditEntry;

// ─── Subscriptions CRUD ────────────────────────────────────────────────────────

pub async fn create_subscription(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Json(payload): Json<Value>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ProductsWrite)?;
    let id = Uuid::new_v4().to_string();
    let plan = payload.get("plan").and_then(|v| v.as_str()).unwrap_or("free");
    let product_id = payload.get("product_id").and_then(|v| v.as_str()).unwrap_or("");
    let api_key_id = payload.get("api_key_id").and_then(|v| v.as_str()).unwrap_or("");
    let rate_limit_rps = payload.get("rate_limit_rps").and_then(|v| v.as_i64());
    let quota_daily = payload.get("quota_daily").and_then(|v| v.as_i64());
    let expires_at = payload.get("expires_at").and_then(|v| v.as_str());

    sqlx::query(
        "INSERT INTO subscriptions (id, api_key_id, product_id, plan, rate_limit_rps, quota_daily, expires_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')"
    )
    .bind(&id).bind(api_key_id).bind(product_id).bind(plan)
    .bind(rate_limit_rps).bind(quota_daily).bind(expires_at)
    .execute(&state.pool).await?;

    spawn_audit_log(&state.pool, AuditEntry { rule_id: Some(id.clone()), action: "subscription.create".into(), actor: auth.subject.clone(), success: true, message: Some(format!("subscribed key {} to product {} plan {}", api_key_id, product_id, plan)), detail: None });
    Ok((StatusCode::CREATED, Json(json!({"id": id, "created": true}))))
}

pub async fn list_subscriptions(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Query(params): Query<SubscriptionListQuery>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ProductsRead)?;
    let limit = params.limit.unwrap_or(50).min(200);
    let offset = params.offset.unwrap_or(0);

    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM subscriptions").fetch_one(&state.pool).await.unwrap_or(0);
    let rows = sqlx::query(
        "SELECT s.id, s.api_key_id, s.product_id, s.plan, s.rate_limit_rps, s.quota_daily, s.status, s.expires_at, s.created_at FROM subscriptions s ORDER BY s.created_at DESC LIMIT ? OFFSET ?"
    )
    .bind(limit).bind(offset).fetch_all(&state.pool).await?;

    let items: Vec<Value> = rows.iter().map(|r| sub_row_to_json(r)).collect();
    Ok(Json(json!({"items": items, "limit": limit, "offset": offset, "total": total})))
}

pub async fn get_subscription(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ProductsRead)?;
    let row = sqlx::query(
        "SELECT s.id, s.api_key_id, s.product_id, s.plan, s.rate_limit_rps, s.quota_daily, s.status, s.expires_at, s.created_at FROM subscriptions s WHERE s.id = ?"
    )
    .bind(&id).fetch_optional(&state.pool).await?
    .ok_or_else(|| AppError::NotFound(format!("subscription {} not found", id)))?;
    Ok(Json(sub_row_to_json(&row)))
}

pub async fn update_subscription(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(id): Path<String>,
    Json(payload): Json<Value>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ProductsWrite)?;
    let mut set_clauses: Vec<String> = Vec::new();
    let mut bind_values: Vec<String> = Vec::new();

    try_append_str(&mut set_clauses, &mut bind_values, &payload, "plan", "plan");
    try_append_str(&mut set_clauses, &mut bind_values, &payload, "status", "status");
    try_append_str(&mut set_clauses, &mut bind_values, &payload, "expires_at", "expires_at");
    try_append_str(&mut set_clauses, &mut bind_values, &payload, "product_id", "product_id");
    try_append_str(&mut set_clauses, &mut bind_values, &payload, "api_key_id", "api_key_id");

    if let Some(v) = payload.get("rate_limit_rps").and_then(|v| v.as_i64()) {
        set_clauses.push("rate_limit_rps = ?".into());
        bind_values.push(v.to_string());
    }
    if let Some(v) = payload.get("quota_daily").and_then(|v| v.as_i64()) {
        set_clauses.push("quota_daily = ?".into());
        bind_values.push(v.to_string());
    }

    if set_clauses.is_empty() {
        return Err(AppError::BadRequest("no fields to update".into()));
    }
    let query = format!("UPDATE subscriptions SET {} WHERE id = ?", set_clauses.join(", "));
    bind_values.push(id.clone());
    let mut q = sqlx::query(&query);
    for v in &bind_values { q = q.bind(v); }
    q.execute(&state.pool).await?;

    spawn_audit_log(&state.pool, AuditEntry { rule_id: Some(id.clone()), action: "subscription.update".into(), actor: auth.subject.clone(), success: true, message: Some("updated subscription".into()), detail: None });
    Ok(Json(json!({"updated": true})))
}

pub async fn delete_subscription(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ProductsWrite)?;
    sqlx::query("DELETE FROM subscriptions WHERE id = ?").bind(&id).execute(&state.pool).await?;
    spawn_audit_log(&state.pool, AuditEntry { rule_id: Some(id.clone()), action: "subscription.delete".into(), actor: auth.subject.clone(), success: true, message: Some("deleted subscription".into()), detail: None });
    Ok(Json(json!({"deleted": true})))
}

// ─── Subscription Lifecycle ────────────────────────────────────────────────────

pub async fn get_subscription_usage(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ProductsRead)?;
    let sub = sqlx::query("SELECT api_key_id, quota_daily FROM subscriptions WHERE id = ?")
        .bind(&id).fetch_optional(&state.pool).await?
        .ok_or_else(|| AppError::NotFound(format!("subscription {} not found", id)))?;

    let api_key_id: String = sub.try_get("api_key_id").unwrap_or_default();
    let quota_daily: Option<i32> = sub.try_get("quota_daily").ok().flatten();

    let calls_24h: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM metrics_ingest WHERE api_key_id = ? AND timestamp >= NOW() - INTERVAL 24 HOUR"
    )
    .bind(&api_key_id).fetch_one(&state.pool).await.unwrap_or(0);

    let calls_today: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM metrics_ingest WHERE api_key_id = ? AND timestamp >= CURDATE()"
    )
    .bind(&api_key_id).fetch_one(&state.pool).await.unwrap_or(0);

    let quota_pct = match quota_daily {
        Some(q) if q > 0 => Some(((calls_today as f64 / q as f64) * 100.0).round()),
        _ => None,
    };

    Ok(Json(json!({
        "subscription_id": id,
        "api_key_id": api_key_id,
        "calls_24h": calls_24h,
        "calls_today": calls_today,
        "quota_daily": quota_daily,
        "quota_used_pct": quota_pct,
    })))
}

pub async fn upgrade_subscription(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(id): Path<String>,
    Json(payload): Json<Value>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ProductsWrite)?;
    let new_plan = payload.get("plan").and_then(|v| v.as_str()).unwrap_or("");
    if new_plan.is_empty() {
        return Err(AppError::BadRequest("plan is required".into()));
    }

    let current = sqlx::query("SELECT plan FROM subscriptions WHERE id = ?")
        .bind(&id).fetch_optional(&state.pool).await?
        .ok_or_else(|| AppError::NotFound(format!("subscription {} not found", id)))?;
    let old_plan: String = current.try_get("plan").unwrap_or_default();

    let (rps, quota) = match new_plan {
        "enterprise" => (Some(1000i64), Some(100000i64)),
        "pro" => (Some(100i64), Some(10000i64)),
        _ => (Some(10i64), Some(1000i64)),
    };

    sqlx::query("UPDATE subscriptions SET plan = ?, rate_limit_rps = ?, quota_daily = ? WHERE id = ?")
        .bind(new_plan).bind(rps).bind(quota).bind(&id)
        .execute(&state.pool).await?;

    spawn_audit_log(&state.pool, AuditEntry { rule_id: Some(id.clone()), action: "subscription.upgrade".into(), actor: auth.subject.clone(), success: true, message: Some(format!("plan {} -> {}", old_plan, new_plan)), detail: None });
    Ok(Json(json!({"updated": true, "plan": new_plan, "rate_limit_rps": rps, "quota_daily": quota})))
}

pub async fn cancel_subscription(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ProductsWrite)?;
    let affected = sqlx::query("UPDATE subscriptions SET status = 'cancelled' WHERE id = ? AND status = 'active'")
        .bind(&id).execute(&state.pool).await?;
    if affected.rows_affected() == 0 {
        return Err(AppError::NotFound("subscription not found or already cancelled".into()));
    }
    spawn_audit_log(&state.pool, AuditEntry { rule_id: Some(id.clone()), action: "subscription.cancel".into(), actor: auth.subject.clone(), success: true, message: Some("cancelled subscription".into()), detail: None });
    Ok(Json(json!({"cancelled": true})))
}

pub async fn renew_subscription(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(id): Path<String>,
    Json(payload): Json<Value>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ProductsWrite)?;
    let new_expiry = payload.get("expires_at").and_then(|v| v.as_str()).unwrap_or("");
    if new_expiry.is_empty() {
        return Err(AppError::BadRequest("expires_at is required".into()));
    }
    sqlx::query("UPDATE subscriptions SET status = 'active', expires_at = ? WHERE id = ?")
        .bind(new_expiry).bind(&id).execute(&state.pool).await?;
    spawn_audit_log(&state.pool, AuditEntry { rule_id: Some(id.clone()), action: "subscription.renew".into(), actor: auth.subject.clone(), success: true, message: Some(format!("renewed until {}", new_expiry)), detail: None });
    Ok(Json(json!({"renewed": true, "expires_at": new_expiry})))
}

// ─── Portal self-service ──────────────────────────────────────────────────────

pub async fn subscribe_me(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Json(payload): Json<Value>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserSelf)?;
    let product_id = payload.get("product_id").and_then(|v| v.as_str()).unwrap_or("");
    let api_key_id = payload.get("api_key_id").and_then(|v| v.as_str()).unwrap_or("");
    let plan = payload.get("plan").and_then(|v| v.as_str()).unwrap_or("free");

    if product_id.is_empty() || api_key_id.is_empty() {
        return Err(AppError::BadRequest("product_id and api_key_id are required".into()));
    }

    // Verify the API key belongs to the authenticated user
    let key_owner: String = sqlx::query_scalar("SELECT created_by FROM api_keys WHERE id = ?")
        .bind(api_key_id)
        .fetch_optional(&state.pool)
        .await?
        .unwrap_or_default();

    if key_owner != auth.subject {
        return Err(AppError::Forbidden("This API key does not belong to you".into()));
    }

    // Check for existing active subscription for this key+product pair
    let existing: Option<String> = sqlx::query_scalar(
        "SELECT id FROM subscriptions WHERE api_key_id = ? AND product_id = ? AND status = 'active'"
    )
    .bind(api_key_id).bind(product_id)
    .fetch_optional(&state.pool).await?;

    if existing.is_some() {
        return Err(AppError::Conflict("You already have an active subscription to this product with this key".into()));
    }

    // Resolve pricing tier for the selected plan
    let product = sqlx::query("SELECT pricing_tiers FROM api_products WHERE id = ?")
        .bind(product_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Product not found".into()))?;

    let tiers_str: Option<String> = product.try_get("pricing_tiers").ok();
    let mut rate_limit_rps: Option<i64> = None;
    let mut quota_daily: Option<i64> = None;

    if let Some(ref json_str) = tiers_str {
        if let Ok(tiers) = serde_json::from_str::<Vec<Value>>(json_str) {
            for tier in &tiers {
                if tier.get("name").and_then(|v| v.as_str()).unwrap_or("") == plan {
                    rate_limit_rps = tier.get("rate_limit_rps").and_then(|v| v.as_i64());
                    quota_daily = tier.get("quota_daily").and_then(|v| v.as_i64());
                    break;
                }
            }
        }
    }

    let id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO subscriptions (id, api_key_id, product_id, plan, rate_limit_rps, quota_daily, status) VALUES (?, ?, ?, ?, ?, ?, 'active')"
    )
    .bind(&id).bind(api_key_id).bind(product_id).bind(plan)
    .bind(rate_limit_rps).bind(quota_daily)
    .execute(&state.pool).await?;

    spawn_audit_log(&state.pool, AuditEntry {
        rule_id: Some(id.clone()),
        action: "subscription.subscribe".into(),
        actor: auth.subject.clone(),
        success: true,
        message: Some(format!("User subscribed key {} to product {} with plan {}", api_key_id, product_id, plan)),
        detail: None,
    });

    Ok((StatusCode::CREATED, Json(json!({
        "id": id,
        "created": true,
        "plan": plan,
        "rate_limit_rps": rate_limit_rps,
        "quota_daily": quota_daily,
    }))))
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct SubscriptionListQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
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
