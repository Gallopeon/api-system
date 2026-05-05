use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct ApprovalListResponse {
    pub items: Vec<ApprovalResponse>,
    pub limit: u32,
    pub offset: u32,
}

#[derive(Debug, Deserialize)]
pub struct CreateApprovalRequest {
    pub rule_id: String,
    pub version: i32,
    #[serde(default)]
    pub comment: Option<String>,
    #[serde(default)]
    pub reviewer: Option<String>,
    #[serde(default)]
    pub actor: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ApprovalsMyQuery {
    #[serde(default)]
    pub limit: Option<i64>,
    #[serde(default)]
    pub offset: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct ReviewApprovalRequest {
    pub action: String,
    #[serde(default)]
    pub comment: Option<String>,
    #[serde(default)]
    pub actor: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ApprovalResponse {
    pub id: String,
    pub rule_id: String,
    pub version: i32,
    pub requestor: String,
    pub reviewer: Option<String>,
    pub status: String,
    pub comment: Option<String>,
    pub created_at: String,
    pub reviewed_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListApprovalsQuery {
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub offset: Option<u32>,
}
