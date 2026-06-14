use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::extract::{Request, State};
use axum::http::{HeaderName, HeaderValue, StatusCode};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::{delete, get, post, put};
use axum::{Json, Router};
use serde_json::json;
use sqlx::mysql::MySqlPoolOptions;
use tower_http::trace::TraceLayer;
use tracing::info;
use uuid::Uuid;

static X_REQUEST_ID: HeaderName = HeaderName::from_static("x-request-id");

pub mod config;
pub mod db;
pub mod types;
pub mod auth;
pub mod handlers;
pub mod engine;

pub use config::*;
pub use db::mod_bootstrap::bootstrap_schema;
pub use types::*;
pub use auth::*;
use handlers::*;

pub async fn run() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    init_tracing();

    let settings = Settings::from_env();

    let pool = MySqlPoolOptions::new()
        .min_connections(1).max_connections(settings.mysql_max_connections)
        .acquire_timeout(Duration::from_secs(3))
        .connect(&settings.mysql_url).await?;

    bootstrap_schema(&pool).await?;

    let redis = redis::Client::open(settings.redis_url.clone())?;
    let state = Arc::new(AppState {
        pool: pool.clone(), redis: redis.clone(),
        cache_ttl_seconds: settings.cache_ttl_seconds,
        started_at: Instant::now(),
        auth: AuthSettings { jwt_secret: settings.jwt_secret.clone() },
    });

    // Spawn metrics background flusher
    let (shutdown_tx, shutdown_rx) = tokio::sync::watch::channel(false);
    let flusher_handle = tokio::spawn(engine::run_metrics_flusher(pool.clone(), redis.clone(), shutdown_rx));

    // Spawn metrics hourly aggregator
    let (agg_shutdown_tx, agg_shutdown_rx) = tokio::sync::watch::channel(false);
    let aggregator_handle = tokio::spawn(engine::run_metrics_aggregator(pool.clone(), agg_shutdown_rx));

    // Spawn metrics retention purger (cleans rows older than 30 days every 6h)
    let (ret_shutdown_tx, ret_shutdown_rx) = tokio::sync::watch::channel(false);
    let retention_handle = tokio::spawn(engine::run_metrics_retention(pool.clone(), ret_shutdown_rx));

    // Spawn data classification retention engine (reads classifications, purges target tables)
    let (class_ret_tx, class_ret_rx) = tokio::sync::watch::channel(false);
    let class_retention_handle = tokio::spawn(engine::run_retention_engine(pool.clone(), class_ret_rx));

    let admin_router = Router::new()
        .route("/admin/v1/rules", post(create_rule).get(list_rules))
        .route("/admin/v1/rules/:id", get(get_rule).put(update_rule).delete(delete_rule))
        .route("/admin/v1/rules/:id/versions", get(list_rule_versions))
        .route("/admin/v1/rules/:id/diff", get(get_rule_diff))
        .route("/admin/v1/rules/:id/rollback", post(rollback_rule_version))
        .route("/admin/v1/audit/logs", get(list_audit_logs))
        .route("/admin/v1/metrics/overview", get(get_metrics_overview))
        .route("/admin/v1/metrics/analytics", get(get_analytics))
        .route("/admin/v1/metrics/top-apis", get(get_top_apis))
        .route("/admin/v1/metrics/api-key-stats", get(get_api_key_stats))
        .route("/admin/v1/metrics/dashboard", get(get_dashboard))
        .route("/admin/v1/transform/preview", post(preview_transform))
        .route("/admin/v1/transform/expr-eval", post(eval_expression_handler))
        .route("/admin/v1/openapi.json", get(get_openapi_spec))
        .route("/admin/v1/api-keys", post(create_api_key).get(list_api_keys))
        .route("/admin/v1/api-keys/:id", get(get_api_key).put(update_api_key).delete(delete_api_key))
        .route("/admin/v1/rate-limits", post(create_rate_limit).get(list_rate_limits))
        .route("/admin/v1/rate-limits/:id", get(get_rate_limit).put(update_rate_limit).delete(delete_rate_limit))
        .route("/admin/v1/validate/request", post(validate_request))
        .route("/admin/v1/validate/response", post(validate_response))
        .route("/admin/v1/validate/rule/:rule_id", post(validate_against_rule))
        .route("/admin/v1/approvals", post(create_approval).get(list_approvals))
        .route("/admin/v1/approvals/my-pending", get(my_pending_approvals))
        .route("/admin/v1/approvals/my-requests", get(my_approval_requests))
        .route("/admin/v1/approvals/:id", get(get_approval).delete(delete_approval))
        .route("/admin/v1/approvals/:id/review", post(review_approval))
        // LLM Gateway routes temporarily disabled
        // .route("/admin/v1/llm/route", post(llm_route))
        // .route("/admin/v1/llm/providers", post(create_llm_provider).get(list_llm_providers))
        // .route("/admin/v1/llm/providers/:id", get(get_llm_provider).put(update_llm_provider).delete(delete_llm_provider))
        // .route("/admin/v1/llm/prompt-templates", post(create_prompt_template).get(list_prompt_templates))
        // .route("/admin/v1/llm/prompt-templates/:id", get(get_prompt_template).put(update_prompt_template).delete(delete_prompt_template))
        .route("/admin/v1/products", get(list_products).post(create_product))
        .route("/admin/v1/products/:id", get(get_product).put(update_product).delete(delete_product))
        .route("/admin/v1/products/:id/subscriptions", get(list_product_subscriptions))
        .route("/admin/v1/subscriptions", get(list_subscriptions).post(create_subscription))
        .route("/admin/v1/subscriptions/:id", get(get_subscription).put(update_subscription).delete(delete_subscription))
        .route("/admin/v1/subscriptions/:id/usage", get(get_subscription_usage))
        .route("/admin/v1/subscriptions/:id/upgrade", post(upgrade_subscription))
        .route("/admin/v1/subscriptions/:id/cancel", post(cancel_subscription))
        .route("/admin/v1/subscriptions/:id/renew", post(renew_subscription))
        .route("/admin/v1/me/subscriptions", post(subscribe_me))
        .route("/admin/v1/circuit-breakers", get(list_circuit_breakers).post(create_circuit_breaker))
        .route("/admin/v1/circuit-breakers/:id", get(get_circuit_breaker).put(update_circuit_breaker).delete(delete_circuit_breaker))
        .route("/admin/v1/protocols", get(list_protocols).post(create_protocol_config))
        .route("/admin/v1/protocols/:id", get(get_protocol_config).put(update_protocol_config).delete(delete_protocol_config))
        .route("/admin/v1/data-classifications", get(list_classifications).post(create_data_classification))
        .route("/admin/v1/data-classifications/:id", get(get_classification).put(update_data_classification).delete(delete_data_classification))
        .route("/admin/v1/plugins", get(list_plugins).post(create_plugin_config))
        .route("/admin/v1/plugins/:id", get(get_plugin_config).put(update_plugin_config).delete(delete_plugin_config))
        .route("/admin/v1/users/me", get(get_my_profile).put(update_my_profile))
        .route("/admin/v1/users/me/password", put(change_my_password))
        .route("/admin/v1/users/me/sessions", get(list_my_sessions))
        .route("/admin/v1/users/me/sessions/:id", delete(revoke_session))
        .route("/admin/v1/users/me/login-history", get(list_my_login_history))
        .route("/admin/v1/users/me/totp", get(get_totp_status).delete(disable_totp))
        .route("/admin/v1/users/me/totp/setup", post(setup_totp))
        .route("/admin/v1/users/me/totp/verify", post(verify_totp))
        .route("/admin/v1/users/me/preferences", get(get_my_preferences).put(update_my_preferences))
        .route("/admin/v1/users/me/notifications", get(list_my_notifications).delete(delete_my_notifications))
        .route("/admin/v1/users/me/notifications/read", post(mark_notification_read))
        .route("/admin/v1/users/me/notifications/:id", delete(delete_notification))
        .route("/admin/v1/users/me/notifications/unread-count", get(get_unread_count))
        .route("/admin/v1/users/me/devices", get(list_my_devices))
        .route("/admin/v1/users/me/devices/:id/trust", post(trust_device))
        .route("/admin/v1/users/me/devices/:id", delete(revoke_device))
        .route("/admin/v1/users", get(list_users).post(create_user))
        .route("/admin/v1/users/:id", get(get_user).put(update_user).delete(delete_user))
        .route("/admin/v1/system/settings", get(list_system_settings))
        .route("/admin/v1/system/settings/:key", put(update_system_setting))
        .route("/admin/v1/system/smtp/test", post(test_smtp))
        .route("/admin/v1/permission-templates", get(list_permission_templates).post(create_permission_template))
        .route("/admin/v1/permission-templates/:id", get(get_permission_template).put(update_permission_template).delete(delete_permission_template))
        .layer(middleware::from_fn_with_state(state.clone(), auth_middleware));

    let public_router = Router::new()
        .route("/admin/v1/auth/login", post(login))
        .with_state(state.clone());

    let data_router = Router::new()
        .route("/api/v1/transform/execute", post(execute_transform))
        .route("/api/v1/api-keys/validate", post(validate_api_key))
        .route("/api/v1/rate-limits/check", post(check_rate_limit))
        .route("/api/v1/metrics/ingest", post(ingest_metrics))
        .layer(middleware::from_fn_with_state(state.clone(), data_plane_middleware))
        .with_state(state.clone());

    let app = Router::new()
        .route("/health/live", get(live))
        .route("/health/ready", get(ready))
        .merge(public_router)
        .merge(admin_router)
        .merge(data_router)
        .layer(middleware::from_fn(request_id_middleware))
        .layer(build_cors_layer(&settings)?)
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(&settings.bind).await?;
    info!(bind = %settings.bind, "backend listening");
    axum::serve(listener, app)
        .with_graceful_shutdown(async {
            tokio::signal::ctrl_c().await.ok();
            info!("shutdown signal received, draining connections...");
        })
        .await?;

    // Signal background tasks to shut down
    let _ = shutdown_tx.send(true);
    let _ = flusher_handle.await;
    info!("metrics flusher stopped");

    let _ = agg_shutdown_tx.send(true);
    let _ = aggregator_handle.await;
    info!("metrics aggregator stopped");

    let _ = ret_shutdown_tx.send(true);
    let _ = retention_handle.await;
    info!("metrics retention stopped");

    let _ = class_ret_tx.send(true);
    let _ = class_retention_handle.await;
    info!("classification retention engine stopped");
    Ok(())
}

async fn request_id_middleware(
    mut request: Request,
    next: Next,
) -> Response {
    let req_id = request
        .headers()
        .get(&X_REQUEST_ID)
        .and_then(|v| v.to_str().ok())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    request.extensions_mut().insert(req_id.clone());
    let mut response = next.run(request).await;
    response.headers_mut().insert(
        &X_REQUEST_ID,
        HeaderValue::from_str(&req_id).unwrap_or(HeaderValue::from_static("unknown")),
    );
    response
}

async fn data_plane_middleware(
    State(_state): State<Arc<AppState>>,
    mut request: Request,
    next: Next,
) -> Response {
    request.extensions_mut().insert(AuthContext {
        authenticated: false,
        subject: "anonymous".to_string(),
        tenant_id: None,
        jti: None,
        permissions: vec![],
        user_group: "admin_group".to_string(),
    });
    next.run(request).await
}

async fn live() -> impl IntoResponse {
    (StatusCode::OK, Json(json!({ "status": "ok" })))
}

async fn ready(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let mysql_ready = sqlx::query_scalar::<_, i64>("SELECT 1").fetch_one(&state.pool).await.is_ok();
    let redis_ready = match state.redis.get_multiplexed_async_connection().await {
        Ok(mut conn) => redis::cmd("PING").query_async::<String>(&mut conn).await.is_ok(),
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
