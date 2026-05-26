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
use crate::handlers::common::{spawn_audit_log, fmt_dt_naive};
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

    spawn_audit_log(&state.pool, AuditEntry {
        rule_id: Some(id.clone()), action: "product.create".into(), actor: owner.clone(), success: true,
        message: Some(format!("created product {}", name)), detail: None,
    });
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
    let admin = user_has_permission(&auth, Permission::UserManage);

    let owner_filter = if admin { String::new() } else { "WHERE owner = ?".to_string() };
    let owner_clause = if admin { String::new() } else { "AND owner = ?".to_string() };

    let (base_query, count_query, count_binds, base_binds): (String, String, Vec<String>, Vec<String>) = if search.is_empty() {
        (
            format!("SELECT id, name, description, rule_ids, status, tags, documentation_url, pricing_tiers, owner, created_at, updated_at FROM api_products {owner_filter} ORDER BY created_at DESC LIMIT ? OFFSET ?"),
            format!("SELECT COUNT(*) FROM api_products {owner_filter}"),
            if admin { vec![] } else { vec![auth.subject.clone()] },
            {
                let mut b: Vec<String> = if admin { vec![] } else { vec![auth.subject.clone()] };
                b.push(limit.to_string());
                b.push(offset.to_string());
                b
            },
        )
    } else {
        let like = format!("%{}%", search.replace('%', "\\%").replace('_', "\\_"));
        (
            format!("SELECT id, name, description, rule_ids, status, tags, documentation_url, pricing_tiers, owner, created_at, updated_at FROM api_products WHERE (name LIKE ? OR description LIKE ?) {owner_clause} ORDER BY created_at DESC LIMIT ? OFFSET ?"),
            format!("SELECT COUNT(*) FROM api_products WHERE (name LIKE ? OR description LIKE ?) {owner_clause}"),
            {
                let mut b = vec![like.clone(), like.clone()];
                if !admin { b.push(auth.subject.clone()); }
                b
            },
            {
                let mut b = vec![like.clone(), like];
                if !admin { b.push(auth.subject.clone()); }
                b.push(limit.to_string());
                b.push(offset.to_string());
                b
            },
        )
    };

    let total: i64 = if count_binds.is_empty() {
        sqlx::query_scalar(&count_query).fetch_one(&state.pool).await.unwrap_or(0)
    } else {
        let mut q = sqlx::query_scalar(&count_query);
        for v in &count_binds { q = q.bind(v); }
        q.fetch_one(&state.pool).await.unwrap_or(0)
    };

    let mut q = sqlx::query(&base_query);
    for v in &base_binds { q = q.bind(v); }
    let rows = q.fetch_all(&state.pool).await?;

    // Fetch subscription stats in one query
    let product_ids: Vec<String> = rows.iter()
        .map(|r: &sqlx::mysql::MySqlRow| r.try_get::<String, _>("id").unwrap_or_default())
        .filter(|id| !id.is_empty())
        .collect();

    let mut stats_map: std::collections::HashMap<String, ProductStats> = std::collections::HashMap::new();
    if !product_ids.is_empty() {
        let placeholders = product_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let stats_query = format!(
            "SELECT product_id, COUNT(*) as total, CAST(COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) AS SIGNED) as active FROM subscriptions WHERE product_id IN ({}) GROUP BY product_id",
            placeholders
        );
        let mut sq = sqlx::query(&stats_query);
        for id in &product_ids { sq = sq.bind(id); }
        let stat_rows = sq.fetch_all(&state.pool).await.unwrap_or_default();
        for r in &stat_rows {
            let pid: String = r.try_get("product_id").unwrap_or_default();
            let total: i64 = r.try_get("total").unwrap_or(0);
            let active: i64 = r.try_get("active").unwrap_or(0);
            stats_map.insert(pid, ProductStats { subscription_count: total, active_subscription_count: active });
        }
    }

    let items: Vec<Value> = rows.iter().map(|r| {
        let mut val = product_row_to_json(r);
        if let Some(obj) = val.as_object_mut() {
            let pid = obj.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let stats = stats_map.get(&pid).cloned().unwrap_or_default();
            obj.insert("subscription_count".into(), json!(stats.subscription_count));
            obj.insert("active_subscription_count".into(), json!(stats.active_subscription_count));
        }
        val
    }).collect();

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

    // Non-admin users can only access their own products
    if !user_has_permission(&auth, Permission::UserManage) {
        let owner: String = row.try_get("owner").unwrap_or_default();
        if owner != auth.subject {
            return Err(AppError::NotFound(format!("product {} not found", id)));
        }
    }

    let mut val = product_row_to_json(&row);
    if let Some(obj) = val.as_object_mut() {
        let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM subscriptions WHERE product_id = ?")
            .bind(&id).fetch_one(&state.pool).await.unwrap_or(0);
        let active: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM subscriptions WHERE product_id = ? AND status = 'active'")
            .bind(&id).fetch_one(&state.pool).await.unwrap_or(0);
        obj.insert("subscription_count".into(), json!(total));
        obj.insert("active_subscription_count".into(), json!(active));
    }

    Ok(Json(val))
}

pub async fn update_product(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(id): Path<String>,
    Json(payload): Json<Value>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ProductsWrite)?;

    // Non-admin users can only update their own products
    if !user_has_permission(&auth, Permission::UserManage) {
        let owner: String = sqlx::query_scalar("SELECT owner FROM api_products WHERE id = ?")
            .bind(&id).fetch_optional(&state.pool).await?
            .unwrap_or_default();
        if owner != auth.subject {
            return Err(AppError::NotFound(format!("product {} not found", id)));
        }
    }

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

    spawn_audit_log(&state.pool, AuditEntry { rule_id: Some(id.clone()), action: "product.update".into(), actor: auth.subject.clone(), success: true, message: Some("updated product".into()), detail: None });
    Ok(Json(json!({"updated": true})))
}

pub async fn delete_product(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ProductsWrite)?;

    // Non-admin users can only delete their own products
    if !user_has_permission(&auth, Permission::UserManage) {
        let owner: String = sqlx::query_scalar("SELECT owner FROM api_products WHERE id = ?")
            .bind(&id).fetch_optional(&state.pool).await?
            .unwrap_or_default();
        if owner != auth.subject {
            return Err(AppError::NotFound(format!("product {} not found", id)));
        }
    }

    sqlx::query("UPDATE subscriptions SET status = 'cancelled' WHERE product_id = ? AND status = 'active'")
        .bind(&id).execute(&state.pool).await?;
    sqlx::query("DELETE FROM api_products WHERE id = ?").bind(&id).execute(&state.pool).await?;
    spawn_audit_log(&state.pool, AuditEntry { rule_id: Some(id.clone()), action: "product.delete".into(), actor: auth.subject.clone(), success: true, message: Some("deleted product and cancelled subscriptions".into()), detail: None });
    Ok(Json(json!({"deleted": true})))
}

// ─── Product Subscriptions ─────────────────────────────────────────────────────

pub async fn list_product_subscriptions(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Path(product_id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::ProductsRead)?;
    let rows = if user_has_permission(&auth, Permission::UserManage) {
        sqlx::query(
            "SELECT s.id, s.api_key_id, s.product_id, s.plan, s.rate_limit_rps, s.quota_daily, s.status, s.expires_at, s.created_at, s.user_id FROM subscriptions s WHERE s.product_id = ? ORDER BY s.created_at DESC"
        )
        .bind(&product_id).fetch_all(&state.pool).await?
    } else {
        sqlx::query(
            "SELECT s.id, s.api_key_id, s.product_id, s.plan, s.rate_limit_rps, s.quota_daily, s.status, s.expires_at, s.created_at, s.user_id FROM subscriptions s WHERE s.product_id = ? AND s.user_id = ? ORDER BY s.created_at DESC"
        )
        .bind(&product_id).bind(&auth.subject).fetch_all(&state.pool).await?
    };
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

#[derive(Clone, Default)]
struct ProductStats {
    subscription_count: i64,
    active_subscription_count: i64,
}

fn extract_json_field(payload: &Value, key: &str) -> Option<String> {
    payload.get(key).and_then(|v| if v.is_null() || v.as_array().map_or(false, |a| a.is_empty()) { None } else { Some(v.to_string()) })
}

fn product_row_to_json(r: &sqlx::mysql::MySqlRow) -> Value {
    let rule_ids: Value = r.try_get::<Value, _>("rule_ids").unwrap_or(Value::Null);
    let tags: Value = r.try_get::<Value, _>("tags").unwrap_or(Value::Null);
    let pricing_tiers: Value = r.try_get::<Value, _>("pricing_tiers").unwrap_or(Value::Null);

    json!({
        "id": r.try_get::<String, _>("id").unwrap_or_default(),
        "name": r.try_get::<String, _>("name").unwrap_or_default(),
        "description": r.try_get::<String, _>("description").unwrap_or_default(),
        "rule_ids": rule_ids,
        "status": r.try_get::<String, _>("status").unwrap_or_default(),
        "tags": tags,
        "documentation_url": r.try_get::<String, _>("documentation_url").unwrap_or_default(),
        "pricing_tiers": pricing_tiers,
        "owner": r.try_get::<String, _>("owner").unwrap_or_default(),
        "created_at": fmt_dt_naive(r.try_get::<Option<chrono::NaiveDateTime>, _>("created_at").ok().flatten()),
        "updated_at": fmt_dt_naive(r.try_get::<Option<chrono::NaiveDateTime>, _>("updated_at").ok().flatten()),
    })
}

fn sub_row_to_json(r: &sqlx::mysql::MySqlRow) -> Value {
    json!({
        "id": r.try_get::<String, _>("id").unwrap_or_default(),
        "api_key_id": r.try_get::<String, _>("api_key_id").unwrap_or_default(),
        "product_id": r.try_get::<String, _>("product_id").unwrap_or_default(),
        "plan": r.try_get::<String, _>("plan").unwrap_or_default(),
        "rate_limit_rps": r.try_get::<Option<i32>, _>("rate_limit_rps").ok().flatten(),
        "quota_daily": r.try_get::<Option<i32>, _>("quota_daily").ok().flatten(),
        "status": r.try_get::<String, _>("status").unwrap_or_default(),
        "expires_at": r.try_get::<Option<String>, _>("expires_at").ok().flatten(),
        "user_id": r.try_get::<Option<String>, _>("user_id").ok().flatten(),
        "created_at": fmt_dt_naive(r.try_get::<Option<chrono::NaiveDateTime>, _>("created_at").ok().flatten()),
    })
}

fn try_append_str(set: &mut Vec<String>, binds: &mut Vec<String>, payload: &Value, json_key: &str, col: &str) {
    if let Some(v) = payload.get(json_key).and_then(|v| v.as_str()) {
        set.push(format!("{} = ?", col));
        binds.push(v.to_string());
    }
}
