use std::sync::Arc;
use std::time::Instant;
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

// ── LLM Providers ──

pub async fn create_llm_provider(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<CreateLlmProviderRequest>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::LlmManage)?;
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

pub async fn get_llm_provider(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    let row = sqlx::query("SELECT id, name, provider_type, endpoint_url, api_key_env, model_name, cost_per_1k_input, cost_per_1k_output, max_tokens, priority, status FROM llm_providers WHERE id = ?")
        .bind(&id).fetch_optional(&state.pool).await?;
    match row {
        Some(r) => Ok(Json(json!({
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
        }))),
        None => Err(AppError::NotFound("Provider not found".to_string())),
    }
}

pub async fn update_llm_provider(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>, Json(payload): Json<Value>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::LlmManage)?;
    let mut updates: Vec<String> = Vec::new();
    let mut params: Vec<String> = Vec::new();
    if let Some(v) = payload.get("name").and_then(|v| v.as_str()) { updates.push("name = ?".to_string()); params.push(v.to_string()); }
    if let Some(v) = payload.get("provider_type").and_then(|v| v.as_str()) { updates.push("provider_type = ?".to_string()); params.push(v.to_string()); }
    if let Some(v) = payload.get("endpoint_url").and_then(|v| v.as_str()) { updates.push("endpoint_url = ?".to_string()); params.push(v.to_string()); }
    if let Some(v) = payload.get("api_key_env").and_then(|v| v.as_str()) { updates.push("api_key_env = ?".to_string()); params.push(v.to_string()); }
    if let Some(v) = payload.get("model_name").and_then(|v| v.as_str()) { updates.push("model_name = ?".to_string()); params.push(v.to_string()); }
    if let Some(v) = payload.get("cost_per_1k_input").and_then(|v| v.as_f64()) { updates.push("cost_per_1k_input = ?".to_string()); params.push(v.to_string()); }
    if let Some(v) = payload.get("cost_per_1k_output").and_then(|v| v.as_f64()) { updates.push("cost_per_1k_output = ?".to_string()); params.push(v.to_string()); }
    if let Some(v) = payload.get("max_tokens").and_then(|v| v.as_i64()) { updates.push("max_tokens = ?".to_string()); params.push(v.to_string()); }
    if let Some(v) = payload.get("priority").and_then(|v| v.as_i64()) { updates.push("priority = ?".to_string()); params.push(v.to_string()); }
    if let Some(v) = payload.get("status").and_then(|v| v.as_str()) { updates.push("status = ?".to_string()); params.push(v.to_string()); }
    if updates.is_empty() {
        return Err(AppError::BadRequest("No fields to update".to_string()));
    }
    let mut sql = String::from("UPDATE llm_providers SET ");
    sql.push_str(&updates.join(", "));
    sql.push_str(" WHERE id = ?");
    let mut q = sqlx::query(&sql);
    for p in &params { q = q.bind(p); }
    q = q.bind(&id);
    q.execute(&state.pool).await?;
    Ok(Json(json!({"id": id, "updated": true})))
}

pub async fn delete_llm_provider(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::LlmManage)?;
    sqlx::query("DELETE FROM llm_providers WHERE id = ?").bind(&id).execute(&state.pool).await?;
    Ok(Json(json!({"deleted": true})))
}

// ── Prompt Templates ──

pub async fn create_prompt_template(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<CreatePromptTemplateRequest>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::LlmManage)?;
    let id = Uuid::new_v4().to_string();
    let variables = payload.variables.as_ref().map(|v| serde_json::to_value(v).unwrap_or_default());
    sqlx::query("INSERT INTO prompt_templates (id, name, template_text, variables) VALUES (?, ?, ?, ?)")
        .bind(&id).bind(&payload.name).bind(&payload.template_text).bind(variables).execute(&state.pool).await?;
    Ok((StatusCode::CREATED, Json(json!({"id": id, "created": true}))))
}

pub async fn list_prompt_templates(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    let rows = sqlx::query("SELECT id, name, template_text, variables, version, status, created_at FROM prompt_templates ORDER BY created_at DESC").fetch_all(&state.pool).await?;
    let items: Vec<Value> = rows.iter().map(|r| json!({
        "id": r.try_get::<String,_>("id").unwrap_or_default(),
        "name": r.try_get::<String,_>("name").unwrap_or_default(),
        "template_text": r.try_get::<String,_>("template_text").unwrap_or_default(),
        "variables": r.try_get::<Value,_>("variables").unwrap_or(Value::Null),
        "version": r.try_get::<i32,_>("version").unwrap_or(1),
        "status": r.try_get::<String,_>("status").unwrap_or_default(),
        "created_at": r.try_get::<String,_>("created_at").unwrap_or_default(),
    })).collect();
    Ok(Json(json!({"items": items})))
}

pub async fn get_prompt_template(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;
    let row = sqlx::query("SELECT id, name, template_text, variables, version, status, created_at FROM prompt_templates WHERE id = ?")
        .bind(&id).fetch_optional(&state.pool).await?;
    match row {
        Some(r) => Ok(Json(json!({
            "id": r.try_get::<String,_>("id").unwrap_or_default(),
            "name": r.try_get::<String,_>("name").unwrap_or_default(),
            "template_text": r.try_get::<String,_>("template_text").unwrap_or_default(),
            "variables": r.try_get::<Value,_>("variables").unwrap_or(Value::Null),
            "version": r.try_get::<i32,_>("version").unwrap_or(1),
            "status": r.try_get::<String,_>("status").unwrap_or_default(),
            "created_at": r.try_get::<String,_>("created_at").unwrap_or_default(),
        }))),
        None => Err(AppError::NotFound("Template not found".to_string())),
    }
}

pub async fn update_prompt_template(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>, Json(payload): Json<Value>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::LlmManage)?;
    let mut updates: Vec<String> = Vec::new();
    let mut params: Vec<String> = Vec::new();
    if let Some(v) = payload.get("name").and_then(|v| v.as_str()) { updates.push("name = ?".to_string()); params.push(v.to_string()); }
    if let Some(v) = payload.get("template_text").and_then(|v| v.as_str()) { updates.push("template_text = ?".to_string()); params.push(v.to_string()); }
    if let Some(v) = payload.get("variables") { updates.push("variables = ?".to_string()); params.push(v.to_string()); }
    if let Some(v) = payload.get("status").and_then(|v| v.as_str()) { updates.push("status = ?".to_string()); params.push(v.to_string()); }
    updates.push("version = version + 1".to_string());
    if updates.len() == 1 { return Err(AppError::BadRequest("No fields to update".to_string())); }
    let mut sql = String::from("UPDATE prompt_templates SET ");
    sql.push_str(&updates.join(", "));
    sql.push_str(" WHERE id = ?");
    let mut q = sqlx::query(&sql);
    for p in &params { q = q.bind(p); }
    q = q.bind(&id);
    q.execute(&state.pool).await?;
    Ok(Json(json!({"id": id, "updated": true})))
}

pub async fn delete_prompt_template(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::LlmManage)?;
    sqlx::query("DELETE FROM prompt_templates WHERE id = ?").bind(&id).execute(&state.pool).await?;
    Ok(Json(json!({"deleted": true})))
}

// ── LLM Route (actual API call) ──

async fn call_llm_provider(provider: &Value, prompt: &str, max_tokens: i32, temperature: f64, api_key: Option<&str>) -> Result<(String, i32, i32, i32), String> {
    let endpoint = provider.get("endpoint_url").and_then(|v| v.as_str()).unwrap_or("");
    let model = provider.get("model_name").and_then(|v| v.as_str()).unwrap_or("default");
    let _provider_type = provider.get("provider_type").and_then(|v| v.as_str()).unwrap_or("openai");

    let chat_url = format!("{}/v1/chat/completions", endpoint.trim_end_matches('/'));
    let body = json!({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
        "temperature": temperature,
    });

    let mut req = reqwest::Client::new()
        .post(&chat_url)
        .json(&body)
        .header("Content-Type", "application/json");

    if let Some(key) = api_key {
        req = req.header("Authorization", format!("Bearer {}", key));
    }

    let start = Instant::now();
    let resp = req.send().await.map_err(|e| format!("HTTP error: {}", e))?;
    let latency_ms = start.elapsed().as_millis() as i32;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let body_text = resp.text().await.unwrap_or_default();
        return Err(format!("Provider {} returned {}: {}", model, status, body_text));
    }

    let resp_body: Value = resp.json().await.map_err(|e| format!("Parse error: {}", e))?;
    let choices = resp_body.get("choices").and_then(|v| v.as_array());
    let content = choices
        .and_then(|arr| arr.first())
        .and_then(|c| c.get("message"))
        .and_then(|m| m.get("content"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let usage = resp_body.get("usage");
    let input_tokens = usage.and_then(|u| u.get("prompt_tokens")).and_then(|v| v.as_i64()).unwrap_or(0) as i32;
    let output_tokens = usage.and_then(|u| u.get("completion_tokens")).and_then(|v| v.as_i64()).unwrap_or(0) as i32;

    Ok((content, input_tokens, output_tokens, latency_ms))
}

fn substitute_template(template_text: &str, prompt: &str, variables: &Value) -> String {
    let mut result = template_text.replace("{{prompt}}", prompt);
    result = result.replace("{{PROMPT}}", prompt);
    if let Some(obj) = variables.as_object() {
        for (k, v) in obj {
            let placeholder = format!("{{{{{}}}}}", k);
            if let Some(val) = v.as_str() {
                result = result.replace(&placeholder, val);
            }
        }
    }
    result
}

pub async fn llm_route(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<LlmRouteRequest>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::RuleRead)?;

    let mut prompt = payload.prompt.clone();
    let mut template_id: Option<String> = None;

    // If template specified, load and substitute
    if let Some(ref tid) = payload.prompt_template_id {
        template_id = Some(tid.clone());
        let trow = sqlx::query("SELECT template_text, variables FROM prompt_templates WHERE id = ?")
            .bind(tid).fetch_optional(&state.pool).await?;
        if let Some(r) = trow {
            let text: String = r.try_get("template_text").unwrap_or_default();
            let vars: Value = r.try_get("variables").unwrap_or(Value::Null);
            prompt = substitute_template(&text, &payload.prompt, &vars);
        }
    }

    // Load providers sorted by priority
    let rows = sqlx::query("SELECT id, name, provider_type, endpoint_url, api_key_env, model_name, cost_per_1k_input, cost_per_1k_output, max_tokens, priority, status FROM llm_providers WHERE status = 'active' ORDER BY priority ASC")
        .fetch_all(&state.pool).await?;

    let providers: Vec<Value> = rows.iter().map(|r| json!({
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
    })).collect();

    if providers.is_empty() {
        return Err(AppError::NotFound("No active LLM providers configured. Add a provider first.".to_string()));
    }

    let max_tokens = payload.max_tokens.unwrap_or(1024);
    let temperature = payload.temperature.unwrap_or(0.7);

    // Try each provider in priority order
    let mut last_err = String::new();
    for provider in &providers {
        let api_key: Option<String> = provider.get("api_key_env")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .and_then(|env_name| std::env::var(env_name).ok());

        match call_llm_provider(provider, &prompt, max_tokens, temperature, api_key.as_deref()).await {
            Ok((response, input_tokens, output_tokens, latency_ms)) => {
                // Calculate cost
                let cost_input = provider.get("cost_per_1k_input").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let cost_output = provider.get("cost_per_1k_output").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let cost = (input_tokens as f64 / 1000.0 * cost_input) + (output_tokens as f64 / 1000.0 * cost_output);

                // Log usage
                let pid = provider.get("id").and_then(|v| v.as_str()).unwrap_or("");
                let _ = sqlx::query("INSERT INTO llm_usage_logs (provider_id, prompt_template_id, input_tokens, output_tokens, latency_ms, cost, api_key_id, success) VALUES (?, ?, ?, ?, ?, ?, ?, 1)")
                    .bind(pid).bind(&template_id).bind(input_tokens).bind(output_tokens).bind(latency_ms).bind(cost).bind(&payload.api_key_id)
                    .execute(&state.pool).await;

                return Ok(Json(LlmRouteResponse {
                    provider: provider.get("name").and_then(|v| v.as_str()).unwrap_or("unknown").to_string(),
                    model: provider.get("model_name").and_then(|v| v.as_str()).unwrap_or("unknown").to_string(),
                    response,
                    input_tokens,
                    output_tokens,
                    cost,
                    latency_ms,
                }));
            }
            Err(e) => {
                last_err = e;
                continue;
            }
        }
    }

    Err(AppError::Internal(format!("All providers failed. Last error: {}", last_err)))
}
