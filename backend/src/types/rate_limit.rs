use serde::{Deserialize, Serialize};

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

#[derive(Debug, Serialize)]
pub struct RateLimitListResponse {
    pub items: Vec<RateLimitResponse>,
    pub limit: u32,
    pub offset: u32,
}
