use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Deserialize)]
pub struct ValidateRequest {
    pub api_path: String,
    pub body: Value,
}

#[derive(Debug, Deserialize)]
pub struct ValidateResponseRequest {
    pub api_path: String,
    pub body: Value,
}

#[derive(Debug, Serialize)]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
    pub schema_errors: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct ValidationErrorDetail {
    pub path: String,
    pub message: String,
    pub keyword: Option<String>,
}
