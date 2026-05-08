use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TransformRule {
    #[serde(default)]
    pub whitelist_fields: Vec<String>,
    #[serde(default)]
    pub renames: HashMap<String, String>,
    #[serde(default)]
    pub masked_fields: Vec<String>,
    #[serde(default)]
    pub computed_literals: HashMap<String, Value>,
    #[serde(default)]
    pub remove_nulls: bool,
    #[serde(default)]
    pub conditional_rules: Vec<ConditionalRule>,
    #[serde(default)]
    pub gray_release: Option<GrayReleaseConfig>,
    pub pagination: Option<PaginationTemplate>,
    #[serde(default)]
    pub request_validation: Option<ValidationSchema>,
    #[serde(default)]
    pub response_validation: Option<ValidationSchema>,
    #[serde(default)]
    pub cache_config: Option<CacheConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_cache_ttl")]
    pub ttl_seconds: i32,
    #[serde(default)]
    pub max_size_mb: i32,
    #[serde(default)]
    pub cache_by_headers: Vec<String>,
    #[serde(default)]
    pub cache_by_query: Vec<String>,
    #[serde(default)]
    pub conditional_cache: Option<String>,
}

pub fn default_cache_ttl() -> i32 { 60 }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationSchema {
    #[serde(default)]
    pub enabled: bool,
    pub schema: Value,
    #[serde(default)]
    pub strict: bool,
    #[serde(default)]
    pub custom_error_message: Option<String>,
    #[serde(default)]
    pub required_fields: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GrayReleaseConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_bucket_field")]
    pub bucket_field: String,
    #[serde(default)]
    pub variants: Vec<GrayVariant>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GrayVariant {
    pub name: String,
    pub weight: u8,
    #[serde(default)]
    pub overrides: GrayVariantOverrides,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GrayVariantOverrides {
    #[serde(default)]
    pub whitelist_fields: Option<Vec<String>>,
    #[serde(default)]
    pub renames: Option<HashMap<String, String>>,
    #[serde(default)]
    pub masked_fields: Option<Vec<String>>,
    #[serde(default)]
    pub computed_literals: Option<HashMap<String, Value>>,
    #[serde(default)]
    pub remove_nulls: Option<bool>,
    #[serde(default)]
    pub conditional_rules: Option<Vec<ConditionalRule>>,
    #[serde(default)]
    pub pagination: Option<PaginationTemplate>,
    #[serde(default)]
    pub request_validation: Option<ValidationSchema>,
    #[serde(default)]
    pub response_validation: Option<ValidationSchema>,
    #[serde(default)]
    pub cache_config: Option<CacheConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConditionalRule {
    pub when: String,
    #[serde(default)]
    pub add_literals: HashMap<String, Value>,
    #[serde(default)]
    pub remove_fields: Vec<String>,
    #[serde(default)]
    pub mask_fields: Vec<String>,
    #[serde(default)]
    pub rename_fields: HashMap<String, String>,
    #[serde(default)]
    pub stop_after_match: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginationTemplate {
    #[serde(default = "default_data_key")]
    pub data_key: String,
    #[serde(default = "default_total_key")]
    pub total_field: String,
    #[serde(default = "default_page_key")]
    pub page_field: String,
    #[serde(default = "default_page_size_key")]
    pub page_size_field: String,
}

pub fn default_bucket_field() -> String { "user_id".to_string() }
pub fn default_data_key() -> String { "data".to_string() }
pub fn default_total_key() -> String { "total".to_string() }
pub fn default_page_key() -> String { "page".to_string() }
pub fn default_page_size_key() -> String { "page_size".to_string() }

#[derive(Debug, Deserialize)]
pub struct CreateRuleRequest {
    pub name: String,
    pub api_path: String,
    #[serde(default)]
    pub status: Option<String>,
    pub config: TransformRule,
    #[serde(default)]
    pub note: Option<String>,
    #[serde(default)]
    pub actor: Option<String>,
    #[serde(default)]
    pub change_kind: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateRuleRequest {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub api_path: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    pub config: TransformRule,
    #[serde(default)]
    pub note: Option<String>,
    #[serde(default)]
    pub actor: Option<String>,
    #[serde(default)]
    pub change_kind: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RollbackRequest {
    pub version: i32,
    #[serde(default)]
    pub note: Option<String>,
    #[serde(default)]
    pub actor: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PreviewRequest {
    pub input: Value,
    #[serde(default)]
    pub rule_id: Option<String>,
    #[serde(default)]
    pub inline_rule: Option<TransformRule>,
    #[serde(default)]
    pub traffic_context: Option<Value>,
    #[serde(default)]
    pub force_variant: Option<String>,
    #[serde(default)]
    pub actor: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ExecuteTransformRequest {
    pub rule_id: String,
    pub api_path: String,
    pub input: Value,
    #[serde(default)]
    pub traffic_context: Option<Value>,
    #[serde(default)]
    pub force_variant: Option<String>,
    #[serde(default)]
    pub actor: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListRulesQuery {
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub offset: Option<u32>,
    #[serde(default)]
    pub cursor: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub api_path: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RuleDiffQuery {
    pub from: i32,
    pub to: i32,
}

#[derive(Debug, Deserialize)]
pub struct ExprEvalRequest {
    pub expression: String,
    pub input: Value,
    #[serde(default)]
    pub actor: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct OpenApiQuery {
    #[serde(default)]
    pub api_path: Option<String>,
    #[serde(default)]
    pub overlay: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AuditListQuery {
    #[serde(default)]
    pub rule_id: Option<String>,
    #[serde(default)]
    pub action: Option<String>,
    #[serde(default)]
    pub actor: Option<String>,
    #[serde(default)]
    pub success: Option<bool>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub offset: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleSummary {
    pub id: String,
    pub name: String,
    pub api_path: String,
    pub current_version: i32,
    pub status: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RuleDetail {
    pub id: String,
    pub name: String,
    pub api_path: String,
    pub current_version: i32,
    pub status: String,
    pub config: TransformRule,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RuleVersionDetail {
    pub version: i32,
    pub note: Option<String>,
    pub change_kind: String,
    pub created_at: String,
    pub config: TransformRule,
}

#[derive(Debug, Serialize)]
pub struct AuditLogItem {
    pub id: i64,
    pub rule_id: Option<String>,
    pub action: String,
    pub actor: String,
    pub success: bool,
    pub message: Option<String>,
    pub detail: Option<Value>,
    pub created_at: String,
}

#[derive(Debug, Clone)]
pub struct AuditEntry {
    pub rule_id: Option<String>,
    pub action: String,
    pub actor: String,
    pub success: bool,
    pub message: Option<String>,
    pub detail: Option<Value>,
}

#[derive(Debug, Serialize)]
pub struct DiffEntry {
    pub path: String,
    pub change_type: String,
    pub from: Value,
    pub to: Value,
}

#[derive(Debug, Serialize)]
pub struct RuleListResponse {
    pub items: Vec<RuleSummary>,
    pub limit: u32,
    pub offset: u32,
    pub total: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RuleVersionsResponse {
    pub rule_id: String,
    pub items: Vec<RuleVersionDetail>,
}

#[derive(Debug, Serialize)]
pub struct RuleDiffResponse {
    pub rule_id: String,
    pub from: i32,
    pub to: i32,
    pub changes_count: usize,
    pub changes: Vec<DiffEntry>,
}

#[derive(Debug, Serialize)]
pub struct ExprEvalResponse {
    pub expression: String,
    pub matched: bool,
}

#[derive(Debug, Serialize)]
pub struct ExecuteResponse {
    pub rule_id: String,
    pub selected_variant: Option<String>,
    pub output: Value,
}

#[derive(Debug, Serialize)]
pub struct PreviewResponse {
    pub output: Value,
    pub selected_variant: Option<String>,
}
