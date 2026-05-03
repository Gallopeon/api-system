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

// API Key types
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

// Validation types
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

// Rate Limit types
#[derive(Debug, Deserialize)]
pub struct CreateRateLimitRequest {
    pub name: String,
    pub api_path: String,
    #[serde(default = "default_window")]
    pub window_seconds: i32,
    #[serde(default = "default_max_req")]
    pub max_requests: i32,
    #[serde(default = "default_burst")]
    pub burst_size: i32,
    #[serde(default)]
    pub quota_daily: Option<i32>,
    #[serde(default)]
    pub quota_monthly: Option<i32>,
    #[serde(default)]
    pub per_api_key: bool,
    #[serde(default = "default_true")]
    pub per_ip: bool,
    #[serde(default)]
    pub actor: Option<String>,
}

pub fn default_window() -> i32 { 60 }
pub fn default_max_req() -> i32 { 100 }
pub fn default_burst() -> i32 { 50 }
pub fn default_true() -> bool { true }

#[derive(Debug, Deserialize)]
pub struct UpdateRateLimitRequest {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub window_seconds: Option<i32>,
    #[serde(default)]
    pub max_requests: Option<i32>,
    #[serde(default)]
    pub burst_size: Option<i32>,
    #[serde(default)]
    pub quota_daily: Option<i32>,
    #[serde(default)]
    pub quota_monthly: Option<i32>,
    #[serde(default)]
    pub per_api_key: Option<bool>,
    #[serde(default)]
    pub per_ip: Option<bool>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub actor: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RateLimitResponse {
    pub id: String,
    pub name: String,
    pub api_path: String,
    pub window_seconds: i32,
    pub max_requests: i32,
    pub burst_size: i32,
    pub quota_daily: Option<i32>,
    pub quota_monthly: Option<i32>,
    pub per_api_key: bool,
    pub per_ip: bool,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct RateLimitCheckRequest {
    pub api_path: String,
    #[serde(default)]
    pub api_key: Option<String>,
    #[serde(default)]
    pub client_ip: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RateLimitCheckResponse {
    pub allowed: bool,
    pub limit: i32,
    pub remaining: i32,
    pub reset_seconds: i64,
    pub quota_daily_remaining: Option<i32>,
    pub quota_monthly_remaining: Option<i32>,
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListRateLimitsQuery {
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub offset: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
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

#[derive(Debug)]
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
pub struct RateLimitListResponse {
    pub items: Vec<RateLimitResponse>,
    pub limit: u32,
    pub offset: u32,
}

#[derive(Debug, Serialize)]
pub struct TopApisResponse {
    pub items: Vec<TopApiItem>,
    pub hours: u32,
}

#[derive(Debug, Serialize)]
pub struct MetricsOverview {
    pub uptime_seconds: u64,
    pub total_rules: i64,
    pub total_versions: i64,
    pub total_audit_events: i64,
    pub audit_events_24h: i64,
    pub preview_success_24h: i64,
    pub top_actions_24h: Vec<Value>,
}

#[derive(Debug, Serialize)]
pub struct ApprovalListResponse {
    pub items: Vec<ApprovalResponse>,
    pub limit: u32,
    pub offset: u32,
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

// Metrics/Analytics types
#[derive(Debug, Deserialize)]
pub struct IngestMetricsRequest {
    pub api_path: String,
    #[serde(default = "default_method")]
    pub method: String,
    #[serde(default)]
    pub status_code: i32,
    #[serde(default)]
    pub latency_ms: i32,
    #[serde(default)]
    pub api_key_id: Option<String>,
    #[serde(default)]
    pub client_ip: Option<String>,
}

pub fn default_method() -> String { "GET".to_string() }

#[derive(Debug, Deserialize)]
pub struct AnalyticsQuery {
    #[serde(default)]
    pub hours: Option<u32>,
    #[serde(default)]
    pub api_path: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AnalyticsResponse {
    pub total_requests: i64,
    pub avg_latency_ms: f64,
    pub p95_latency_ms: i64,
    pub p99_latency_ms: i64,
    pub error_rate: f64,
    pub requests_by_hour: Vec<HourlyBucket>,
    pub top_apis: Vec<TopApiItem>,
    pub status_distribution: Vec<StatusBucket>,
}

#[derive(Debug, Serialize)]
pub struct HourlyBucket {
    pub hour: String,
    pub count: i64,
    pub avg_latency: f64,
}

#[derive(Debug, Serialize)]
pub struct TopApiItem {
    pub api_path: String,
    pub count: i64,
    pub avg_latency: f64,
}

#[derive(Debug, Serialize)]
pub struct StatusBucket {
    pub status_code: i32,
    pub count: i64,
}

#[derive(Debug, Serialize)]
pub struct ApiKeyStatsItem {
    pub key_id: String,
    pub key_name: String,
    pub total_calls: i64,
    pub avg_latency: f64,
    pub error_count: i64,
}

#[derive(Debug, Serialize)]
pub struct ApiKeyStatsResponse {
    pub items: Vec<ApiKeyStatsItem>,
    pub hours: u32,
}

// Approval types
#[derive(Debug, Deserialize)]
pub struct CreateApprovalRequest {
    pub rule_id: String,
    pub version: i32,
    #[serde(default)]
    pub comment: Option<String>,
    #[serde(default)]
    pub actor: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReviewApprovalRequest {
    pub action: String,
    #[serde(default)]
    pub comment: Option<String>,
    #[serde(default)]
    pub actor: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ApprovalResponse {
    pub id: String,
    pub rule_id: String,
    pub version: i32,
    pub requestor: String,
    pub reviewer: Option<String>,
    pub status: String,
    pub comment: Option<String>,
    pub created_at: String,
    pub reviewed_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListApprovalsQuery {
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub offset: Option<u32>,
}

// LLM Gateway types
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

// ---- User / Auth types ----

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
    #[serde(default)]
    pub totp_code: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub user: UserResponse,
}

#[derive(Debug, Deserialize)]
pub struct CreateUserRequest {
    pub username: String,
    pub password: String,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub display_name: Option<String>,
    #[serde(default)]
    pub role: Option<String>,
    #[serde(default)]
    pub actor: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateUserRequest {
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub display_name: Option<String>,
    #[serde(default)]
    pub avatar_url: Option<String>,
    #[serde(default)]
    pub role: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub actor: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ChangePasswordRequest {
    pub current_password: String,
    pub new_password: String,
}

#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub id: String,
    pub username: String,
    pub email: Option<String>,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub role: String,
    pub status: String,
    pub last_login_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
pub struct UserListResponse {
    pub items: Vec<UserResponse>,
    pub limit: u32,
    pub offset: u32,
}

#[derive(Debug, Deserialize)]
pub struct ListUsersQuery {
    #[serde(default)]
    pub role: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub search: Option<String>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub offset: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct SessionResponse {
    pub id: String,
    pub client_ip: Option<String>,
    pub user_agent: Option<String>,
    pub expires_at: String,
    pub created_at: String,
    pub current: bool,
}

#[derive(Debug, Serialize)]
pub struct LoginHistoryItem {
    pub id: i64,
    pub username_attempt: String,
    pub client_ip: Option<String>,
    pub user_agent: Option<String>,
    pub success: bool,
    pub failure_reason: Option<String>,
    pub created_at: String,
}

// ---- TOTP types ----

#[derive(Debug, Serialize)]
pub struct TotpSetupResponse {
    pub secret: String,
    pub qr_code_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TotpVerifyRequest {
    pub code: String,
}

// ---- Preferences types ----

#[derive(Debug, Deserialize)]
pub struct UpdatePreferencesRequest {
    #[serde(default)]
    pub theme: Option<String>,
    #[serde(default)]
    pub lang: Option<String>,
    #[serde(default)]
    pub notifications: Option<NotificationPrefs>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NotificationPrefs {
    #[serde(default)]
    pub email: EmailNotifPrefs,
    #[serde(default)]
    pub in_app: InAppNotifPrefs,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct EmailNotifPrefs {
    #[serde(default)]
    pub rule_changes: bool,
    #[serde(default)]
    pub security_alerts: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct InAppNotifPrefs {
    #[serde(default)]
    pub approvals: bool,
    #[serde(default)]
    pub audit: bool,
}

// ---- System Settings types ----

#[derive(Debug, Serialize)]
pub struct SystemSettingItem {
    pub key: String,
    pub value: String,
    pub description: Option<String>,
    pub editable: bool,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSettingRequest {
    pub value: String,
    #[serde(default)]
    pub actor: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PreferencesResponse {
    pub user_id: String,
    pub theme: String,
    pub lang: String,
    pub notifications: Option<Value>,
}

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
