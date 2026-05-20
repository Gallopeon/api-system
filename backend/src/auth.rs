use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use axum::extract::{Request, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use axum::Json;
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::Deserialize;
use serde_json::json;
use thiserror::Error;
use tracing::error;
use uuid::Uuid;

use crate::AppState;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Role {
    Admin,
    Reviewer,
    Editor,
    Viewer,
}

impl Role {
    pub fn from_claim(raw: &str) -> Option<Self> {
        match raw.trim().to_ascii_lowercase().as_str() {
            "admin" => Some(Self::Admin),
            "reviewer" => Some(Self::Reviewer),
            "editor" => Some(Self::Editor),
            "viewer" => Some(Self::Viewer),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Admin => "admin",
            Self::Reviewer => "reviewer",
            Self::Editor => "editor",
            Self::Viewer => "viewer",
        }
    }
}

#[derive(Debug, Clone)]
pub struct AuthContext {
    pub authenticated: bool,
    pub subject: String,
    pub role: Role,
    pub tenant_id: Option<String>,
    pub jti: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct JwtClaims {
    pub sub: String,
    pub role: String,
    #[serde(rename = "exp")]
    pub _exp: usize,
    #[serde(default)]
    pub tenant_id: Option<String>,
    #[serde(default)]
    pub jti: Option<String>,
}

#[derive(Debug, Clone, Copy)]
pub enum Permission {
    // Rules & Versions
    RuleRead,
    RuleWrite,
    RulePublish,
    // Transform & Playground
    TransformPreview,
    TransformExecute,
    // API Keys
    ApiKeyRead,
    ApiKeyWrite,
    // Rate Limits
    RateLimitRead,
    RateLimitWrite,
    // Approvals
    ApprovalRead,
    ApprovalReview,
    // Metrics
    MetricsRead,
    // Audit
    AuditRead,
    // LLM Gateway
    LlmRoute,
    LlmManage,
    // Products & Subscriptions
    ProductsRead,
    ProductsWrite,
    // Circuit Breakers
    CircuitBreakersRead,
    CircuitBreakersWrite,
    // Protocols
    ProtocolsRead,
    ProtocolsWrite,
    // Data Classifications
    ClassificationsRead,
    ClassificationsWrite,
    // Plugins
    PluginsRead,
    PluginsWrite,
    // OpenAPI
    OpenApiRead,
    // Validation
    ValidationRead,
    // System
    SystemRead,
    SystemWrite,
    // Users
    UserRead,
    UserManage,
    UserSelf,
}

impl Permission {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::RuleRead => "rule:read",
            Self::RuleWrite => "rule:write",
            Self::RulePublish => "rule:publish",
            Self::TransformPreview => "transform:preview",
            Self::TransformExecute => "transform:execute",
            Self::ApiKeyRead => "apikey:read",
            Self::ApiKeyWrite => "apikey:write",
            Self::RateLimitRead => "ratelimit:read",
            Self::RateLimitWrite => "ratelimit:write",
            Self::ApprovalRead => "approval:read",
            Self::ApprovalReview => "approval:review",
            Self::MetricsRead => "metrics:read",
            Self::AuditRead => "audit:read",
            Self::LlmRoute => "llm:route",
            Self::LlmManage => "llm:manage",
            Self::ProductsRead => "products:read",
            Self::ProductsWrite => "products:write",
            Self::CircuitBreakersRead => "circuit_breakers:read",
            Self::CircuitBreakersWrite => "circuit_breakers:write",
            Self::ProtocolsRead => "protocols:read",
            Self::ProtocolsWrite => "protocols:write",
            Self::ClassificationsRead => "classifications:read",
            Self::ClassificationsWrite => "classifications:write",
            Self::PluginsRead => "plugins:read",
            Self::PluginsWrite => "plugins:write",
            Self::OpenApiRead => "openapi:read",
            Self::ValidationRead => "validation:read",
            Self::SystemRead => "system:read",
            Self::SystemWrite => "system:write",
            Self::UserRead => "user:read",
            Self::UserManage => "user:manage",
            Self::UserSelf => "user:self",
        }
    }
}

pub fn role_has_permission(role: Role, permission: Permission) -> bool {
    match role {
        Role::Admin => true,
        Role::Reviewer => matches!(
            permission,
            Permission::RuleRead
                | Permission::RulePublish
                | Permission::TransformPreview
                | Permission::TransformExecute
                | Permission::ApiKeyRead
                | Permission::RateLimitRead
                | Permission::ApprovalRead
                | Permission::ApprovalReview
                | Permission::MetricsRead
                | Permission::AuditRead
                | Permission::LlmRoute
                | Permission::ProductsRead
                | Permission::CircuitBreakersRead
                | Permission::ProtocolsRead
                | Permission::ClassificationsRead
                | Permission::PluginsRead
                | Permission::OpenApiRead
                | Permission::ValidationRead
                | Permission::SystemRead
                | Permission::UserRead
                | Permission::UserSelf
        ),
        Role::Editor => matches!(
            permission,
            Permission::RuleRead
                | Permission::RuleWrite
                | Permission::TransformPreview
                | Permission::TransformExecute
                | Permission::ApiKeyRead
                | Permission::ApiKeyWrite
                | Permission::RateLimitRead
                | Permission::RateLimitWrite
                | Permission::ApprovalRead
                | Permission::MetricsRead
                | Permission::AuditRead
                | Permission::LlmRoute
                | Permission::LlmManage
                | Permission::ProductsRead
                | Permission::CircuitBreakersRead
                | Permission::CircuitBreakersWrite
                | Permission::ProtocolsRead
                | Permission::ProtocolsWrite
                | Permission::ClassificationsRead
                | Permission::ClassificationsWrite
                | Permission::PluginsRead
                | Permission::PluginsWrite
                | Permission::OpenApiRead
                | Permission::ValidationRead
                | Permission::SystemRead
                | Permission::UserRead
                | Permission::UserSelf
        ),
        Role::Viewer => matches!(
            permission,
            Permission::RuleRead
                | Permission::TransformPreview
                | Permission::ApiKeyRead
                | Permission::RateLimitRead
                | Permission::ApprovalRead
                | Permission::MetricsRead
                | Permission::AuditRead
                | Permission::LlmRoute
                | Permission::ProductsRead
                | Permission::CircuitBreakersRead
                | Permission::ProtocolsRead
                | Permission::ClassificationsRead
                | Permission::PluginsRead
                | Permission::OpenApiRead
                | Permission::ValidationRead
                | Permission::SystemRead
                | Permission::UserRead
                | Permission::UserSelf
        ),
    }
}

pub fn ensure_permission(auth: &AuthContext, permission: Permission) -> Result<(), AppError> {
    if role_has_permission(auth.role, permission) {
        Ok(())
    } else {
        Err(AppError::Forbidden(format!(
            "role {} cannot {}",
            auth.role.as_str(),
            permission.as_str()
        )))
    }
}

pub fn is_admin(auth: &AuthContext) -> bool {
    matches!(auth.role, Role::Admin)
}

pub fn resolve_actor(auth: &AuthContext, fallback_actor: Option<&str>) -> String {
    if auth.authenticated {
        auth.subject.clone()
    } else {
        fallback_actor.unwrap_or("panel").to_string()
    }
}

pub fn create_jwt(
    sub: &str,
    role: Role,
    tenant_id: Option<&str>,
    secret: &str,
    ttl_seconds: i64,
) -> Result<(String, String), AppError> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| AppError::BadRequest("system clock error".to_string()))?
        .as_secs() as usize;
    let jti = Uuid::new_v4().to_string();
    let claims = json!({
        "sub": sub,
        "role": role.as_str(),
        "exp": now + ttl_seconds as usize,
        "iat": now,
        "jti": jti,
        "tenant_id": tenant_id,
    });
    let token = encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| AppError::BadRequest(format!("token creation failed: {}", e)))?;
    Ok((token, jti))
}

pub fn validate_password_strength(password: &str) -> Result<(), AppError> {
    if password.len() < 8 {
        return Err(AppError::BadRequest(
            "password must be at least 8 characters".to_string(),
        ));
    }
    if !password.chars().any(|c| c.is_uppercase()) {
        return Err(AppError::BadRequest(
            "password must contain an uppercase letter".to_string(),
        ));
    }
    if !password.chars().any(|c| c.is_lowercase()) {
        return Err(AppError::BadRequest(
            "password must contain a lowercase letter".to_string(),
        ));
    }
    if !password.chars().any(|c| c.is_ascii_digit()) {
        return Err(AppError::BadRequest(
            "password must contain a digit".to_string(),
        ));
    }
    Ok(())
}

pub fn extract_bearer_token(headers: &HeaderMap) -> Option<&str> {
    let raw = headers.get(header::AUTHORIZATION)?.to_str().ok()?;
    if let Some(token) = raw.strip_prefix("Bearer ") {
        return Some(token.trim());
    }
    if let Some(token) = raw.strip_prefix("bearer ") {
        return Some(token.trim());
    }
    None
}

pub async fn auth_middleware(
    State(state): State<Arc<AppState>>,
    mut request: Request,
    next: Next,
) -> Response {
    match try_authenticate(&state, request.headers()).await {
        Some(ctx) => {
            request.extensions_mut().insert(ctx);
            next.run(request).await
        }
        None => AppError::Unauthorized("missing or invalid bearer token".to_string()).into_response(),
    }
}

async fn try_authenticate(state: &AppState, headers: &HeaderMap) -> Option<AuthContext> {
    let token = extract_bearer_token(headers).filter(|t| !t.is_empty())?;
    let secret = &state.auth.jwt_secret;

    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;

    let token_data = decode::<JwtClaims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )
    .ok()?;

    let claims = token_data.claims;

    if claims.sub.trim().is_empty() {
        return None;
    }

    // Check JTI revocation via Redis bloom-filter (fast, no DB roundtrip)
    if let Some(ref jti) = claims.jti {
        if let Ok(mut conn) = state.redis.get_multiplexed_async_connection().await {
            let revoked: Option<String> = redis::cmd("GET")
                .arg(format!("jti:revoked:{}", jti))
                .query_async(&mut conn)
                .await
                .ok()
                .flatten();
            if revoked.is_some() {
                tracing::warn!(jti, subject = %claims.sub, "rejected revoked JTI");
                return None;
            }
        }
        // If Redis is unreachable, allow the request (availability over strict revocation)
    }

    let role = Role::from_claim(&claims.role)?;

    Some(AuthContext {
        authenticated: true,
        subject: claims.sub,
        role,
        tenant_id: claims.tenant_id,
        jti: claims.jti,
    })
}

#[derive(Debug, Error)]
pub enum AppError {
    #[error("db error: {0}")]
    Db(#[from] sqlx::Error),
    #[error("redis error: {0}")]
    Redis(#[from] redis::RedisError),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("bad request: {0}")]
    BadRequest(String),
    #[error("not found: {0}")]
    NotFound(String),
    #[error("unauthorized: {0}")]
    Unauthorized(String),
    #[error("forbidden: {0}")]
    Forbidden(String),
    #[error("conflict: {0}")]
    Conflict(String),
    #[error("internal error: {0}")]
    Internal(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, code, message) = match &self {
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, "bad_request", msg.clone()),
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, "not_found", msg.clone()),
            AppError::Unauthorized(msg) => (StatusCode::UNAUTHORIZED, "unauthorized", msg.clone()),
            AppError::Forbidden(msg) => (StatusCode::FORBIDDEN, "forbidden", msg.clone()),
            AppError::Conflict(msg) => (StatusCode::CONFLICT, "conflict", msg.clone()),
            AppError::Internal(msg) => {
                error!(error = %msg, "internal error");
                (StatusCode::INTERNAL_SERVER_ERROR, "internal_error", "internal server error".to_string())
            }
            AppError::Db(e) => {
                error!(error = %e, "database error");
                (StatusCode::INTERNAL_SERVER_ERROR, "internal_error", "internal server error".to_string())
            }
            AppError::Redis(e) => {
                error!(error = %e, "redis error");
                (StatusCode::INTERNAL_SERVER_ERROR, "internal_error", "internal server error".to_string())
            }
            AppError::Json(e) => {
                error!(error = %e, "json error");
                (StatusCode::INTERNAL_SERVER_ERROR, "internal_error", "internal server error".to_string())
            }
        };

        (
            status,
            Json(json!({
                "error": code,
                "message": message
            })),
        )
            .into_response()
    }
}
