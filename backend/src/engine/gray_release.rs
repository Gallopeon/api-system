use std::hash::{Hash, Hasher};
use serde_json::Value;
use crate::AppError;
use crate::types::*;
use super::expression::get_value_by_path;

pub fn resolve_effective_rule(
    base_rule: &TransformRule,
    traffic_context: Option<&Value>,
    force_variant: Option<&str>,
) -> Result<(TransformRule, Option<String>), AppError> {
    let Some(gray_release) = &base_rule.gray_release else {
        return Ok((base_rule.clone(), None));
    };

    if !gray_release.enabled || gray_release.variants.is_empty() {
        return Ok((base_rule.clone(), None));
    }

    let selected_variant = if let Some(name) = force_variant {
        gray_release
            .variants
            .iter()
            .find(|variant| variant.name == name)
            .ok_or_else(|| AppError::BadRequest(format!("forced variant {} not found", name)))?
    } else {
        let bucket_key = extract_bucket_key(gray_release, traffic_context);
        let Some(bucket_key) = bucket_key else {
            return Ok((base_rule.clone(), None));
        };

        choose_variant(gray_release, &bucket_key).ok_or_else(|| {
            AppError::BadRequest("failed to choose gray release variant".to_string())
        })?
    };

    let mut effective = apply_gray_overrides(base_rule, &selected_variant.overrides);
    effective.gray_release = None;

    Ok((effective, Some(selected_variant.name.clone())))
}

pub fn extract_bucket_key(config: &GrayReleaseConfig, traffic_context: Option<&Value>) -> Option<String> {
    let context = traffic_context?;
    let raw_value = get_value_by_path(context, &config.bucket_field)
        .or_else(|| context.as_object().and_then(|obj| obj.get(&config.bucket_field)))?;

    let key = match raw_value {
        Value::String(v) => v.clone(),
        Value::Number(v) => v.to_string(),
        Value::Bool(v) => v.to_string(),
        Value::Null => return None,
        other => other.to_string(),
    };

    if key.trim().is_empty() {
        None
    } else {
        Some(key)
    }
}

pub fn choose_variant<'a>(config: &'a GrayReleaseConfig, bucket_key: &str) -> Option<&'a GrayVariant> {
    let total_weight: u32 = config.variants.iter().map(|item| item.weight as u32).sum();
    if total_weight == 0 {
        return None;
    }

    let bucket = stable_bucket(bucket_key) % total_weight;
    let mut cursor = 0_u32;
    for variant in &config.variants {
        cursor += variant.weight as u32;
        if bucket < cursor {
            return Some(variant);
        }
    }

    config.variants.last()
}

pub fn stable_bucket(bucket_key: &str) -> u32 {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    bucket_key.hash(&mut hasher);
    (hasher.finish() % (u32::MAX as u64)) as u32
}

pub fn apply_gray_overrides(base_rule: &TransformRule, overrides: &GrayVariantOverrides) -> TransformRule {
    let mut merged = base_rule.clone();

    if let Some(whitelist_fields) = &overrides.whitelist_fields {
        merged.whitelist_fields = whitelist_fields.clone();
    }
    if let Some(renames) = &overrides.renames {
        merged.renames.extend(renames.clone());
    }
    if let Some(masked_fields) = &overrides.masked_fields {
        merged.masked_fields = masked_fields.clone();
    }
    if let Some(computed_literals) = &overrides.computed_literals {
        merged.computed_literals.extend(computed_literals.clone());
    }
    if let Some(remove_nulls) = overrides.remove_nulls {
        merged.remove_nulls = remove_nulls;
    }
    if let Some(conditional_rules) = &overrides.conditional_rules {
        merged.conditional_rules = conditional_rules.clone();
    }
    if let Some(pagination) = &overrides.pagination {
        merged.pagination = Some(pagination.clone());
    }
    if let Some(request_validation) = &overrides.request_validation {
        merged.request_validation = Some(request_validation.clone());
    }
    if let Some(response_validation) = &overrides.response_validation {
        merged.response_validation = Some(response_validation.clone());
    }
    if let Some(cache_config) = &overrides.cache_config {
        merged.cache_config = Some(cache_config.clone());
    }

    merged
}
