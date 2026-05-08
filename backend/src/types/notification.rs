use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Deserialize)]
pub struct ListNotificationsQuery {
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub offset: Option<u32>,
    #[serde(default)]
    pub unread_only: Option<bool>,
    #[serde(default)]
    pub channel: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct NotificationItem {
    pub id: String,
    pub r#type: String,
    pub channel: String,
    pub title: String,
    pub message: String,
    pub read: bool,
    pub email_sent: bool,
    pub metadata: Option<Value>,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct NotificationListResponse {
    pub items: Vec<NotificationItem>,
    pub unread_count: i64,
    pub limit: u32,
    pub offset: u32,
}

#[derive(Debug, Deserialize)]
pub struct MarkReadRequest {
    #[serde(default)]
    pub id: Option<String>,
}
