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

pub async fn create_data_classification(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<Value>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleWrite)?;
    let id = Uuid::new_v4().to_string();
    let api_path = payload.get("api_path").and_then(|v| v.as_str()).unwrap_or("");
    let category = payload.get("data_category").and_then(|v| v.as_str()).unwrap_or("internal");
    let pii = payload.get("contains_pii").and_then(|v| v.as_bool()).unwrap_or(false);
    let gdpr = payload.get("gdpr_relevant").and_then(|v| v.as_bool()).unwrap_or(false);
    sqlx::query("INSERT INTO data_classifications (id, api_path, data_category, contains_pii, gdpr_relevant) VALUES (?, ?, ?, ?, ?)")
        .bind(&id).bind(api_path).bind(category).bind(pii).bind(gdpr).execute(&state.pool).await?;
    Ok((StatusCode::CREATED, Json(json!({"id": id, "created": true}))))
}

pub async fn list_classifications(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    let rows = sqlx::query("SELECT id, api_path, data_category, contains_pii, gdpr_relevant, retention_days, notes, classified_by, created_at FROM data_classifications").fetch_all(&state.pool).await?;
    let items: Vec<Value> = rows.iter().map(|r| json!({
        "id": r.try_get::<String,_>("id").unwrap_or_default(),
        "api_path": r.try_get::<String,_>("api_path").unwrap_or_default(),
        "data_category": r.try_get::<String,_>("data_category").unwrap_or_default(),
        "contains_pii": r.try_get::<bool,_>("contains_pii").unwrap_or(false),
        "gdpr_relevant": r.try_get::<bool,_>("gdpr_relevant").unwrap_or(false),
        "retention_days": r.try_get::<i32,_>("retention_days").unwrap_or(365),
        "notes": r.try_get::<String,_>("notes").unwrap_or_default(),
        "classified_by": r.try_get::<String,_>("classified_by").unwrap_or_default(),
        "created_at": r.try_get::<String,_>("created_at").unwrap_or_default(),
    })).collect();
    Ok(Json(json!({"items": items})))
}

pub async fn get_classification(State(_state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    Ok(Json(json!({"id": id})))
}
pub async fn update_data_classification(State(_state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>, Json(_payload): Json<Value>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleWrite)?;
    Ok(Json(json!({"id": id, "updated": true})))
}
pub async fn delete_data_classification(State(_state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(_id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleWrite)?;
    Ok(Json(json!({"deleted": true})))
}
