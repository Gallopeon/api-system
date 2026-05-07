use serde::{Deserialize, Serialize};
use serde_json::Value;

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

#[derive(Debug, Serialize, Deserialize)]
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

#[derive(Debug, Serialize, Deserialize, Clone)]
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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HourlyBucket {
    pub hour: String,
    pub count: i64,
    pub avg_latency: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TopApiItem {
    pub api_path: String,
    pub count: i64,
    pub avg_latency: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
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

#[derive(Debug, Serialize)]
pub struct DashboardResponse {
    pub analytics: AnalyticsResponse,
    pub top_apis: TopApisResponse,
    pub api_key_stats: ApiKeyStatsResponse,
}
