use std::collections::HashSet;
use serde_json::Value;
use crate::AppError;
use crate::types::*;
use super::expression::validate_expression_syntax;

pub fn validate_rule_request(name: &str, api_path: &str) -> Result<(), AppError> {
    if name.trim().is_empty() {
        return Err(AppError::BadRequest("name cannot be empty".to_string()));
    }

    if !api_path.starts_with('/') {
        return Err(AppError::BadRequest(
            "api_path must start with /".to_string(),
        ));
    }

    Ok(())
}

pub fn validate_transform_rule(rule: &TransformRule) -> Result<(), AppError> {
    validate_conditional_rules(&rule.conditional_rules)?;

    if let Some(gray_release) = &rule.gray_release {
        validate_gray_release_config(gray_release)?;

        for variant in &gray_release.variants {
            if let Some(extra_rules) = &variant.overrides.conditional_rules {
                validate_conditional_rules(extra_rules)?;
            }
        }
    }

    Ok(())
}

pub fn validate_conditional_rules(conditional_rules: &[ConditionalRule]) -> Result<(), AppError> {
    for conditional_rule in conditional_rules {
        if conditional_rule.when.trim().is_empty() {
            return Err(AppError::BadRequest(
                "conditional rule expression cannot be empty".to_string(),
            ));
        }
        validate_expression_syntax(&conditional_rule.when)?;
    }

    Ok(())
}

pub fn validate_gray_release_config(config: &GrayReleaseConfig) -> Result<(), AppError> {
    if !config.enabled {
        return Ok(());
    }

    if config.bucket_field.trim().is_empty() {
        return Err(AppError::BadRequest(
            "gray release bucket_field cannot be empty".to_string(),
        ));
    }

    if config.variants.is_empty() {
        return Err(AppError::BadRequest(
            "gray release enabled but variants is empty".to_string(),
        ));
    }

    let mut total_weight: u16 = 0;
    let mut names = HashSet::new();
    for variant in &config.variants {
        if variant.name.trim().is_empty() {
            return Err(AppError::BadRequest(
                "gray release variant name cannot be empty".to_string(),
            ));
        }
        if variant.weight == 0 {
            return Err(AppError::BadRequest(format!(
                "gray release variant {} weight cannot be 0",
                variant.name
            )));
        }
        if !names.insert(variant.name.clone()) {
            return Err(AppError::BadRequest(format!(
                "gray release variant {} duplicated",
                variant.name
            )));
        }
        total_weight += variant.weight as u16;
    }

    if total_weight == 0 {
        return Err(AppError::BadRequest(
            "gray release must have at least one variant with positive weight".to_string(),
        ));
    }

    Ok(())
}

pub fn validate_json(body: &Value, config: &ValidationSchema) -> Result<ValidationResult, AppError> {
    let compiled = match jsonschema::JSONSchema::options()
        .with_draft(jsonschema::Draft::Draft7)
        .compile(&config.schema)
    {
        Ok(s) => s,
        Err(e) => {
            return Ok(ValidationResult {
                valid: false,
                errors: vec![],
                warnings: vec![],
                schema_errors: vec![format!("Schema compilation error: {}", e)],
            });
        }
    };

    let result = compiled.validate(body);
    if let Err(errors) = result {
        let err_list: Vec<String> = errors
            .map(|e| {
                if let Some(ref custom) = config.custom_error_message {
                    custom.clone()
                } else {
                    format!("{}: {}", e.instance_path, e)
                }
            })
            .collect();

        Ok(ValidationResult {
            valid: false,
            errors: err_list,
            warnings: vec![],
            schema_errors: vec![],
        })
    } else {
        Ok(ValidationResult {
            valid: true,
            errors: vec![],
            warnings: vec![],
            schema_errors: vec![],
        })
    }
}
