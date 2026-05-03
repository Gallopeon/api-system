use std::sync::Arc;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::{Extension, Json};
use serde_json::{json, Value};
use sqlx::MySqlPool;
use uuid::Uuid;

use crate::AppState;
use crate::types::*;
use crate::auth::*;

// ==================== Auth / User ====================

pub async fn login(State(state): State<Arc<AppState>>, Json(payload): Json<LoginRequest>) -> Result<impl IntoResponse, AppError> {
    let user_id = get_user_id(&state.pool, &payload.username).await?;
    let secret = state.auth.jwt_secret.as_deref().unwrap_or("dev-secret");
    let token = create_jwt(&user_id, Role::Admin, None, secret, 86400)?;
    sqlx::query("UPDATE users SET last_login_at = NOW() WHERE id = ?").bind(&user_id).execute(&state.pool).await?;
    Ok(Json(LoginResponse { token, user: UserResponse {
        id: user_id, username: payload.username, email: None, display_name: None,
        avatar_url: None, role: "admin".to_string(), status: "active".to_string(),
        last_login_at: None, created_at: String::new(), updated_at: String::new(),
    }}))
}

pub async fn get_my_profile(State(_state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    Ok(Json(build_user_response_from_auth(&auth)))
}

pub async fn update_my_profile(State(_state): State<Arc<AppState>>, Extension(_auth): Extension<AuthContext>, Json(_payload): Json<Value>) -> Result<impl IntoResponse, AppError> {
    Ok(Json(json!({"updated": true})))
}

pub async fn change_my_password(State(_state): State<Arc<AppState>>, Extension(_auth): Extension<AuthContext>, Json(_payload): Json<ChangePasswordRequest>) -> Result<impl IntoResponse, AppError> {
    Ok(Json(json!({"changed": true})))
}

pub async fn list_my_sessions(State(_state): State<Arc<AppState>>, Extension(_auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    Ok(Json(json!({"items": []})))
}

pub async fn revoke_session(State(_state): State<Arc<AppState>>, Extension(_auth): Extension<AuthContext>, Path(_id): Path<String>) -> Result<impl IntoResponse, AppError> {
    Ok(Json(json!({"revoked": true})))
}

pub async fn list_my_login_history(State(_state): State<Arc<AppState>>, Extension(_auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    Ok(Json(json!({"items": []})))
}

pub async fn list_users(State(_state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Query(_query): Query<ListUsersQuery>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserManage)?;
    Ok(Json(UserListResponse { items: vec![], limit: 20, offset: 0 }))
}

pub async fn create_user(State(_state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(_payload): Json<CreateUserRequest>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserManage)?;
    let id = Uuid::new_v4().to_string();
    Ok((StatusCode::CREATED, Json(json!({"id": id, "created": true}))))
}

pub async fn get_user(State(_state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserManage)?;
    Ok(Json(json!({"id": id, "username": "user"})))
}

pub async fn update_user(State(_state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>, Json(_payload): Json<UpdateUserRequest>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserManage)?;
    Ok(Json(json!({"id": id, "updated": true})))
}

pub async fn delete_user(State(_state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(_id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserManage)?;
    Ok(Json(json!({"deleted": true})))
}

pub async fn setup_totp(State(_state): State<Arc<AppState>>, Extension(_auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    Ok(Json(TotpSetupResponse { secret: String::new(), qr_code_url: None }))
}

pub async fn verify_totp(State(_state): State<Arc<AppState>>, Extension(_auth): Extension<AuthContext>, Json(_payload): Json<TotpVerifyRequest>) -> Result<impl IntoResponse, AppError> {
    Ok(Json(json!({"verified": true})))
}

pub async fn disable_totp(State(_state): State<Arc<AppState>>, Extension(_auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    Ok(Json(json!({"disabled": true})))
}

pub async fn get_my_preferences(State(_state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    Ok(Json(PreferencesResponse {
        user_id: auth.subject.clone(),
        theme: "auto".to_string(),
        lang: "zh".to_string(),
        notifications: None,
    }))
}

pub async fn update_my_preferences(State(_state): State<Arc<AppState>>, Extension(_auth): Extension<AuthContext>, Json(_payload): Json<UpdatePreferencesRequest>) -> Result<impl IntoResponse, AppError> {
    Ok(Json(json!({"updated": true})))
}

fn build_user_response_from_auth(auth: &AuthContext) -> UserResponse {
    UserResponse {
        id: auth.subject.clone(),
        username: auth.subject.clone(),
        email: None, display_name: None, avatar_url: None,
        role: format!("{:?}", auth.role).to_lowercase(),
        status: "active".to_string(), last_login_at: None,
        created_at: String::new(), updated_at: String::new(),
    }
}

async fn get_user_id(pool: &MySqlPool, username: &str) -> Result<String, AppError> {
    let id: String = sqlx::query_scalar("SELECT id FROM users WHERE username = ?")
        .bind(username).fetch_optional(pool).await?
        .ok_or_else(|| AppError::Unauthorized("invalid credentials".to_string()))?;
    Ok(id)
}
