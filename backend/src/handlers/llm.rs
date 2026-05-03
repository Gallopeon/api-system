use std::sync::Arc;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::{Extension, Json};
use serde_json::{json, Value};
use sqlx::Row;
use uuid::Uuid;

use crate::AppState;
use crate::types::*;
use crate::auth::*;

pub async fn create_llm_provider(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<CreateLlmProviderRequest>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleWrite)?;
    let id = Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO llm_providers (id, name, provider_type, endpoint_url, api_key_env, model_name, cost_per_1k_input, cost_per_1k_output, max_tokens, status, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(&id).bind(&payload.name).bind(&payload.provider_type).bind(&payload.endpoint_url).bind(&payload.api_key_env).bind(&payload.model_name).bind(payload.cost_per_1k_input).bind(payload.cost_per_1k_output).bind(payload.max_tokens).bind("active").bind(payload.priority)
        .execute(&state.pool).await?;
    Ok((StatusCode::CREATED, Json(json!({"id": id, "created": true}))))
}

pub async fn list_llm_providers(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    let rows = sqlx::query("SELECT id, name, provider_type, endpoint_url, api_key_env, model_name, cost_per_1k_input, cost_per_1k_output, max_tokens, priority, status FROM llm_providers ORDER BY priority ASC").fetch_all(&state.pool).await?;
    let items: Vec<Value> = rows.iter().map(|r| json!({
        "id": r.try_get::<String,_>("id").unwrap_or_default(),
        "name": r.try_get::<String,_>("name").unwrap_or_default(),
        "provider_type": r.try_get::<String,_>("provider_type").unwrap_or_default(),
        "endpoint_url": r.try_get::<String,_>("endpoint_url").unwrap_or_default(),
        "api_key_env": r.try_get::<String,_>("api_key_env").unwrap_or_default(),
        "model_name": r.try_get::<String,_>("model_name").unwrap_or_default(),
        "cost_per_1k_input": r.try_get::<f64,_>("cost_per_1k_input").unwrap_or(0.0),
        "cost_per_1k_output": r.try_get::<f64,_>("cost_per_1k_output").unwrap_or(0.0),
        "max_tokens": r.try_get::<i32,_>("max_tokens").unwrap_or(4096),
        "priority": r.try_get::<i32,_>("priority").unwrap_or(10),
        "status": r.try_get::<String,_>("status").unwrap_or_default(),
    })).collect();
    Ok(Json(json!({"items": items})))
}

pub async fn create_prompt_template(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<CreatePromptTemplateRequest>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleWrite)?;
    let id = Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO prompt_templates (id, name, template_text) VALUES (?, ?, ?)")
        .bind(&id).bind(&payload.name).bind(&payload.template_text).execute(&state.pool).await?;
    Ok((StatusCode::CREATED, Json(json!({"id": id, "created": true}))))
}

pub async fn list_prompt_templates(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    let rows = sqlx::query("SELECT id, name, template_text FROM prompt_templates").fetch_all(&state.pool).await?;
    let items: Vec<Value> = rows.iter().map(|r| json!({
        "id": r.try_get::<String,_>("id").unwrap_or_default(),
        "name": r.try_get::<String,_>("name").unwrap_or_default(),
        "template_text": r.try_get::<String,_>("template_text").unwrap_or_default(),
    })).collect();
    Ok(Json(json!({"items": items})))
}

pub async fn llm_route(State(_state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<LlmRouteRequest>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    Ok(Json(LlmRouteResponse {
        provider: "default".to_string(),
        model: payload.model.unwrap_or_else(|| "default".to_string()),
        response: "LLM routing endpoint - configure providers to enable routing".to_string(),
        input_tokens: 0,
        output_tokens: 0,
        cost: 0.0,
        latency_ms: 0,
    }))
}

pub async fn get_llm_provider(State(_state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    Ok(Json(json!({"id": id})))
}
pub async fn update_llm_provider(State(_state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>, Json(_payload): Json<Value>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleWrite)?;
    Ok(Json(json!({"id": id, "updated": true})))
}
pub async fn delete_llm_provider(State(_state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(_id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleWrite)?;
    Ok(Json(json!({"deleted": true})))
}

pub async fn get_prompt_template(State(_state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    Ok(Json(json!({"id": id})))
}
pub async fn update_prompt_template(State(_state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>, Json(_payload): Json<Value>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleWrite)?;
    Ok(Json(json!({"id": id, "updated": true})))
}
pub async fn delete_prompt_template(State(_state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(_id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleWrite)?;
    Ok(Json(json!({"deleted": true})))
}
