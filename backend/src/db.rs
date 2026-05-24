use sqlx::MySqlPool;

use crate::auth::AppError;

pub async fn bootstrap_schema(pool: &MySqlPool) -> Result<(), AppError> {
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

    let has_detail: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_logs' AND COLUMN_NAME = 'detail'"
    ).fetch_one(pool).await.unwrap_or(0);
    if has_detail == 0 {
        sqlx::query("ALTER TABLE audit_logs ADD COLUMN detail LONGTEXT NULL")
            .execute(pool).await?;
    }

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

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS metrics_hourly_summary (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        hour_bucket DATETIME NOT NULL,
        api_path VARCHAR(255) NOT NULL,
        method VARCHAR(10) NOT NULL DEFAULT 'GET',
        status_code INT NOT NULL DEFAULT 200,
        request_count BIGINT NOT NULL DEFAULT 0,
        avg_latency_ms DOUBLE NOT NULL DEFAULT 0,
        p95_latency_ms INT NOT NULL DEFAULT 0,
        p99_latency_ms INT NOT NULL DEFAULT 0,
        error_count BIGINT NOT NULL DEFAULT 0,
        UNIQUE KEY uq_hourly (hour_bucket, api_path, method, status_code),
        KEY idx_hourly_bucket (hour_bucket)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS approvals (
        id VARCHAR(36) PRIMARY KEY, rule_id VARCHAR(36) NOT NULL, version INT NOT NULL,
        requestor VARCHAR(64) NOT NULL, reviewer VARCHAR(64) NULL, status VARCHAR(32) NOT NULL DEFAULT 'pending',
        comment TEXT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TIMESTAMP NULL,
        KEY idx_approval_rule (rule_id), KEY idx_approval_status (status), KEY idx_approval_requestor (requestor),
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
        tags JSON NULL, documentation_url VARCHAR(512) NULL,
        pricing_tiers JSON NULL, owner VARCHAR(64) NOT NULL DEFAULT 'admin',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    // Migrate existing api_products table: add missing columns (idempotent)
    for (col, def) in &[
        ("tags", "JSON NULL"),
        ("documentation_url", "VARCHAR(512) NULL"),
        ("pricing_tiers", "JSON NULL"),
        ("owner", "VARCHAR(64) NOT NULL DEFAULT 'admin'"),
        ("updated_at", "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
    ] {
        let has_col: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'api_products' AND COLUMN_NAME = ?"
        ).bind(col).fetch_one(pool).await.unwrap_or(0);
        if has_col == 0 {
            let stmt = format!("ALTER TABLE api_products ADD COLUMN {} {}", col, def);
            sqlx::query(&stmt).execute(pool).await?;
        }
    }

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS subscriptions (
        id VARCHAR(36) PRIMARY KEY, api_key_id VARCHAR(36) NOT NULL, product_id VARCHAR(36) NOT NULL,
        plan VARCHAR(32) NOT NULL DEFAULT 'free', rate_limit_rps INT NULL, quota_daily INT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'active', expires_at TIMESTAMP NULL,
        user_id VARCHAR(64) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_sub_key (api_key_id), KEY idx_sub_product (product_id), KEY idx_sub_user (user_id)
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
        description VARCHAR(500) NULL, config_json LONGTEXT NULL, status VARCHAR(32) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_proto (protocol)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    // Add description column if missing (migration from older schema)
    let has_desc: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'protocol_configs' AND COLUMN_NAME = 'description'"
    ).fetch_one(pool).await.unwrap_or(0);
    if has_desc == 0 {
        sqlx::query("ALTER TABLE protocol_configs ADD COLUMN description VARCHAR(500) NULL AFTER protocol")
            .execute(pool).await?;
    }

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS data_classifications (
        id VARCHAR(36) PRIMARY KEY, api_path VARCHAR(255) NOT NULL UNIQUE,
        data_category VARCHAR(64) NOT NULL DEFAULT 'internal', description VARCHAR(500) NULL,
        contains_pii TINYINT(1) NOT NULL DEFAULT 0, gdpr_relevant TINYINT(1) NOT NULL DEFAULT 0,
        retention_days INT NOT NULL DEFAULT 365, notes TEXT NULL, classified_by VARCHAR(64) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_class_category (data_category)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    // Migration: add description column if missing
    let has_cdesc: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'data_classifications' AND COLUMN_NAME = 'description'"
    ).fetch_one(pool).await.unwrap_or(0);
    if has_cdesc == 0 {
        sqlx::query("ALTER TABLE data_classifications ADD COLUMN description VARCHAR(500) NULL AFTER data_category")
            .execute(pool).await?;
    }
    // Migration: add target_table column if missing
    let has_tt: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'data_classifications' AND COLUMN_NAME = 'target_table'"
    ).fetch_one(pool).await.unwrap_or(0);
    if has_tt == 0 {
        sqlx::query("ALTER TABLE data_classifications ADD COLUMN target_table VARCHAR(64) NULL AFTER retention_days")
            .execute(pool).await?;
    }

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS plugin_configs (
        id VARCHAR(36) PRIMARY KEY, name VARCHAR(120) NOT NULL, plugin_type VARCHAR(64) NOT NULL,
        hook_point VARCHAR(64) NOT NULL, config_json LONGTEXT NULL, priority INT NOT NULL DEFAULT 100,
        status VARCHAR(32) NOT NULL DEFAULT 'active', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_plugin_hook (hook_point), KEY idx_plugin_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    // Permission templates
    sqlx::query(r#"CREATE TABLE IF NOT EXISTS permission_templates (
        id VARCHAR(36) PRIMARY KEY, name VARCHAR(64) NOT NULL UNIQUE,
        description VARCHAR(255) NULL, permissions JSON NOT NULL,
        is_builtin TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_pt_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    // User management tables
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

    // Migrate users table: add permission_template_id, custom_permissions, user_group
    for (col, def) in &[
        ("permission_template_id", "VARCHAR(36) NULL"),
        ("custom_permissions", "JSON NULL"),
        ("user_group", "VARCHAR(32) NOT NULL DEFAULT 'admin_group'"),
    ] {
        let has_col: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = ?"
        ).bind(col).fetch_one(pool).await.unwrap_or(0);
        if has_col == 0 {
            let stmt = format!("ALTER TABLE users ADD COLUMN {} {}", col, def);
            sqlx::query(&stmt).execute(pool).await?;
        }
    }

    // User devices for zero-trust
    sqlx::query(r#"CREATE TABLE IF NOT EXISTS user_devices (
        id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL,
        fingerprint_hash VARCHAR(64) NOT NULL, device_name VARCHAR(128) NULL,
        user_agent_hash VARCHAR(64) NULL, last_ip VARCHAR(45) NULL,
        trust_level VARCHAR(32) NOT NULL DEFAULT 'unknown',
        is_trusted TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_dev_user (user_id), KEY idx_dev_fp (fingerprint_hash),
        UNIQUE KEY uq_dev_user_fp (user_id, fingerprint_hash),
        CONSTRAINT fk_dev_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    // Migrate user_devices: add is_trusted if missing
    {
        let has: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_devices' AND COLUMN_NAME = 'is_trusted'"
        ).fetch_one(pool).await.unwrap_or(0);
        if has == 0 {
            sqlx::query("ALTER TABLE user_devices ADD COLUMN is_trusted TINYINT(1) NOT NULL DEFAULT 0")
                .execute(pool).await?;
        }
    }

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
        KEY idx_login_user (user_id), KEY idx_login_created (created_at), KEY idx_login_attempt (username_attempt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    // Migrate login_history for zero-trust
    for (col, def) in &[
        ("device_fingerprint", "VARCHAR(64) NULL"),
        ("risk_score", "INT NOT NULL DEFAULT 0"),
        ("is_suspicious", "TINYINT(1) NOT NULL DEFAULT 0"),
        ("location_hint", "VARCHAR(128) NULL"),
    ] {
        let has_col: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'login_history' AND COLUMN_NAME = ?"
        ).bind(col).fetch_one(pool).await.unwrap_or(0);
        if has_col == 0 {
            let stmt = format!("ALTER TABLE login_history ADD COLUMN {} {}", col, def);
            sqlx::query(&stmt).execute(pool).await?;
        }
    }

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS user_totp (
        user_id VARCHAR(36) PRIMARY KEY, secret VARCHAR(128) NOT NULL,
        enabled TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_totp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    let has_prefs: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'preferences'"
    ).fetch_one(pool).await.unwrap_or(0);
    if has_prefs == 0 {
        sqlx::query("ALTER TABLE users ADD COLUMN preferences JSON NULL")
            .execute(pool).await?;
    }

    // Add missing indexes for existing tables (idempotent via IF NOT EXISTS-style checks)
    let has_approval_requestor_idx: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'approvals' AND INDEX_NAME = 'idx_approval_requestor'"
    ).fetch_one(pool).await.unwrap_or(0);
    if has_approval_requestor_idx == 0 {
        sqlx::query("ALTER TABLE approvals ADD INDEX idx_approval_requestor (requestor)")
            .execute(pool).await?;
    }

    let has_login_attempt_idx: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'login_history' AND INDEX_NAME = 'idx_login_attempt'"
    ).fetch_one(pool).await.unwrap_or(0);
    if has_login_attempt_idx == 0 {
        sqlx::query("ALTER TABLE login_history ADD INDEX idx_login_attempt (username_attempt)")
            .execute(pool).await?;
    }

    let has_llm_provider_idx: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'llm_usage_logs' AND INDEX_NAME = 'idx_llm_provider'"
    ).fetch_one(pool).await.unwrap_or(0);
    if has_llm_provider_idx == 0 {
        sqlx::query("ALTER TABLE llm_usage_logs ADD INDEX idx_llm_provider (provider_id)")
            .execute(pool).await?;
    }

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS system_settings (
        setting_key VARCHAR(128) PRIMARY KEY, setting_value TEXT NOT NULL,
        description VARCHAR(255) NULL, editable TINYINT(1) NOT NULL DEFAULT 1,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    sqlx::query(r#"CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL,
        type VARCHAR(32) NOT NULL, channel VARCHAR(16) NOT NULL DEFAULT 'in_app',
        title VARCHAR(256) NOT NULL, message TEXT NOT NULL,
        `read` TINYINT(1) NOT NULL DEFAULT 0, email_sent TINYINT(1) NOT NULL DEFAULT 0,
        metadata JSON NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_notif_user (user_id), KEY idx_notif_read (user_id, `read`),
        CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"#).execute(pool).await?;

    seed_settings(pool).await?;
    seed_admin(pool).await?;
    seed_permission_templates(pool).await?;
    seed_plugins(pool).await?;
    seed_protocols(pool).await?;
    seed_classifications(pool).await?;

    Ok(())
}

async fn seed_plugins(pool: &MySqlPool) -> Result<(), AppError> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM plugin_configs").fetch_one(pool).await.unwrap_or(0);
    if count > 0 {
        return Ok(());
    }
    let defaults: Vec<(&str, &str, &str, &str, i32)> = vec![
        (
            "IP Blacklist",
            "lua",
            "pre_auth",
            r#"{"type":"ip_blacklist","ips":["10.0.0.1","192.168.1.100"],"action":"deny","message":"Access denied from your IP address","enabled":true}"#,
            10,
        ),
        (
            "Request Logger",
            "lua",
            "pre_transform",
            r#"{"type":"request_logger","log_headers":true,"log_body":false,"log_query_params":true,"log_format":"json","sample_rate":1.0,"enabled":true}"#,
            20,
        ),
        (
            "Security Headers Injector",
            "lua",
            "post_transform",
            r#"{"type":"response_headers","headers":{"X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY","X-XSS-Protection":"1; mode=block","Referrer-Policy":"strict-origin-when-cross-origin","Permissions-Policy":"camera=(), microphone=(), geolocation=()"},"remove_headers":["Server","X-Powered-By"],"enabled":true}"#,
            30,
        ),
        (
            "CORS Preflight Handler",
            "lua",
            "pre_auth",
            r#"{"type":"cors","allowed_origins":["http://localhost:3000"],"allowed_methods":["GET","POST","PUT","DELETE","PATCH","OPTIONS"],"allowed_headers":["Content-Type","Authorization","X-Request-ID"],"expose_headers":["X-Request-ID"],"max_age":86400,"allow_credentials":true,"enabled":true}"#,
            40,
        ),
        (
            "Rate Limit Guard",
            "lua",
            "pre_transform",
            r#"{"type":"rate_limit_guard","window_seconds":60,"max_requests":100,"burst":20,"per_ip":true,"per_api_key":true,"status_code":429,"message":"Too many requests, please try again later","enabled":true}"#,
            50,
        ),
    ];
    for (name, plugin_type, hook_point, config_json, priority) in &defaults {
        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO plugin_configs (id, name, plugin_type, hook_point, config_json, priority, status) VALUES (?, ?, ?, ?, ?, ?, 'active')"
        )
        .bind(&id).bind(name).bind(plugin_type).bind(hook_point).bind(config_json).bind(priority)
        .execute(pool).await?;
    }
    Ok(())
}

async fn seed_protocols(pool: &MySqlPool) -> Result<(), AppError> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM protocol_configs").fetch_one(pool).await.unwrap_or(0);
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
    for (api_path, protocol, description, config_json) in &defaults {
        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO protocol_configs (id, api_path, protocol, description, config_json, status) VALUES (?, ?, ?, ?, ?, 'active')"
        )
        .bind(&id).bind(api_path).bind(protocol).bind(description).bind(config_json)
        .execute(pool).await?;
    }
    Ok(())
}

async fn seed_classifications(pool: &MySqlPool) -> Result<(), AppError> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM data_classifications").fetch_one(pool).await.unwrap_or(0);
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
    for (api_path, data_category, description, contains_pii, gdpr_relevant, retention_days, target_table, notes) in &defaults {
        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO data_classifications (id, api_path, data_category, description, contains_pii, gdpr_relevant, retention_days, target_table, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&id).bind(api_path).bind(data_category).bind(description)
        .bind(contains_pii).bind(gdpr_relevant).bind(retention_days)
        .bind(target_table).bind(notes)
        .execute(pool).await?;
    }
    Ok(())
}

async fn seed_settings(pool: &MySqlPool) -> Result<(), AppError> {
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

async fn seed_admin(pool: &MySqlPool) -> Result<(), AppError> {
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
    let hash = bcrypt::hash(&default_pw, 12)
        .map_err(|e| AppError::BadRequest(format!("bcrypt hash failed: {}", e)))?;
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO users (id, username, password_hash, email, display_name, role) VALUES (?, ?, ?, ?, ?, 'admin')"
    ).bind(&id).bind("admin").bind(&hash).bind("admin@example.com").bind("Administrator")
    .execute(pool).await?;
    Ok(())
}

async fn seed_permission_templates(pool: &MySqlPool) -> Result<(), AppError> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM permission_templates").fetch_one(pool).await.unwrap_or(0);
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
    for (name, desc, perms_json) in &templates {
        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO permission_templates (id, name, description, permissions, is_builtin) VALUES (?, ?, ?, ?, 1)"
        ).bind(&id).bind(name).bind(desc).bind(perms_json).execute(pool).await?;
    }
    Ok(())
}
