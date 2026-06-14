use sqlx::MySqlPool;
use crate::auth::AppError;

pub async fn seed_plugins(pool: &MySqlPool) -> Result<(), AppError> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM plugin_configs").fetch_one(pool).await?;
    if count > 0 {
        return Ok(());
    }
    let defaults: Vec<(&str, &str, &str, &str, i32)> = vec![
        // ── pre_auth: runs before authentication ──
        (
            "IP Blacklist",
            "lua",
            "pre_auth",
            r#"{"type":"ip_blacklist","ips":["10.0.0.1","192.168.1.100"],"action":"deny","message":"Access denied from your IP address","enabled":true}"#,
            10,
        ),
        (
            "CORS Preflight Handler",
            "lua",
            "pre_auth",
            r#"{"type":"cors","allowed_origins":["http://localhost:3000"],"allowed_methods":["GET","POST","PUT","DELETE","PATCH","OPTIONS"],"allowed_headers":["Content-Type","Authorization","X-Request-ID"],"expose_headers":["X-Request-ID"],"max_age":86400,"allow_credentials":true,"enabled":true}"#,
            20,
        ),
        (
            "Bot Detection",
            "lua",
            "pre_auth",
            r#"{"type":"bot_detection","block_user_agents":["*bot*","*crawler*","*spider*"],"block_empty_ua":false,"challenge_suspicious":true,"honeypot_field":"_trap","enabled":true}"#,
            30,
        ),
        // ── post_auth: runs after authentication succeeds ──
        (
            "RBAC Enforcer",
            "lua",
            "post_auth",
            r#"{"type":"rbac","roles":{"admin":"*","editor":["read","write"],"viewer":["read"]},"default_deny":true,"status_code":403,"message":"Insufficient permissions for this resource","enabled":true}"#,
            40,
        ),
        (
            "API Key Scope Validator",
            "lua",
            "post_auth",
            r#"{"type":"scope_validator","scopes":{"/api/v1/users":["user:read","user:write"],"/api/v1/orders":["order:read","order:write"]},"require_exact_match":false,"status_code":403,"message":"API key scope does not cover this endpoint","enabled":true}"#,
            50,
        ),
        (
            "Auth Audit Logger",
            "lua",
            "post_auth",
            r#"{"type":"audit_logger","log_fields":["client_ip","user_agent","api_key_id","timestamp","endpoint"],"destination":"mysql","table":"audit_logs","async":true,"enabled":true}"#,
            60,
        ),
        // ── pre_transform: runs before request transformation ──
        (
            "Request Logger",
            "lua",
            "pre_transform",
            r#"{"type":"request_logger","log_headers":true,"log_body":false,"log_query_params":true,"log_format":"json","sample_rate":1.0,"enabled":true}"#,
            70,
        ),
        (
            "Request ID Injector",
            "lua",
            "pre_transform",
            r#"{"type":"request_id","header_name":"X-Request-ID","generate_if_missing":true,"propagate_to_response":true,"id_format":"uuid","enabled":true}"#,
            80,
        ),
        (
            "Request Size Limiter",
            "lua",
            "pre_transform",
            r#"{"type":"size_limit","max_body_bytes":1048576,"max_header_bytes":8192,"status_code":413,"message":"Request entity too large","enabled":true}"#,
            90,
        ),
        (
            "Rate Limit Guard",
            "lua",
            "pre_transform",
            r#"{"type":"rate_limit_guard","window_seconds":60,"max_requests":100,"burst":20,"per_ip":true,"per_api_key":true,"status_code":429,"message":"Too many requests, please try again later","enabled":true}"#,
            100,
        ),
        // ── post_transform: runs after response transformation ──
        (
            "Security Headers Injector",
            "lua",
            "post_transform",
            r#"{"type":"response_headers","headers":{"X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY","X-XSS-Protection":"1; mode=block","Referrer-Policy":"strict-origin-when-cross-origin","Permissions-Policy":"camera=(), microphone=(), geolocation=()"},"remove_headers":["Server","X-Powered-By"],"enabled":true}"#,
            110,
        ),
        (
            "PII Masking Guard",
            "lua",
            "post_transform",
            r#"{"type":"pii_guard","fields":["ssn","email","phone","credit_card","password"],"mask_pattern":"***REDACTED***","check_nested":true,"status_code":500,"message":"Sensitive data detected in response","enabled":true}"#,
            120,
        ),
        (
            "Cache-Control Header Setter",
            "lua",
            "post_transform",
            r#"{"type":"cache_control","default_max_age":300,"paths":{"/api/v1/products":3600,"/api/v1/metrics":60},"vary_headers":["Accept-Language","X-API-Version"],"enabled":true}"#,
            130,
        ),
        // ── pre_cache: runs before cache lookup ──
        (
            "Cache Key Builder",
            "lua",
            "pre_cache",
            r#"{"type":"cache_key","include_query":true,"include_headers":["Accept-Language"],"exclude_params":["utm_source","utm_medium","_"],"key_prefix":"api","hash_algorithm":"sha256","enabled":true}"#,
            140,
        ),
        (
            "Cache Skip Condition",
            "lua",
            "pre_cache",
            r#"{"type":"cache_skip","skip_when":{"headers":{"Cache-Control":"no-cache"},"query_params":{"nocache":"1"},"methods":["POST","PUT","DELETE","PATCH"]},"status_override":null,"enabled":true}"#,
            150,
        ),
        (
            "Conditional Cache TTL",
            "lua",
            "pre_cache",
            r#"{"type":"conditional_ttl","rules":[{"match":{"path":"/api/v1/products/*"},"ttl":3600},{"match":{"path":"/api/v1/orders/*"},"ttl":300},{"match":{"path":"/api/v1/users/*"},"ttl":60}],"default_ttl":120,"enabled":true}"#,
            160,
        ),
        // ── post_cache: runs after cache lookup (cache hit or miss) ──
        (
            "Cache Hit Metrics",
            "lua",
            "post_cache",
            r#"{"type":"cache_metrics","emit_headers":true,"header_hit":"X-Cache-Hit","header_miss":"X-Cache-Miss","track_stats":true,"stats_window_minutes":5,"enabled":true}"#,
            170,
        ),
        (
            "Cache Warmer Trigger",
            "lua",
            "post_cache",
            r#"{"type":"cache_warmer","warm_paths":["/api/v1/products","/api/v1/categories"],"warm_interval_seconds":300,"background":true,"max_concurrent":3,"enabled":true}"#,
            180,
        ),
        (
            "Stale-While-Revalidate",
            "lua",
            "post_cache",
            r#"{"type":"stale_while_revalidate","stale_ttl":86400,"revalidate_ttl":300,"serve_stale_on_error":true,"async_revalidate":true,"enabled":true}"#,
            190,
        ),
    ];
    let mut tx = pool.begin().await?;
    for (name, plugin_type, hook_point, config_json, priority) in &defaults {
        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO plugin_configs (id, name, plugin_type, hook_point, config_json, priority, status) VALUES (?, ?, ?, ?, ?, ?, 'active')"
        )
        .bind(&id).bind(name).bind(plugin_type).bind(hook_point).bind(config_json).bind(priority)
        .execute(&mut *tx).await?;
    }
    tx.commit().await?;
    Ok(())
}

pub async fn seed_protocols(pool: &MySqlPool) -> Result<(), AppError> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM protocol_configs").fetch_one(pool).await?;
    if count > 0 {
        return Ok(());
    }
    let defaults: Vec<(&str, &str, &str, &str)> = vec![
        // ── GraphQL ──
        (
            "/admin/v1/graphql",
            "graphql",
            "Schema federation for internal services — stitches Users and Orders subgraphs with query depth limiting and persisted queries support.",
            r#"{"type":"schema_federation","subgraphs":[{"name":"users","endpoint":"/graphql/users"},{"name":"orders","endpoint":"/graphql/orders"}],"introspection":true,"query_depth_limit":8,"complexity_limit":1000,"persisted_queries":true,"enabled":true}"#,
        ),
        (
            "/api/public/graphql",
            "graphql",
            "Public GraphQL gateway with IP-based rate limiting, JWT authentication, and restricted mutation allowlist for third-party integrations.",
            r#"{"type":"public_gateway","rate_limit_per_ip":60,"require_authentication":true,"allowed_mutations":["createOrder","updateProfile"],"blocked_introspection_fields":["__schema","__type"],"response_cache_ttl":30,"enabled":true}"#,
        ),
        // ── gRPC ──
        (
            "/grpc.UserService",
            "grpc",
            "gRPC-to-REST transcoding for UserService — maps protobuf RPCs (GetUser, ListUsers, CreateUser) to RESTful HTTP endpoints with server reflection.",
            r#"{"type":"grpc_method_mapping","methods":[{"rpc":"GetUser","http_method":"GET","http_path":"/api/users/{id}"},{"rpc":"ListUsers","http_method":"GET","http_path":"/api/users"},{"rpc":"CreateUser","http_method":"POST","http_path":"/api/users"}],"proto_file":"user.proto","enable_reflection":true,"deadline_ms":5000,"enabled":true}"#,
        ),
        (
            "/grpc.OrderService",
            "grpc",
            "gRPC service proxy for OrderService with health checking, distributed tracing, and automatic retry on UNAVAILABLE/DEADLINE_EXCEEDED errors.",
            r#"{"type":"grpc_service_proxy","proto_file":"order.proto","health_check_path":"/grpc.health.v1.Health/Check","max_message_size_mb":8,"enable_tracing":true,"retry_policy":{"max_attempts":3,"backoff_ms":100,"retryable_statuses":["UNAVAILABLE","DEADLINE_EXCEEDED"]},"enabled":true}"#,
        ),
        // ── SSE ──
        (
            "/api/events/notifications",
            "sse",
            "Server-Sent Events stream for real-time notification delivery — supports JWT auth, automatic reconnect, and heartbeat keepalive every 15s.",
            r#"{"type":"event_stream","auth_required":true,"event_types":["notification.new","notification.read"],"reconnect_delay_ms":3000,"max_retries":5,"heartbeat_interval_ms":15000,"idle_timeout_ms":120000,"enabled":true}"#,
        ),
        (
            "/api/events/metrics",
            "sse",
            "Real-time metrics push via SSE — streams CPU, memory, and RPS data to admin dashboards with buffered batching every 5s.",
            r#"{"type":"metrics_stream","event_types":["metrics.cpu","metrics.memory","metrics.rps"],"buffer_size":100,"flush_interval_ms":5000,"max_clients":50,"require_role":"admin","enabled":true}"#,
        ),
        // ── WebSocket ──
        (
            "/ws/chat",
            "ws",
            "WebSocket chat with room-based broadcasting — JWT authenticated, supports general/support/alerts rooms, limits 5 connections per IP.",
            r#"{"type":"ws_room_broadcast","auth_via":"jwt_token","rooms":["general","support","alerts"],"max_message_size_kb":16,"max_connections_per_ip":5,"idle_timeout_sec":300,"enable_typing_indicator":true,"enabled":true}"#,
        ),
        (
            "/ws/live",
            "ws",
            "WebSocket real-time push channel for dashboard updates, rule changes, and alert triggers — API-key authenticated with per-message compression.",
            r#"{"type":"ws_realtime_push","auth_via":"api_key","message_types":["dashboard.update","rule.change","alert.triggered"],"compression":true,"max_connections_total":200,"ping_interval_sec":30,"enabled":true}"#,
        ),
        // ── REST ──
        (
            "/api/v2/users",
            "rest",
            "REST API versioning via Accept-Version header — v2.0 current, v1.0 deprecated with Sunset header, response envelope wraps data with metadata.",
            r#"{"type":"api_versioning","version_header":"Accept-Version","default_version":"2.0","deprecated_versions":["1.0"],"sunset_header":true,"rate_limit_per_min":120,"response_envelope":{"enabled":true,"wrap_data":true,"include_metadata":true},"enabled":true}"#,
        ),
        (
            "/api/public/catalog",
            "rest",
            "Public product catalog with cursor-based pagination, HATEOAS links, field filtering, and 60s CDN cache — designed for developer portal consumption.",
            r#"{"type":"public_catalog","pagination_style":"cursor","default_page_size":20,"max_page_size":100,"hateoas_links":true,"cache_control":"public, max-age=60","cors_allow_origins":["*"],"fields_filtering":true,"enabled":true}"#,
        ),
    ];
    let mut tx = pool.begin().await?;
    for (api_path, protocol, description, config_json) in &defaults {
        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO protocol_configs (id, api_path, protocol, description, config_json, status) VALUES (?, ?, ?, ?, ?, 'active')"
        )
        .bind(&id).bind(api_path).bind(protocol).bind(description).bind(config_json)
        .execute(&mut *tx).await?;
    }
    tx.commit().await?;
    Ok(())
}

pub async fn seed_classifications(pool: &MySqlPool) -> Result<(), AppError> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM data_classifications").fetch_one(pool).await?;
    if count > 0 {
        return Ok(());
    }
    // (api_path, data_category, description, contains_pii, gdpr_relevant, retention_days, target_table, notes)
    let defaults: Vec<(&str, &str, &str, bool, bool, i32, Option<&str>, &str)> = vec![
        (
            "/admin/v1/users",
            "pii",
            "用户管理端点 — 处理用户名、邮箱、密码哈希、角色等个人身份信息，GDPR 适用，需要最短保留期",
            true, true, 90, Some("user_sessions"),
            "GDPR Article 17 (right to erasure) applies. Cleans expired user sessions.",
        ),
        (
            "/admin/v1/auth/login",
            "confidential",
            "认证端点 — 处理登录凭据和 JWT 令牌，属于机密数据，令牌相关日志最多保留 30 天",
            true, true, 30, Some("login_history"),
            "Cleans login_history older than 30 days. Failed attempts kept for security auditing.",
        ),
        (
            "/api/v1/transform",
            "internal",
            "数据转换管线 — 处理 API 响应内容，可能包含被转换的业务数据，按默认策略保留",
            false, false, 365, None,
            "No automated cleanup — transform data is ephemeral (cache-based).",
        ),
        (
            "/api/public/catalog",
            "public",
            "开发者门户产品目录 — 公开可访问的产品信息，不包含任何敏感数据，可永久缓存",
            false, false, 0, None,
            "Public catalog data has no retention limit. CDN cache encouraged.",
        ),
        (
            "/admin/v1/metrics/ingest",
            "internal",
            "指标采集端点 — 接收 API 调用指标和性能数据，不包含用户 PII 但属于内部运营数据",
            false, false, 30, Some("metrics_ingest"),
            "Raw metrics rows older than 30 days are purged by the retention engine (batch 5000).",
        ),
        (
            "/admin/v1/audit-logs",
            "confidential",
            "审计日志 — 记录所有管理员操作和系统事件，包含操作者身份信息，安全审计用途保留 365 天",
            true, false, 365, Some("audit_logs"),
            "Audit trail required for SOC 2 compliance. Auto-purged after 365 days.",
        ),
        (
            "/admin/v1/notifications",
            "internal",
            "通知中心 — 存储用户通知和偏好设置，包含用户特定的消息内容",
            false, false, 60, Some("notifications"),
            "Notifications older than 60 days are auto-purged by the retention engine.",
        ),
        (
            "/api/v2/users",
            "pii",
            "公开用户 API (v2) — 返回用户资料数据给第三方客户端，经过脱敏处理，需要 OAuth 授权",
            true, true, 90, Some("login_history"),
            "Cleans login_history for user-related auth events. GDPR consent required.",
        ),
    ];
    let mut tx = pool.begin().await?;
    for (api_path, data_category, description, contains_pii, gdpr_relevant, retention_days, target_table, notes) in &defaults {
        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO data_classifications (id, api_path, data_category, description, contains_pii, gdpr_relevant, retention_days, target_table, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&id).bind(api_path).bind(data_category).bind(description)
        .bind(contains_pii).bind(gdpr_relevant).bind(retention_days)
        .bind(target_table).bind(notes)
        .execute(&mut *tx).await?;
    }
    tx.commit().await?;
    Ok(())
}

pub async fn seed_settings(pool: &MySqlPool) -> Result<(), AppError> {
    let defaults: Vec<(&str, &str, &str, bool)> = vec![
        ("cache_ttl_seconds", "300", "Redis cache TTL in seconds", true),
        ("jwt_ttl_seconds", "86400", "JWT token expiry in seconds", true),
        ("login_max_attempts", "5", "Max failed logins before lockout", true),
        ("login_lockout_minutes", "15", "Account lockout duration in minutes", true),
        ("password_policy_enforced", "true", "Enforce password strength rules", true),
        ("jwt_secret", "****", "JWT signing secret (env-only)", false),
        ("admin_default_password", "****", "Default admin password (env-only)", false),
        ("cors_allowed_origins", "*", "CORS allowed origins", true),
        ("rust_log", "info", "Log level", true),
        // SMTP configuration
        ("smtp_host", "", "SMTP server hostname", true),
        ("smtp_port", "587", "SMTP server port", true),
        ("smtp_username", "", "SMTP authentication username", true),
        ("smtp_password", "", "SMTP authentication password", true),
        ("smtp_from_email", "", "Sender email address", true),
        ("smtp_from_name", "API Control Plane", "Sender display name", true),
        ("smtp_encryption", "tls", "SMTP encryption: tls, starttls, or none", true),
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

pub async fn seed_admin(pool: &MySqlPool) -> Result<(), AppError> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users").fetch_one(pool).await?;
    if count > 0 {
        return Ok(());
    }
    let default_pw = std::env::var("ADMIN_DEFAULT_PASSWORD")
        .ok()
        .filter(|v| !v.is_empty())
        .ok_or_else(|| {
            tracing::error!("No users exist and ADMIN_DEFAULT_PASSWORD is not set. Cannot create default admin.");
            AppError::Internal("ADMIN_DEFAULT_PASSWORD must be set to seed the initial admin user".to_string())
        })?;
    let hash = tokio::task::spawn_blocking(move || bcrypt::hash(&default_pw, 12))
        .await
        .map_err(|e| AppError::Internal(format!("spawn_blocking failed: {}", e)))?
        .map_err(|e| AppError::BadRequest(format!("bcrypt hash failed: {}", e)))?;
    let id = uuid::Uuid::new_v4().to_string();
    let default_prefs = r#"{"theme":"system","lang":"zh","notifications":{"email":{"rule_changes":true,"security_alerts":true,"product_updates":true},"in_app":{"approvals":true,"product_updates":true,"infrastructure":true,"audit":true}}}"#;
    sqlx::query(
        "INSERT INTO users (id, username, password_hash, email, display_name, user_group, permission_template_id, preferences) VALUES (?, ?, ?, ?, ?, 'admin_group', (SELECT id FROM permission_templates WHERE name = 'super_admin' LIMIT 1), ?)"
    ).bind(&id).bind("admin").bind(&hash).bind("admin@example.com").bind("Administrator").bind(default_prefs)
    .execute(pool).await?;
    Ok(())
}

pub async fn seed_permission_templates(pool: &MySqlPool) -> Result<(), AppError> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM permission_templates").fetch_one(pool).await?;
    if count > 0 {
        return Ok(());
    }
    let templates: Vec<(&str, &str, &str)> = vec![
        (
            "super_admin",
            "超级管理员 — 拥有所有权限",
            r#"["rule:read","rule:write","rule:publish","transform:preview","transform:execute","apikey:read","apikey:write","ratelimit:read","ratelimit:write","approval:read","approval:review","metrics:read","audit:read","llm:route","llm:manage","products:read","products:write","circuit_breakers:read","circuit_breakers:write","protocols:read","protocols:write","classifications:read","classifications:write","plugins:read","plugins:write","openapi:read","validation:read","system:read","system:write","user:read","user:manage","user:self"]"#
        ),
        (
            "ops_admin",
            "运维人员 — 规则、限流、熔断、协议、插件、系统",
            r#"["rule:read","rule:write","rule:publish","transform:preview","transform:execute","apikey:read","ratelimit:read","ratelimit:write","approval:read","metrics:read","audit:read","products:read","circuit_breakers:read","circuit_breakers:write","protocols:read","protocols:write","plugins:read","plugins:write","validation:read","system:read","system:write","user:read","user:self"]"#
        ),
        (
            "security_auditor",
            "安全审计员 — 审计、分类、用户查看",
            r#"["rule:read","apikey:read","ratelimit:read","approval:read","metrics:read","audit:read","products:read","circuit_breakers:read","protocols:read","classifications:read","classifications:write","plugins:read","openapi:read","validation:read","system:read","user:read","user:self"]"#
        ),
        (
            "api_developer",
            "API开发者 — 规则编写、转换测试、OpenAPI",
            r#"["rule:read","rule:write","transform:preview","transform:execute","apikey:read","ratelimit:read","approval:read","llm:route","products:read","circuit_breakers:read","protocols:read","classifications:read","plugins:read","openapi:read","validation:read","user:read","user:self"]"#
        ),
        (
            "product_manager",
            "产品管理员 — 产品/订阅管理",
            r#"["rule:read","transform:preview","apikey:read","ratelimit:read","approval:read","metrics:read","audit:read","llm:route","products:read","products:write","circuit_breakers:read","protocols:read","classifications:read","plugins:read","openapi:read","validation:read","system:read","user:read","user:self"]"#
        ),
        (
            "portal_user",
            "Portal用户 — 订阅产品、查看用量",
            r#"["apikey:read","apikey:write","products:read","metrics:read","user:self"]"#
        ),
        (
            "viewer",
            "只读用户 — 查看全部配置",
            r#"["rule:read","transform:preview","apikey:read","ratelimit:read","approval:read","metrics:read","audit:read","llm:route","products:read","circuit_breakers:read","protocols:read","classifications:read","plugins:read","openapi:read","validation:read","system:read","user:read","user:self"]"#
        ),
    ];
    let mut tx = pool.begin().await?;
    for (name, desc, perms_json) in &templates {
        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO permission_templates (id, name, description, permissions, is_builtin) VALUES (?, ?, ?, ?, 1)"
        ).bind(&id).bind(name).bind(desc).bind(perms_json).execute(&mut *tx).await?;
    }
    tx.commit().await?;
    Ok(())
}
