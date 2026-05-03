use serde_json::{json, Map, Value};
use crate::types::*;

pub fn sanitize_schema_name(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_alphanumeric() || c == '_' { c } else { '_' })
        .collect()
}

pub fn infer_type_from_name(name: &str) -> &'static str {
    let lower = name.to_lowercase();
    if lower.contains("id") && !lower.contains("grid") && !lower.contains("video") {
        "string"
    } else if lower.contains("count") || lower.contains("size") || lower.contains("total")
        || lower.contains("page") || lower.contains("limit") || lower.contains("offset")
        || lower.contains("version") || lower.contains("number") || lower.contains("amount")
    {
        "integer"
    } else if lower.contains("price") || lower.contains("rate") || lower.contains("score")
        || lower.contains("weight") || lower.contains("lat") || lower.contains("lng")
    {
        "number"
    } else if lower.starts_with("is_") || lower.starts_with("has_") || lower.starts_with("can_")
        || lower.starts_with("should_") || lower.contains("enabled") || lower.contains("active")
    {
        "boolean"
    } else {
        "string"
    }
}

pub fn derive_schemas_from_rule(config: &TransformRule) -> (Value, Option<Value>) {
    let mut resp_props = Map::new();
    let mut req_props = Map::new();
    let mut req_required = Vec::new();

    for field in &config.whitelist_fields {
        let field_type = infer_type_from_name(field);
        resp_props.insert(
            field.clone(),
            json!({"type": field_type, "description": format!("Field: {}", field)}),
        );
        req_props.insert(
            field.clone(),
            json!({"type": field_type, "description": format!("Field: {}", field)}),
        );
        req_required.push(json!(field));
    }

    for (new_name, _old_name) in &config.renames {
        if !resp_props.contains_key(new_name) {
            let field_type = infer_type_from_name(new_name);
            resp_props.insert(
                new_name.clone(),
                json!({"type": field_type, "description": format!("Renamed field: {}", new_name)}),
            );
        }
    }

    for (key, value) in &config.computed_literals {
        let type_name = match value {
            Value::String(_) => "string",
            Value::Number(_) => "number",
            Value::Bool(_) => "boolean",
            Value::Array(_) => "array",
            Value::Object(_) => "object",
            Value::Null => "string",
        };
        resp_props.insert(
            key.clone(),
            json!({"type": type_name, "description": format!("Computed literal: {}", key)}),
        );
    }

    let resp_schema = json!({
        "type": "object",
        "properties": resp_props
    });

    let req_schema = if !req_props.is_empty() {
        Some(json!({
            "type": "object",
            "required": req_required,
            "properties": req_props
        }))
    } else {
        None
    };

    (resp_schema, req_schema)
}

pub fn build_openapi_spec(rules: &[(RuleSummary, TransformRule)], base_url: &str) -> Value {
    let mut paths = Map::new();
    let mut schemas = Map::new();

    for (summary, config) in rules {
        let schema_name = sanitize_schema_name(&summary.name);
        let (response_schema, req_schema) = derive_schemas_from_rule(config);
        schemas.insert(schema_name.clone(), response_schema);

        let mut path_item = Map::new();

        // GET endpoint
        let mut get_op = Map::new();
        get_op.insert("summary".to_string(), json!(format!("{} - {}", summary.name, summary.api_path)));
        get_op.insert("operationId".to_string(), json!(format!("get_{}", schema_name.to_lowercase())));
        get_op.insert("tags".to_string(), json!([summary.status]));

        let mut get_response = Map::new();
        get_response.insert("description".to_string(), json!("Successful response"));
        let mut get_content = Map::new();
        let mut get_json = Map::new();
        get_json.insert(
            "schema".to_string(),
            json!({"$ref": format!("#/components/schemas/{}", schema_name)}),
        );
        get_content.insert("application/json".to_string(), json!(get_json));
        get_response.insert("content".to_string(), json!(get_content));
        let mut get_responses = Map::new();
        get_responses.insert("200".to_string(), json!(get_response));
        get_op.insert("responses".to_string(), json!(get_responses));

        path_item.insert("get".to_string(), json!(get_op));

        // POST endpoint with request body
        if let Some(ref req) = req_schema {
            let mut post_op = Map::new();
            post_op.insert("summary".to_string(), json!(format!("Create - {}", summary.name)));
            post_op.insert("operationId".to_string(), json!(format!("post_{}", schema_name.to_lowercase())));
            post_op.insert("tags".to_string(), json!([summary.status]));

            let mut post_req_body = Map::new();
            post_req_body.insert("required".to_string(), json!(true));
            let mut post_content = Map::new();
            let mut post_json = Map::new();
            let req_schema_name = format!("{}Request", schema_name);
            schemas.insert(req_schema_name.clone(), req.clone());
            post_json.insert(
                "schema".to_string(),
                json!({"$ref": format!("#/components/schemas/{}", req_schema_name)}),
            );
            post_content.insert("application/json".to_string(), json!(post_json));
            post_req_body.insert("content".to_string(), json!(post_content));
            post_op.insert("requestBody".to_string(), json!(post_req_body));

            let mut post_response = Map::new();
            post_response.insert("description".to_string(), json!("Created"));
            let mut post_responses = Map::new();
            post_responses.insert("201".to_string(), json!(post_response));
            post_op.insert("responses".to_string(), json!(post_responses));

            path_item.insert("post".to_string(), json!(post_op));
        }

        paths.insert(summary.api_path.clone(), json!(path_item));
    }

    json!({
        "openapi": "3.1.0",
        "info": {
            "title": "API Control Plane - Auto Generated Spec",
            "version": chrono::Utc::now().format("%Y%m%d").to_string(),
            "description": "Auto-generated from rule configurations. Whitelist fields, renames, and masks are reflected in response schemas."
        },
        "servers": [
            { "url": base_url, "description": "API Gateway" }
        ],
        "paths": paths,
        "components": {
            "schemas": schemas
        }
    })
}

pub fn build_overlay_spec(rules: &[(RuleSummary, TransformRule)], base_url: &str) -> Value {
    let mut actions = Vec::new();

    for (summary, _config) in rules {
        actions.push(json!({
            "target": "$.servers[0].url",
            "description": format!("Set server URL for rule '{}' environment overlay", summary.name),
            "update": base_url
        }));
    }

    json!({
        "overlay": "1.0.0",
        "info": {
            "title": "Environment Overlay",
            "version": chrono::Utc::now().format("%Y%m%d").to_string()
        },
        "extends": "/openapi.json",
        "actions": actions
    })
}
