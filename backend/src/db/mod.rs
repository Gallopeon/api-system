pub mod rules;
pub mod metrics;
pub mod auth;
pub mod products;
pub mod system;
pub mod infrastructure;
pub mod seeds;

// Using a sub-module name to avoid conflict with the mod keyword in some contexts,
// though bootstrap_schema is what's exported.
pub mod mod_bootstrap {
    use sqlx::MySqlPool;
    use crate::auth::AppError;
    use super::{rules, metrics, auth, products, system, infrastructure, seeds};

    pub async fn bootstrap_schema(pool: &MySqlPool) -> Result<(), AppError> {
        rules::bootstrap(pool).await?;
        metrics::bootstrap(pool).await?;
        auth::bootstrap(pool).await?;
        products::bootstrap(pool).await?;
        system::bootstrap(pool).await?;
        infrastructure::bootstrap(pool).await?;

        seeds::seed_settings(pool).await?;
        seeds::seed_permission_templates(pool).await?;
        seeds::seed_admin(pool).await?;
        seeds::seed_plugins(pool).await?;
        seeds::seed_protocols(pool).await?;
        seeds::seed_classifications(pool).await?;

        Ok(())
    }
}
