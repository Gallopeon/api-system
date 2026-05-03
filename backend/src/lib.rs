use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::extract::State;
use axum::http::{HeaderValue, StatusCode};
use axum::middleware;
use axum::response::IntoResponse;
use axum::routing::{delete, get, post, put};
use axum::{Json, Router};
use serde_json::json;
use sqlx::mysql::MySqlPoolOptions;
use sqlx::MySqlPool;
use tower_http::cors::{AllowOrigin, Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing::info;

pub mod types;
pub mod auth;
pub mod handlers;
pub mod engine;

pub use types::*;
pub use auth::*;
pub use handlers::*;

#[derive(Clone)]
pub struct AppState {
    pub pool: MySqlPool,
    pub redis: redis::Client,
    pub cache_ttl_seconds: u64,
    pub started_at: Instant,
    pub auth: AuthSettings,
}

#[derive(Clone)]
struct Settings {
    bind: String,
    mysql_url: String,
    redis_url: String,
    mysql_max_connections: u32,
    cache_ttl_seconds: u64,
    auth_enabled: bool,
    jwt_secret: Option<String>,
    cors_allowed_origins: Vec<String>,
}

#[derive(Clone)]
pub struct AuthSettings {
    pub enabled: bool,
    pub jwt_secret: Option<String>,
}

impl Settings {
    fn from_env() -> Self {
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
            auth_enabled: parse_bool_env("AUTH_ENABLED", false),
            jwt_secret: std::env::var("JWT_SECRET")
                .ok().map(|v| v.trim().to_string()).filter(|v| !v.is_empty()),
            cors_allowed_origins: parse_csv_env("CORS_ALLOWED_ORIGINS", "*"),
        }
    }
}

fn parse_bool_env(key: &str, default_value: bool) -> bool {
    let raw = match std::env::var(key) { Ok(v) => v, Err(_) => return default_value };
    match raw.trim().to_ascii_lowercase().as_str() {
        "1" | "true" | "yes" | "on" => true,
        "0" | "false" | "no" | "off" => false,
        _ => default_value,
    }
}

fn parse_csv_env(key: &str, default_value: &str) -> Vec<String> {
    let raw = std::env::var(key).unwrap_or_else(|_| default_value.to_string());
    let items = raw.split(',').map(|i| i.trim().to_string()).filter(|i| !i.is_empty()).collect::<Vec<_>>();
    if items.is_empty() { vec![default_value.to_string()] } else { items }
}

pub async fn run() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    init_tracing();

    let settings = Settings::from_env();
    if settings.auth_enabled && settings.jwt_secret.is_none() {
        anyhow::bail!("AUTH_ENABLED=true but JWT_SECRET is missing");
    }

    let pool = MySqlPoolOptions::new()
        .min_connections(1).max_connections(settings.mysql_max_connections)
        .acquire_timeout(Duration::from_secs(3))
        .connect(&settings.mysql_url).await?;

    bootstrap_schema(&pool).await?;

    let redis = redis::Client::open(settings.redis_url.clone())?;
    let state = Arc::new(AppState {
        pool, redis,
        cache_ttl_seconds: settings.cache_ttl_seconds,
        started_at: Instant::now(),
        auth: AuthSettings { enabled: settings.auth_enabled, jwt_secret: settings.jwt_secret.clone() },
    });

    let api_router = Router::new()
        .route("/api/v1/rules", post(create_rule).get(list_rules))
        .route("/api/v1/rules/:id", get(get_rule).put(update_rule).delete(delete_rule))
        .route("/api/v1/rules/:id/versions", get(list_rule_versions))
        .route("/api/v1/rules/:id/diff", get(get_rule_diff))
        .route("/api/v1/rules/:id/rollback", post(rollback_rule_version))
        .route("/api/v1/audit/logs", get(list_audit_logs))
        .route("/api/v1/metrics/overview", get(get_metrics_overview))
        .route("/api/v1/transform/preview", post(preview_transform))
        .route("/api/v1/transform/execute", post(execute_transform))
        .route("/api/v1/transform/expr-eval", post(eval_expression_handler))
        .route("/api/v1/openapi.json", get(get_openapi_spec))
        .route("/api/v1/api-keys", post(create_api_key).get(list_api_keys))
        .route("/api/v1/api-keys/:id", get(get_api_key).put(update_api_key).delete(delete_api_key))
        .route("/api/v1/api-keys/validate", post(validate_api_key))
        .route("/api/v1/rate-limits", post(create_rate_limit).get(list_rate_limits))
        .route("/api/v1/rate-limits/:id", get(get_rate_limit).put(update_rate_limit).delete(delete_rate_limit))
        .route("/api/v1/rate-limits/check", post(check_rate_limit))
        .route("/api/v1/validate/request", post(validate_request))
        .route("/api/v1/validate/response", post(validate_response))
        .route("/api/v1/validate/rule/:rule_id", post(validate_against_rule))
        .route("/api/v1/metrics/ingest", post(ingest_metrics))
        .route("/api/v1/metrics/analytics", get(get_analytics))
        .route("/api/v1/metrics/top-apis", get(get_top_apis))
        .route("/api/v1/metrics/api-key-stats", get(get_api_key_stats))
        .route("/api/v1/approvals", post(create_approval).get(list_approvals))
        .route("/api/v1/approvals/:id", get(get_approval))
        .route("/api/v1/approvals/:id/review", post(review_approval))
        .route("/api/v1/llm/route", post(llm_route))
        .route("/api/v1/llm/providers", post(create_llm_provider).get(list_llm_providers))
        .route("/api/v1/llm/prompt-templates", post(create_prompt_template).get(list_prompt_templates))
        .route("/api/v1/products", get(list_products).post(create_product))
        .route("/api/v1/products/:id", get(get_product).put(update_product).delete(delete_product))
        .route("/api/v1/subscriptions", get(list_subscriptions).post(create_subscription))
        .route("/api/v1/subscriptions/:id", get(get_subscription).put(update_subscription).delete(delete_subscription))
        .route("/api/v1/circuit-breakers", get(list_circuit_breakers).post(create_circuit_breaker))
        .route("/api/v1/circuit-breakers/:id", get(get_circuit_breaker).put(update_circuit_breaker).delete(delete_circuit_breaker))
        .route("/api/v1/protocols", get(list_protocols).post(create_protocol_config))
        .route("/api/v1/protocols/:id", get(get_protocol_config).put(update_protocol_config).delete(delete_protocol_config))
        .route("/api/v1/data-classifications", get(list_classifications).post(create_data_classification))
        .route("/api/v1/data-classifications/:id", get(get_classification).put(update_data_classification).delete(delete_data_classification))
        .route("/api/v1/plugins", get(list_plugins).post(create_plugin_config))
        .route("/api/v1/plugins/:id", get(get_plugin_config).put(update_plugin_config).delete(delete_plugin_config))
        .route("/api/v1/users/me", get(get_my_profile).put(update_my_profile))
        .route("/api/v1/users/me/password", put(change_my_password))
        .route("/api/v1/users/me/sessions", get(list_my_sessions))
        .route("/api/v1/users/me/sessions/:id", delete(revoke_session))
        .route("/api/v1/users/me/login-history", get(list_my_login_history))
        .route("/api/v1/users/me/totp/setup", post(setup_totp))
        .route("/api/v1/users/me/totp/verify", post(verify_totp))
        .route("/api/v1/users/me/totp", delete(disable_totp))
        .route("/api/v1/users/me/preferences", get(get_my_preferences).put(update_my_preferences))
        .route("/api/v1/users", get(list_users).post(create_user))
        .route("/api/v1/users/:id", get(get_user).put(update_user).delete(delete_user))
        .route("/api/v1/system/settings", get(list_system_settings))
        .route("/api/v1/system/settings/:key", put(update_system_setting))
        .layer(middleware::from_fn_with_state(state.clone(), auth_middleware));

    let public_router = Router::new()
        .route("/api/v1/auth/login", post(login))
        .with_state(state.clone());

    let app = Router::new()
        .route("/health/live", get(live))
        .route("/health/ready", get(ready))
        .merge(public_router)
        .merge(api_router)
        .layer(build_cors_layer(&settings)?)
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(&settings.bind).await?;
    info!(bind = %settings.bind, "backend listening");
    axum::serve(listener, app).await?;
    Ok(())
}

fn init_tracing() {
    tracing_subscriber::fmt()
        .with_env_filter(std::env::var("RUST_LOG")
            .unwrap_or_else(|_| "info,api_control_backend=debug,sqlx=warn".to_string()))
        .json().init();
}

fn build_cors_layer(settings: &Settings) -> anyhow::Result<CorsLayer> {
    let base = CorsLayer::new().allow_methods(Any).allow_headers(Any);
    if settings.cors_allowed_origins.iter().any(|o| o == "*") {
        return Ok(base.allow_origin(Any));
    }
    let origins: Vec<HeaderValue> = settings.cors_allowed_origins.iter()
        .map(|o| HeaderValue::from_str(o).map_err(|e| anyhow::anyhow!("invalid CORS origin: {}", e)))
        .collect::<Result<_, _>>()?;
    Ok(base.allow_origin(AllowOrigin::list(origins)))
}

async fn bootstrap_schema(pool: &MySqlPool) -> Result<(), AppError> {
    sqlx::query(r#"CREATE TABLE IF NOT EXISTS rule_configs (
        id VARCHAR(36) PRIMARY KEY, name VARCHAR(120) NOT NULL, api_path VARCHAR(255) NOT NULL,
        current_version INT NOT NULL, status VARCHAR(32) NOT NULL DEFAULT 'draft',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS rule_versions (
        id BIGINT PRIMARY KEY AUTO_INCREMENT, rule_id VARCHAR(36) NOT NULL, version INT NOT NULL,
        config_text LONGTEXT NOT NULL, note VARCHAR(255) NULL,
        change_kind ENUM('breaking','non_breaking','rollback','minor') NOT NULL DEFAULT 'breaking',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_rule_version (rule_id, version), KEY idx_rule_id (rule_id),
        CONSTRAINT fk_rule_versions_rule FOREIGN KEY (rule_id) REFERENCES rule_configs(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    let has_ck: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rule_versions' AND COLUMN_NAME = 'change_kind'"
    ).fetch_one(pool).await.unwrap_or(0);
    if has_ck == 0 {
        sqlx::query("ALTER TABLE rule_versions ADD COLUMN change_kind ENUM('breaking','non_breaking','rollback','minor') NOT NULL DEFAULT 'breaking'")
            .execute(pool).await?;
    }

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGINT PRIMARY KEY AUTO_INCREMENT, rule_id VARCHAR(36) NULL, action VARCHAR(64) NOT NULL,
        actor VARCHAR(64) NOT NULL DEFAULT 'system', success TINYINT(1) NOT NULL DEFAULT 1,
        message VARCHAR(255) NULL, detail LONGTEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_audit_created (created_at), KEY idx_audit_rule_action (rule_id, action), KEY idx_audit_actor (actor)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS api_keys (
        id VARCHAR(36) PRIMARY KEY, key_prefix VARCHAR(12) NOT NULL, key_hash VARCHAR(128) NOT NULL UNIQUE,
        name VARCHAR(120) NOT NULL, status VARCHAR(32) NOT NULL DEFAULT 'active', scopes JSON NULL,
        expires_at TIMESTAMP NULL, max_calls INT NULL, call_count INT NOT NULL DEFAULT 0,
        tenant_id VARCHAR(64) NULL, created_by VARCHAR(64) NOT NULL DEFAULT 'system',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_key_hash (key_hash), KEY idx_key_status (status), KEY idx_key_tenant (tenant_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS rate_limit_configs (
        id VARCHAR(36) PRIMARY KEY, name VARCHAR(120) NOT NULL, api_path VARCHAR(255) NOT NULL,
        window_seconds INT NOT NULL DEFAULT 60, max_requests INT NOT NULL DEFAULT 100, burst_size INT NOT NULL DEFAULT 50,
        quota_daily INT NULL, quota_monthly INT NULL, per_api_key TINYINT(1) NOT NULL DEFAULT 0,
        per_ip TINYINT(1) NOT NULL DEFAULT 1, status VARCHAR(32) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_rl_api_path (api_path), KEY idx_rl_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS metrics_ingest (
        id BIGINT PRIMARY KEY AUTO_INCREMENT, api_path VARCHAR(255) NOT NULL, method VARCHAR(10) NOT NULL DEFAULT 'GET',
        status_code INT NOT NULL DEFAULT 200, latency_ms INT NOT NULL DEFAULT 0,
        api_key_id VARCHAR(36) NULL, client_ip VARCHAR(45) NULL,
        timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_metrics_api_time (api_path, timestamp), KEY idx_metrics_key (api_key_id), KEY idx_metrics_created (timestamp)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS approvals (
        id VARCHAR(36) PRIMARY KEY, rule_id VARCHAR(36) NOT NULL, version INT NOT NULL,
        requestor VARCHAR(64) NOT NULL, reviewer VARCHAR(64) NULL, status VARCHAR(32) NOT NULL DEFAULT 'pending',
        comment TEXT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TIMESTAMP NULL,
        KEY idx_approval_rule (rule_id), KEY idx_approval_status (status),
        CONSTRAINT fk_approval_rule FOREIGN KEY (rule_id) REFERENCES rule_configs(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS llm_providers (
        id VARCHAR(36) PRIMARY KEY, name VARCHAR(120) NOT NULL, provider_type VARCHAR(64) NOT NULL,
        endpoint_url VARCHAR(512) NOT NULL, api_key_env VARCHAR(128) NULL, model_name VARCHAR(128) NOT NULL,
        cost_per_1k_input DECIMAL(10,6) NOT NULL DEFAULT 0, cost_per_1k_output DECIMAL(10,6) NOT NULL DEFAULT 0,
        max_tokens INT NOT NULL DEFAULT 4096, status VARCHAR(32) NOT NULL DEFAULT 'active',
        priority INT NOT NULL DEFAULT 10, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_llm_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS prompt_templates (
        id VARCHAR(36) PRIMARY KEY, name VARCHAR(120) NOT NULL, template_text LONGTEXT NOT NULL,
        variables JSON NULL, version INT NOT NULL DEFAULT 1, status VARCHAR(32) NOT NULL DEFAULT 'draft',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS llm_usage_logs (
        id BIGINT PRIMARY KEY AUTO_INCREMENT, provider_id VARCHAR(36) NULL, prompt_template_id VARCHAR(36) NULL,
        input_tokens INT NOT NULL DEFAULT 0, output_tokens INT NOT NULL DEFAULT 0,
        latency_ms INT NOT NULL DEFAULT 0, cost DECIMAL(12,6) NOT NULL DEFAULT 0,
        api_key_id VARCHAR(36) NULL, success TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_llm_created (created_at), KEY idx_llm_key (api_key_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS api_products (
        id VARCHAR(36) PRIMARY KEY, name VARCHAR(120) NOT NULL, description TEXT NULL,
        rule_ids JSON NULL, status VARCHAR(32) NOT NULL DEFAULT 'draft',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS subscriptions (
        id VARCHAR(36) PRIMARY KEY, api_key_id VARCHAR(36) NOT NULL, product_id VARCHAR(36) NOT NULL,
        plan VARCHAR(32) NOT NULL DEFAULT 'free', rate_limit_rps INT NULL, quota_daily INT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'active', expires_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_sub_key (api_key_id), KEY idx_sub_product (product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS circuit_breakers (
        id VARCHAR(36) PRIMARY KEY, api_path VARCHAR(255) NOT NULL UNIQUE,
        failure_threshold INT NOT NULL DEFAULT 5, recovery_timeout_sec INT NOT NULL DEFAULT 30,
        half_open_max INT NOT NULL DEFAULT 3, retry_count INT NOT NULL DEFAULT 3,
        retry_delay_ms INT NOT NULL DEFAULT 100, timeout_ms INT NOT NULL DEFAULT 10000,
        status VARCHAR(32) NOT NULL DEFAULT 'active', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS protocol_configs (
        id VARCHAR(36) PRIMARY KEY, api_path VARCHAR(255) NOT NULL UNIQUE, protocol VARCHAR(32) NOT NULL,
        config_json LONGTEXT NULL, status VARCHAR(32) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_proto (protocol)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS data_classifications (
        id VARCHAR(36) PRIMARY KEY, api_path VARCHAR(255) NOT NULL UNIQUE,
        data_category VARCHAR(64) NOT NULL DEFAULT 'internal', contains_pii TINYINT(1) NOT NULL DEFAULT 0,
        gdpr_relevant TINYINT(1) NOT NULL DEFAULT 0, retention_days INT NOT NULL DEFAULT 365,
        notes TEXT NULL, classified_by VARCHAR(64) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_class_category (data_category)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS plugin_configs (
        id VARCHAR(36) PRIMARY KEY, name VARCHAR(120) NOT NULL, plugin_type VARCHAR(64) NOT NULL,
        hook_point VARCHAR(64) NOT NULL, config_json LONGTEXT NULL, priority INT NOT NULL DEFAULT 100,
        status VARCHAR(32) NOT NULL DEFAULT 'active', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_plugin_hook (hook_point), KEY idx_plugin_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    // ---- User management tables ----

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY, username VARCHAR(64) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL, email VARCHAR(128) NULL UNIQUE,
        display_name VARCHAR(128) NULL, avatar_url VARCHAR(512) NULL,
        role VARCHAR(32) NOT NULL DEFAULT 'viewer', status VARCHAR(32) NOT NULL DEFAULT 'active',
        failed_login_attempts INT NOT NULL DEFAULT 0, locked_until TIMESTAMP NULL,
        last_login_at TIMESTAMP NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_users_username (username), KEY idx_users_email (email), KEY idx_users_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS user_sessions (
        id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL, token_jti VARCHAR(64) NOT NULL UNIQUE,
        token_expires_at TIMESTAMP NOT NULL, client_ip VARCHAR(45) NULL, user_agent VARCHAR(512) NULL,
        revoked TINYINT(1) NOT NULL DEFAULT 0, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_sessions_user (user_id), KEY idx_sessions_jti (token_jti),
        CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS login_history (
        id BIGINT PRIMARY KEY AUTO_INCREMENT, user_id VARCHAR(36) NULL,
        username_attempt VARCHAR(64) NOT NULL, client_ip VARCHAR(45) NULL,
        user_agent VARCHAR(512) NULL, success TINYINT(1) NOT NULL DEFAULT 0,
        failure_reason VARCHAR(128) NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_login_user (user_id), KEY idx_login_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS user_totp (
        user_id VARCHAR(36) PRIMARY KEY, secret VARCHAR(128) NOT NULL,
        enabled TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_totp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    // Add preferences column if it doesn't exist
    let has_prefs: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'preferences'"
    ).fetch_one(pool).await.unwrap_or(0);
    if has_prefs == 0 {
        sqlx::query("ALTER TABLE users ADD COLUMN preferences JSON NULL")
            .execute(pool).await?;
    }

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS system_settings (
        setting_key VARCHAR(128) PRIMARY KEY, setting_value TEXT NOT NULL,
        description VARCHAR(255) NULL, editable TINYINT(1) NOT NULL DEFAULT 1,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    // Seed default settings
    seed_settings(pool).await?;

    // Seed default admin if no users exist
    seed_admin(pool).await?;

    Ok(())
}

async fn seed_settings(pool: &MySqlPool) -> Result<(), AppError> {
    let defaults: Vec<(&str, &str, &str, bool)> = vec![
        ("auth_enabled", "false", "Enable JWT authentication", true),
        ("cache_ttl_seconds", "300", "Redis cache TTL in seconds", true),
        ("jwt_ttl_seconds", "86400", "JWT token expiry in seconds", true),
        ("login_max_attempts", "5", "Max failed logins before lockout", true),
        ("login_lockout_minutes", "15", "Account lockout duration in minutes", true),
        ("password_policy_enforced", "true", "Enforce password strength rules", true),
        ("jwt_secret", "****", "JWT signing secret (env-only)", false),
        ("admin_default_password", "****", "Default admin password (env-only)", false),
        ("cors_allowed_origins", "*", "CORS allowed origins", true),
        ("rust_log", "info", "Log level", true),
    ];
    for (key, val, desc, editable) in &defaults {
        sqlx::query(
            "INSERT IGNORE INTO system_settings (setting_key, setting_value, description, editable) VALUES (?, ?, ?, ?)"
        )
        .bind(key).bind(val).bind(desc).bind(editable)
        .execute(pool).await?;
    }
    Ok(())
}

pub fn resolve_setting(key: &str) -> String {
    // Resolve from env first, then fallback — handled at call sites
    std::env::var(key.to_uppercase()).unwrap_or_default()
}

async fn seed_admin(pool: &MySqlPool) -> Result<(), AppError> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users").fetch_one(pool).await?;
    if count > 0 {
        return Ok(());
    }
    let default_pw = std::env::var("ADMIN_DEFAULT_PASSWORD")
        .unwrap_or_else(|_| "admin".to_string());
    let hash = bcrypt::hash(&default_pw, 12)
        .map_err(|e| AppError::BadRequest(format!("bcrypt hash failed: {}", e)))?;
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO users (id, username, password_hash, email, display_name, role) VALUES (?, ?, ?, ?, ?, 'admin')"
    ).bind(&id).bind("admin").bind(&hash).bind("admin@example.com").bind("Administrator")
    .execute(pool).await?;
    Ok(())
}

async fn live() -> impl IntoResponse {
    (StatusCode::OK, Json(json!({ "status": "ok" })))
}

async fn ready(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let mysql_ready = sqlx::query_scalar::<_, i64>("SELECT 1").fetch_one(&state.pool).await.is_ok();
    let redis_ready = match state.redis.get_async_connection().await {
        Ok(mut conn) => redis::cmd("PING").query_async::<_, String>(&mut conn).await.is_ok(),
        Err(_) => false,
    };
    if mysql_ready && redis_ready {
        (StatusCode::OK, Json(json!({ "status": "ready" }))).into_response()
    } else {
        (StatusCode::SERVICE_UNAVAILABLE, Json(json!({
            "status": "degraded", "mysql_ready": mysql_ready, "redis_ready": redis_ready
        }))).into_response()
    }
}
