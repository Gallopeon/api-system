use std::sync::Arc;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::{Extension, Json};
use chrono::{DateTime, Utc};
use serde_json::{json, Value};
use sqlx::Row;
use uuid::Uuid;

use crate::AppState;
use crate::types::*;
use crate::auth::*;

// ==================== Auth / User ====================

pub async fn login(State(state): State<Arc<AppState>>, Json(payload): Json<LoginRequest>) -> Result<impl IntoResponse, AppError> {
    let row = sqlx::query(
        "SELECT id, username, password_hash, email, display_name, avatar_url, role, status, last_login_at, created_at, updated_at FROM users WHERE username = ?"
    ).bind(&payload.username).fetch_optional(&state.pool).await?
    .ok_or_else(|| AppError::Unauthorized("invalid credentials".to_string()))?;

    let password_hash: String = row.try_get("password_hash").unwrap_or_default();
    let ok = bcrypt::verify(&payload.password, &password_hash).unwrap_or(false);
    if !ok {
        return Err(AppError::Unauthorized("invalid credentials".to_string()));
    }

    let user_id: String = row.try_get("id").unwrap_or_default();
    let role_str: String = row.try_get("role").unwrap_or_else(|_| "viewer".to_string());
    let role = parse_role(&role_str);

    let secret = state.auth.jwt_secret.as_deref().unwrap_or("dev-secret");
    let token = create_jwt(&user_id, role, None, secret, 86400)?;

    sqlx::query("UPDATE users SET last_login_at = NOW() WHERE id = ?").bind(&user_id).execute(&state.pool).await?;

    Ok(Json(LoginResponse { token, user: row_to_user(&row) }))
}

pub async fn get_my_profile(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    let row = sqlx::query(
        "SELECT id, username, password_hash, email, display_name, avatar_url, role, status, last_login_at, created_at, updated_at FROM users WHERE id = ?"
    ).bind(&auth.subject).fetch_optional(&state.pool).await?
    .ok_or_else(|| AppError::NotFound("user not found".to_string()))?;
    Ok(Json(row_to_user(&row)))
}

pub async fn update_my_profile(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<Value>) -> Result<impl IntoResponse, AppError> {
    if let Some(display_name) = payload.get("display_name").and_then(|v| v.as_str()) {
        sqlx::query("UPDATE users SET display_name = ? WHERE id = ?").bind(display_name).bind(&auth.subject).execute(&state.pool).await?;
    }
    if let Some(email) = payload.get("email").and_then(|v| v.as_str()) {
        sqlx::query("UPDATE users SET email = ? WHERE id = ?").bind(email).bind(&auth.subject).execute(&state.pool).await?;
    }
    if let Some(avatar_url) = payload.get("avatar_url").and_then(|v| v.as_str()) {
        sqlx::query("UPDATE users SET avatar_url = ? WHERE id = ?").bind(avatar_url).bind(&auth.subject).execute(&state.pool).await?;
    }
    Ok(Json(json!({"updated": true})))
}

pub async fn change_my_password(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<ChangePasswordRequest>) -> Result<impl IntoResponse, AppError> {
    let current_hash: String = sqlx::query_scalar("SELECT password_hash FROM users WHERE id = ?")
        .bind(&auth.subject).fetch_optional(&state.pool).await?
        .ok_or_else(|| AppError::NotFound("user not found".to_string()))?;
    let ok = bcrypt::verify(&payload.current_password, &current_hash).unwrap_or(false);
    if !ok {
        return Err(AppError::Unauthorized("current password is incorrect".to_string()));
    }
    let new_hash = bcrypt::hash(&payload.new_password, 12).map_err(|e| AppError::BadRequest(format!("bcrypt: {}", e)))?;
    sqlx::query("UPDATE users SET password_hash = ? WHERE id = ?").bind(&new_hash).bind(&auth.subject).execute(&state.pool).await?;
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

pub async fn list_users(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Query(query): Query<ListUsersQuery>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserManage)?;
    let limit = query.limit.unwrap_or(20).clamp(1, 100);
    let offset = query.offset.unwrap_or(0);
    let rows = sqlx::query(
        "SELECT id, username, password_hash, email, display_name, avatar_url, role, status, last_login_at, created_at, updated_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?"
    ).bind(limit).bind(offset).fetch_all(&state.pool).await?;
    let items: Vec<UserResponse> = rows.iter().map(|r| row_to_user(r)).collect();
    Ok(Json(UserListResponse { items, limit, offset }))
}

pub async fn create_user(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<CreateUserRequest>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserManage)?;
    let id = Uuid::new_v4().to_string();
    let hash = bcrypt::hash(&payload.password, 12).map_err(|e| AppError::BadRequest(format!("bcrypt: {}", e)))?;
    sqlx::query(
        "INSERT INTO users (id, username, password_hash, email, display_name, role) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(&id).bind(&payload.username).bind(&hash)
     .bind(&payload.email).bind(&payload.display_name).bind(payload.role.as_deref().unwrap_or("viewer"))
     .execute(&state.pool).await?;
    Ok((StatusCode::CREATED, Json(json!({"id": id, "created": true}))))
}

pub async fn get_user(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserManage)?;
    let row = sqlx::query(
        "SELECT id, username, password_hash, email, display_name, avatar_url, role, status, last_login_at, created_at, updated_at FROM users WHERE id = ?"
    ).bind(&id).fetch_optional(&state.pool).await?
    .ok_or_else(|| AppError::NotFound(format!("user {} not found", id)))?;
    Ok(Json(row_to_user(&row)))
}

pub async fn update_user(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>, Json(payload): Json<UpdateUserRequest>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserManage)?;
    if let Some(ref role) = payload.role {
        sqlx::query("UPDATE users SET role = ? WHERE id = ?").bind(role).bind(&id).execute(&state.pool).await?;
    }
    if let Some(ref status) = payload.status {
        sqlx::query("UPDATE users SET status = ? WHERE id = ?").bind(status).bind(&id).execute(&state.pool).await?;
    }
    if let Some(ref display_name) = payload.display_name {
        sqlx::query("UPDATE users SET display_name = ? WHERE id = ?").bind(display_name).bind(&id).execute(&state.pool).await?;
    }
    if let Some(ref email) = payload.email {
        sqlx::query("UPDATE users SET email = ? WHERE id = ?").bind(email).bind(&id).execute(&state.pool).await?;
    }
    Ok(Json(json!({"id": id, "updated": true})))
}

pub async fn delete_user(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Path(id): Path<String>) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::UserManage)?;
    let username: String = sqlx::query_scalar("SELECT username FROM users WHERE id = ?")
        .bind(&id).fetch_optional(&state.pool).await?
        .ok_or_else(|| AppError::NotFound(format!("user {} not found", id)))?;
    if username == "admin" {
        return Err(AppError::Forbidden("cannot delete the built-in admin user".to_string()));
    }
    sqlx::query("DELETE FROM users WHERE id = ?").bind(&id).execute(&state.pool).await?;
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

pub async fn get_my_preferences(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>) -> Result<impl IntoResponse, AppError> {
    let prefs: Option<String> = sqlx::query_scalar("SELECT preferences FROM users WHERE id = ?")
        .bind(&auth.subject).fetch_optional(&state.pool).await?
        .and_then(|v: Option<String>| v);
    Ok(Json(PreferencesResponse {
        user_id: auth.subject.clone(),
        theme: "auto".to_string(),
        lang: "zh".to_string(),
        notifications: prefs.and_then(|p| serde_json::from_str(&p).ok()),
    }))
}

pub async fn update_my_preferences(State(state): State<Arc<AppState>>, Extension(auth): Extension<AuthContext>, Json(payload): Json<UpdatePreferencesRequest>) -> Result<impl IntoResponse, AppError> {
    let prefs_json = serde_json::to_string(&payload).unwrap_or_default();
    sqlx::query("UPDATE users SET preferences = ? WHERE id = ?").bind(&prefs_json).bind(&auth.subject).execute(&state.pool).await?;
    Ok(Json(json!({"updated": true})))
}

// ==================== Helpers ====================

fn row_to_user(row: &sqlx::mysql::MySqlRow) -> UserResponse {
    let created_at: DateTime<Utc> = row.try_get("created_at").unwrap_or(DateTime::UNIX_EPOCH);
    let updated_at: DateTime<Utc> = row.try_get("updated_at").unwrap_or(DateTime::UNIX_EPOCH);
    let last_login: Option<DateTime<Utc>> = row.try_get("last_login_at").ok();
    UserResponse {
        id: row.try_get("id").unwrap_or_default(),
        username: row.try_get("username").unwrap_or_default(),
        email: row.try_get("email").ok(),
        display_name: row.try_get("display_name").ok(),
        avatar_url: row.try_get("avatar_url").ok(),
        role: row.try_get::<String, _>("role").unwrap_or_else(|_| "viewer".to_string()),
        status: row.try_get("status").unwrap_or_else(|_| "active".to_string()),
        last_login_at: last_login.map(|d| d.to_rfc3339()),
        created_at: created_at.to_rfc3339(),
        updated_at: updated_at.to_rfc3339(),
    }
}

fn parse_role(s: &str) -> Role {
    match s.to_lowercase().as_str() {
        "admin" => Role::Admin,
        "reviewer" => Role::Reviewer,
        "editor" => Role::Editor,
        _ => Role::Viewer,
    }
}
