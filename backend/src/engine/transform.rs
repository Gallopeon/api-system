use std::collections::HashSet;
use serde_json::{json, Map, Value};
use tracing::warn;
use crate::types::*;

pub fn mask_value(value: &Value) -> Value {
    match value {
        Value::String(s) => {
            if s.chars().count() <= 4 {
                Value::String("****".to_string())
            } else {
                let first = s.chars().take(2).collect::<String>();
                let last = s
                    .chars()
                    .rev()
                    .take(2)
                    .collect::<String>()
                    .chars()
                    .rev()
                    .collect::<String>();
                Value::String(format!("{}****{}", first, last))
            }
        }
        Value::Number(_) => Value::String("***".to_string()),
        Value::Bool(_) => Value::String("***".to_string()),
        Value::Array(arr) => Value::Array(arr.iter().map(mask_value).collect::<Vec<_>>()),
        Value::Object(_) => Value::String("[MASKED]".to_string()),
        Value::Null => Value::Null,
    }
}

pub fn apply_transform(input: &Value, rule: &TransformRule) -> Value {
    if let Some(pagination) = &rule.pagination {
        if let Some(obj) = input.as_object() {
            let raw_data = obj
                .get(&pagination.data_key)
                .cloned()
                .unwrap_or_else(|| Value::Array(Vec::new()));
            let transformed_data = transform_payload(&raw_data, rule);

            return json!({
                "data": transformed_data,
                "meta": {
                    "total": obj.get(&pagination.total_field).cloned().unwrap_or_else(|| json!(0)),
                    "page": obj.get(&pagination.page_field).cloned().unwrap_or_else(|| json!(1)),
                    "page_size": obj.get(&pagination.page_size_field).cloned().unwrap_or_else(|| json!(20))
                }
            });
        }
    }

    transform_payload(input, rule)
}

pub fn transform_payload(input: &Value, rule: &TransformRule) -> Value {
    match input {
        Value::Array(items) => {
            let transformed = items
                .iter()
                .map(|item| transform_payload(item, rule))
                .collect::<Vec<_>>();
            Value::Array(transformed)
        }
        Value::Object(obj) => transform_object(obj, rule),
        _ => input.clone(),
    }
}

pub fn transform_object(input: &Map<String, Value>, rule: &TransformRule) -> Value {
    let mask_set = rule
        .masked_fields
        .iter()
        .map(|f| f.as_str())
        .collect::<HashSet<_>>();

    let selected = if rule.whitelist_fields.is_empty() {
        input.keys().cloned().collect::<Vec<_>>()
    } else {
        rule.whitelist_fields.clone()
    };

    let mut out = Map::new();

    for key in selected {
        if let Some(value) = input.get(&key) {
            let output_key = rule
                .renames
                .get(&key)
                .cloned()
                .unwrap_or_else(|| key.clone());

            let mut output_value = value.clone();
            if mask_set.contains(key.as_str()) {
                output_value = mask_value(&output_value);
            }

            if !(rule.remove_nulls && output_value.is_null()) {
                out.insert(output_key, output_value);
            }
        }
    }

    for (k, v) in &rule.computed_literals {
        out.insert(k.clone(), v.clone());
    }

    if !rule.conditional_rules.is_empty() {
        apply_conditional_rules(input, &mut out, &rule.conditional_rules);
    }

    Value::Object(out)
}

pub fn apply_conditional_rules(
    source_input: &Map<String, Value>,
    output: &mut Map<String, Value>,
    rules: &[ConditionalRule],
) {
    let source_value = Value::Object(source_input.clone());

    for conditional in rules {
        let matched = match super::expression::eval_expression(&conditional.when, &source_value) {
            Ok(value) => value,
            Err(err) => {
                warn!(error = %err, expression = %conditional.when, "conditional expression skipped");
                false
            }
        };

        if !matched {
            continue;
        }

        for key in &conditional.remove_fields {
            output.remove(key);
        }

        for (from, to) in &conditional.rename_fields {
            if let Some(value) = output.remove(from) {
                output.insert(to.clone(), value);
            }
        }

        for key in &conditional.mask_fields {
            if let Some(existing) = output.get_mut(key) {
                *existing = mask_value(existing);
            }
        }

        for (key, value) in &conditional.add_literals {
            output.insert(key.clone(), value.clone());
        }

        if conditional.stop_after_match {
            break;
        }
    }
}
