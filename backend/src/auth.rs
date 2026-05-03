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
}

#[derive(Debug, Deserialize)]
pub struct JwtClaims {
    pub sub: String,
    pub role: String,
    #[serde(rename = "exp")]
    pub _exp: usize,
    #[serde(default)]
    pub tenant_id: Option<String>,
}

#[derive(Debug, Clone, Copy)]
pub enum Permission {
    RuleRead,
    RuleWrite,
    RulePublish,
    TransformUse,
    AuditRead,
    MetricsRead,
    UserManage,
    UserSelf,
}

impl Permission {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::RuleRead => "rule:read",
            Self::RuleWrite => "rule:write",
            Self::RulePublish => "rule:publish",
            Self::TransformUse => "transform:use",
            Self::AuditRead => "audit:read",
            Self::MetricsRead => "metrics:read",
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
                | Permission::TransformUse
                | Permission::AuditRead
                | Permission::MetricsRead
                | Permission::UserSelf
        ),
        Role::Editor => matches!(
            permission,
            Permission::RuleRead
                | Permission::RuleWrite
                | Permission::TransformUse
                | Permission::MetricsRead
                | Permission::UserSelf
        ),
        Role::Viewer => matches!(
            permission,
            Permission::RuleRead
                | Permission::TransformUse
                | Permission::MetricsRead
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
) -> Result<String, AppError> {
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
    encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| AppError::BadRequest(format!("token creation failed: {}", e)))
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
    if !state.auth.enabled {
        request.extensions_mut().insert(AuthContext {
            authenticated: false,
            subject: String::new(),
            role: Role::Admin,
            tenant_id: None,
        });
        return next.run(request).await;
    }

    let token = match extract_bearer_token(request.headers()) {
        Some(value) if !value.is_empty() => value,
        _ => {
            return AppError::Unauthorized("missing bearer token".to_string()).into_response();
        }
    };

    let secret = match state.auth.jwt_secret.as_ref() {
        Some(value) if !value.is_empty() => value,
        _ => {
            return AppError::Unauthorized("jwt secret is not configured".to_string())
                .into_response();
        }
    };

    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;

    let claims = match decode::<JwtClaims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    ) {
        Ok(token_data) => token_data.claims,
        Err(err) => {
            return AppError::Unauthorized(format!("invalid token: {}", err)).into_response();
        }
    };

    if claims.sub.trim().is_empty() {
        return AppError::Unauthorized("invalid token subject".to_string()).into_response();
    }

    let role = match Role::from_claim(&claims.role) {
        Some(value) => value,
        None => {
            return AppError::Unauthorized("invalid token role".to_string()).into_response();
        }
    };

    request.extensions_mut().insert(AuthContext {
        authenticated: true,
        subject: claims.sub,
        role,
        tenant_id: claims.tenant_id,
    });
    next.run(request).await
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
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, code) = match &self {
            AppError::BadRequest(_) => (StatusCode::BAD_REQUEST, "bad_request"),
            AppError::NotFound(_) => (StatusCode::NOT_FOUND, "not_found"),
            AppError::Unauthorized(_) => (StatusCode::UNAUTHORIZED, "unauthorized"),
            AppError::Forbidden(_) => (StatusCode::FORBIDDEN, "forbidden"),
            AppError::Db(_) | AppError::Redis(_) | AppError::Json(_) => {
                (StatusCode::INTERNAL_SERVER_ERROR, "internal_error")
            }
        };

        error!(error = %self, "request failed");
        (
            status,
            Json(json!({
                "error": code,
                "message": self.to_string()
            })),
        )
            .into_response()
    }
}
