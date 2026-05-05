use std::sync::Arc;
use axum::extract::{Query, State};
use axum::response::IntoResponse;
use axum::{Extension, Json};
use sqlx::Row;

use crate::AppState;
use crate::types::*;
use crate::auth::*;
use crate::engine::*;

pub async fn get_openapi_spec(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthContext>,
    Query(query): Query<OpenApiQuery>,
) -> Result<impl IntoResponse, AppError> {
    ensure_permission(&auth, Permission::OpenApiRead)?;
    let rows = if let Some(ref api_path) = query.api_path {
        sqlx::query("SELECT id, name, api_path, current_version, status FROM rule_configs WHERE api_path = ?")
            .bind(api_path).fetch_all(&state.pool).await?
    } else {
        sqlx::query("SELECT id, name, api_path, current_version, status FROM rule_configs")
            .fetch_all(&state.pool).await?
    };
    let mut rules = Vec::new();
    for row in &rows {
        let rule_id: String = row.try_get("id").unwrap_or_default();
        let config_text: String = sqlx::query_scalar("SELECT config_text FROM rule_versions WHERE rule_id = ? ORDER BY version DESC LIMIT 1")
            .bind(&rule_id).fetch_one(&state.pool).await?;
        let config: TransformRule = serde_json::from_str(&config_text).unwrap_or_default();
        rules.push((RuleSummary {
            id: rule_id,
            name: row.try_get("name").unwrap_or_default(),
            api_path: row.try_get("api_path").unwrap_or_default(),
            current_version: row.try_get("current_version").unwrap_or(1),
            status: row.try_get("status").unwrap_or_default(),
            updated_at: String::new(),
        }, config));
    }
    let is_overlay = query.overlay.is_some();
    let base_url = query.overlay.unwrap_or_else(|| "http://localhost:8080".to_string());
    let spec = if is_overlay {
        build_overlay_spec(&rules, &base_url)
    } else {
        build_openapi_spec(&rules, &base_url)
    };
    Ok(Json(spec))
}
