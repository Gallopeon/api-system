use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct PermissionTemplate {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub permissions: Vec<String>,
    pub is_builtin: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreatePermissionTemplateRequest {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    pub permissions: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePermissionTemplateRequest {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub permissions: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
pub struct PermissionTemplateListResponse {
    pub items: Vec<PermissionTemplate>,
}

#[derive(Debug, Deserialize)]
pub struct ListPermissionTemplatesQuery {
    #[serde(default)]
    pub search: Option<String>,
}
