use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct SystemSettingItem {
    pub key: String,
    pub value: String,
    pub description: Option<String>,
    pub editable: bool,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSettingRequest {
    pub value: String,
    #[serde(default)]
    pub actor: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SmtpTestRequest {
    #[serde(default)]
    pub to_email: Option<String>,
}
