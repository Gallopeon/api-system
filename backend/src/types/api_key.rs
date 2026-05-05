use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct CreateApiKeyRequest {
    pub name: String,
    #[serde(default)]
    pub scopes: Option<Vec<String>>,
    #[serde(default)]
    pub expires_at: Option<String>,
    #[serde(default)]
    pub max_calls: Option<i32>,
    #[serde(default)]
    pub tenant_id: Option<String>,
    #[serde(default)]
    pub actor: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateApiKeyRequest {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub scopes: Option<Vec<String>>,
    #[serde(default)]
    pub expires_at: Option<String>,
    #[serde(default)]
    pub max_calls: Option<i32>,
    #[serde(default)]
    pub actor: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ValidateApiKeyRequest {
    pub api_key: String,
    #[serde(default)]
    pub api_path: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListApiKeysQuery {
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub offset: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct ApiKeyResponse {
    pub id: String,
    pub key: Option<String>,
    pub key_prefix: String,
    pub name: String,
    pub status: String,
    pub scopes: Option<Vec<String>>,
    pub expires_at: Option<String>,
    pub max_calls: Option<i32>,
    pub call_count: i32,
    pub tenant_id: Option<String>,
    pub created_by: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
pub struct ApiKeyListResponse {
    pub items: Vec<ApiKeyResponse>,
    pub limit: u32,
    pub offset: u32,
}

#[derive(Debug, Serialize)]
pub struct ApiKeyValidateResponse {
    pub valid: bool,
    pub reason: Option<String>,
    pub scopes: Option<Vec<String>>,
}
