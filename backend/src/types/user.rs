use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
    #[serde(default)]
    pub totp_code: Option<String>,
    #[serde(default)]
    pub device_fingerprint: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub user: UserResponse,
}

#[derive(Debug, Deserialize)]
pub struct CreateUserRequest {
    pub username: String,
    pub password: String,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub display_name: Option<String>,
    #[serde(default)]
    pub role: Option<String>,
    #[serde(default)]
    pub permission_template_id: Option<String>,
    #[serde(default)]
    pub custom_permissions: Option<Vec<String>>,
    #[serde(default)]
    pub user_group: Option<String>,
    #[serde(default)]
    pub actor: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateUserRequest {
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub display_name: Option<String>,
    #[serde(default)]
    pub avatar_url: Option<String>,
    #[serde(default)]
    pub role: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub permission_template_id: Option<String>,
    #[serde(default)]
    pub custom_permissions: Option<Vec<String>>,
    #[serde(default)]
    pub user_group: Option<String>,
    #[serde(default)]
    pub actor: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ChangePasswordRequest {
    pub current_password: String,
    pub new_password: String,
}

#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub id: String,
    pub username: String,
    pub email: Option<String>,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub role: String,
    pub status: String,
    pub permission_template_id: Option<String>,
    pub custom_permissions: Option<Vec<String>>,
    pub user_group: Option<String>,
    pub last_login_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
pub struct UserListResponse {
    pub items: Vec<UserResponse>,
    pub limit: u32,
    pub offset: u32,
}

#[derive(Debug, Deserialize)]
pub struct ListUsersQuery {
    #[serde(default)]
    pub role: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub search: Option<String>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub offset: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct SessionResponse {
    pub id: String,
    pub client_ip: Option<String>,
    pub user_agent: Option<String>,
    pub expires_at: String,
    pub created_at: String,
    pub current: bool,
}

#[derive(Debug, Serialize)]
pub struct LoginHistoryItem {
    pub id: i64,
    pub username_attempt: String,
    pub client_ip: Option<String>,
    pub user_agent: Option<String>,
    pub success: bool,
    pub failure_reason: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct TotpSetupResponse {
    pub secret: String,
    pub qr_code_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TotpVerifyRequest {
    pub code: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdatePreferencesRequest {
    #[serde(default)]
    pub theme: Option<String>,
    #[serde(default)]
    pub lang: Option<String>,
    #[serde(default)]
    pub notifications: Option<NotificationPrefs>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NotificationPrefs {
    #[serde(default)]
    pub email: EmailNotifPrefs,
    #[serde(default)]
    pub in_app: InAppNotifPrefs,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct EmailNotifPrefs {
    #[serde(default)]
    pub rule_changes: bool,
    #[serde(default)]
    pub security_alerts: bool,
    #[serde(default)]
    pub product_updates: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct InAppNotifPrefs {
    #[serde(default)]
    pub approvals: bool,
    #[serde(default)]
    pub audit: bool,
    #[serde(default)]
    pub product_updates: bool,
    #[serde(default)]
    pub infrastructure: bool,
}

#[derive(Debug, Serialize)]
pub struct PreferencesResponse {
    pub user_id: String,
    pub theme: String,
    pub lang: String,
    pub notifications: Option<Value>,
}
