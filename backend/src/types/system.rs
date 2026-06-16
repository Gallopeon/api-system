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
pub struct BatchUpdateSettingsRequest {
    pub settings: Vec<SettingKeyValue>,
}

#[derive(Debug, Deserialize)]
pub struct SettingKeyValue {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Deserialize)]
pub struct SmtpTestRequest {
    #[serde(default)]
    pub to_email: Option<String>,
    #[serde(default)]
    pub subject: Option<String>,
    #[serde(default)]
    pub body: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SmtpVerifyRequest {
    /// Optional override host (defaults to DB setting)
    #[serde(default)]
    pub host: Option<String>,
    /// Optional override port
    #[serde(default)]
    pub port: Option<u16>,
    /// Optional override encryption mode
    #[serde(default)]
    pub encryption: Option<String>,
}
