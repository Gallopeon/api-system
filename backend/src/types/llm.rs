use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct LlmRouteRequest {
    pub prompt: String,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub max_tokens: Option<i32>,
    #[serde(default)]
    pub temperature: Option<f64>,
    #[serde(default)]
    pub prompt_template_id: Option<String>,
    #[serde(default)]
    pub api_key_id: Option<String>,
    #[serde(default)]
    pub actor: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct LlmRouteResponse {
    pub provider: String,
    pub model: String,
    pub response: String,
    pub input_tokens: i32,
    pub output_tokens: i32,
    pub cost: f64,
    pub latency_ms: i32,
}

#[derive(Debug, Deserialize)]
pub struct CreatePromptTemplateRequest {
    pub name: String,
    pub template_text: String,
    #[serde(default)]
    pub variables: Option<Vec<String>>,
    #[serde(default)]
    pub actor: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PromptTemplateResponse {
    pub id: String,
    pub name: String,
    pub template_text: String,
    pub variables: Option<Vec<String>>,
    pub version: i32,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateLlmProviderRequest {
    pub name: String,
    pub provider_type: String,
    pub endpoint_url: String,
    pub model_name: String,
    #[serde(default)]
    pub api_key_env: Option<String>,
    #[serde(default)]
    pub cost_per_1k_input: f64,
    #[serde(default)]
    pub cost_per_1k_output: f64,
    #[serde(default = "default_max_tokens_llm")]
    pub max_tokens: i32,
    #[serde(default = "default_priority")]
    pub priority: i32,
    #[serde(default)]
    pub actor: Option<String>,
}

pub fn default_max_tokens_llm() -> i32 { 4096 }
pub fn default_priority() -> i32 { 10 }

#[derive(Debug, Serialize)]
pub struct LlmProviderResponse {
    pub id: String,
    pub name: String,
    pub provider_type: String,
    pub endpoint_url: String,
    pub model_name: String,
    pub cost_per_1k_input: f64,
    pub cost_per_1k_output: f64,
    pub max_tokens: i32,
    pub status: String,
    pub priority: i32,
}
