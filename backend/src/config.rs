use std::time::Instant;

use axum::http::HeaderValue;
use sqlx::MySqlPool;
use tower_http::cors::{AllowOrigin, Any, CorsLayer};

#[derive(Clone)]
pub struct AppState {
    pub pool: MySqlPool,
    pub redis: redis::Client,
    pub cache_ttl_seconds: u64,
    pub started_at: Instant,
    pub auth: AuthSettings,
}

#[derive(Clone)]
pub struct Settings {
    pub bind: String,
    pub mysql_url: String,
    pub redis_url: String,
    pub mysql_max_connections: u32,
    pub cache_ttl_seconds: u64,
    pub jwt_secret: String,
    pub cors_allowed_origins: Vec<String>,
}

#[derive(Clone)]
pub struct AuthSettings {
    pub jwt_secret: String,
}

impl Settings {
    pub fn from_env() -> Self {
        Self {
            bind: std::env::var("APP_BIND").unwrap_or_else(|_| "0.0.0.0:8080".to_string()),
            mysql_url: std::env::var("MYSQL_URL")
                .unwrap_or_else(|_| "mysql://root:root@127.0.0.1:3306/apictrl".to_string()),
            redis_url: std::env::var("REDIS_URL")
                .unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string()),
            mysql_max_connections: std::env::var("MYSQL_MAX_CONNECTIONS")
                .ok().and_then(|v| v.parse::<u32>().ok()).unwrap_or(15),
            cache_ttl_seconds: std::env::var("CACHE_TTL_SECONDS")
                .ok().and_then(|v| v.parse::<u64>().ok()).unwrap_or(300),
            jwt_secret: std::env::var("JWT_SECRET")
                .unwrap_or_else(|_| "dev-secret-change-me-in-production".to_string()),
            cors_allowed_origins: parse_csv_env("CORS_ALLOWED_ORIGINS", "*"),
        }
    }
}

pub fn parse_csv_env(key: &str, default_value: &str) -> Vec<String> {
    let raw = std::env::var(key).unwrap_or_else(|_| default_value.to_string());
    let items = raw.split(',').map(|i| i.trim().to_string()).filter(|i| !i.is_empty()).collect::<Vec<_>>();
    if items.is_empty() { vec![default_value.to_string()] } else { items }
}

pub fn init_tracing() {
    tracing_subscriber::fmt()
        .with_env_filter(std::env::var("RUST_LOG")
            .unwrap_or_else(|_| "info,api_control_backend=debug,sqlx=warn".to_string()))
        .json().init();
}

pub fn build_cors_layer(settings: &Settings) -> anyhow::Result<CorsLayer> {
    let base = CorsLayer::new().allow_methods(Any).allow_headers(Any);
    if settings.cors_allowed_origins.iter().any(|o| o == "*") {
        return Ok(base.allow_origin(Any));
    }
    let origins: Vec<HeaderValue> = settings.cors_allowed_origins.iter()
        .map(|o| HeaderValue::from_str(o).map_err(|e| anyhow::anyhow!("invalid CORS origin: {}", e)))
        .collect::<Result<_, _>>()?;
    Ok(base.allow_origin(AllowOrigin::list(origins)))
}
