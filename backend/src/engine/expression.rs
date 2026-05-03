use serde_json::Value;
use crate::AppError;

pub fn validate_expression_syntax(expression: &str) -> Result<(), AppError> {
    let groups = split_logical_groups(expression, "||")?;
    for group in groups {
        let predicates = split_logical_groups(group, "&&")?;
        for predicate in predicates {
            validate_predicate(predicate)?;
        }
    }
    Ok(())
}

pub fn eval_expression(expression: &str, input: &Value) -> Result<bool, AppError> {
    let groups = split_logical_groups(expression, "||")?;
    for group in groups {
        let predicates = split_logical_groups(group, "&&")?;
        let mut all_match = true;
        for predicate in predicates {
            if !eval_predicate(predicate, input)? {
                all_match = false;
                break;
            }
        }

        if all_match {
            return Ok(true);
        }
    }

    Ok(false)
}

pub fn split_logical_groups<'a>(expression: &'a str, op: &str) -> Result<Vec<&'a str>, AppError> {
    let groups = expression
        .split(op)
        .map(|item| item.trim())
        .filter(|item| !item.is_empty())
        .collect::<Vec<_>>();

    if groups.is_empty() {
        return Err(AppError::BadRequest("expression cannot be empty".to_string()));
    }

    Ok(groups)
}

pub fn validate_predicate(predicate: &str) -> Result<(), AppError> {
    if predicate.starts_with("exists(") && predicate.ends_with(')') {
        let path = &predicate[7..predicate.len() - 1];
        if path.trim().is_empty() {
            return Err(AppError::BadRequest("exists() path cannot be empty".to_string()));
        }
        return Ok(());
    }

    if predicate.starts_with("contains(") && predicate.ends_with(')') {
        let inner = &predicate[9..predicate.len() - 1];
        let (path, needle) = inner
            .split_once(',')
            .ok_or_else(|| AppError::BadRequest("contains() expects path,value".to_string()))?;
        if path.trim().is_empty() || needle.trim().is_empty() {
            return Err(AppError::BadRequest(
                "contains() arguments cannot be empty".to_string(),
            ));
        }
        parse_literal_value(needle.trim());
        return Ok(());
    }

    parse_compare_predicate(predicate).map(|_| ())
}

pub fn eval_predicate(predicate: &str, input: &Value) -> Result<bool, AppError> {
    if predicate.starts_with("exists(") && predicate.ends_with(')') {
        let path = &predicate[7..predicate.len() - 1];
        return Ok(get_value_by_path(input, path.trim()).is_some());
    }

    if predicate.starts_with("contains(") && predicate.ends_with(')') {
        let inner = &predicate[9..predicate.len() - 1];
        let (path, needle_raw) = inner
            .split_once(',')
            .ok_or_else(|| AppError::BadRequest("contains() expects path,value".to_string()))?;

        let target = get_value_by_path(input, path.trim()).unwrap_or(&Value::Null);
        let needle = parse_literal_value(needle_raw.trim());

        return Ok(match (target, needle) {
            (Value::String(source), Value::String(needle)) => source.contains(&needle),
            (Value::Array(items), value) => items.iter().any(|item| item == &value),
            _ => false,
        });
    }

    let (lhs_path, op, rhs) = parse_compare_predicate(predicate)?;
    let lhs = get_value_by_path(input, lhs_path).unwrap_or(&Value::Null);
    Ok(compare_values(lhs, &rhs, op))
}

pub fn parse_compare_predicate(predicate: &str) -> Result<(&str, &'static str, Value), AppError> {
    let operators = ["==", "!=", ">=", "<=", ">", "<"];
    for op in operators {
        if let Some(index) = predicate.find(op) {
            let lhs = predicate[..index].trim();
            let rhs_raw = predicate[index + op.len()..].trim();
            if lhs.is_empty() || rhs_raw.is_empty() {
                return Err(AppError::BadRequest(format!(
                    "invalid predicate: {}",
                    predicate
                )));
            }
            return Ok((lhs, op, parse_literal_value(rhs_raw)));
        }
    }

    Err(AppError::BadRequest(format!(
        "unsupported expression predicate: {}",
        predicate
    )))
}

pub fn parse_literal_value(raw: &str) -> Value {
    let trimmed = raw.trim();
    if let Ok(value) = serde_json::from_str::<Value>(trimmed) {
        return value;
    }

    if let Ok(number) = trimmed.parse::<f64>() {
        return serde_json::json!(number);
    }

    Value::String(trimmed.trim_matches('"').to_string())
}

pub fn compare_values(lhs: &Value, rhs: &Value, op: &str) -> bool {
    match op {
        "==" => lhs == rhs,
        "!=" => lhs != rhs,
        ">" | "<" | ">=" | "<=" => compare_order(lhs, rhs, op),
        _ => false,
    }
}

pub fn compare_order(lhs: &Value, rhs: &Value, op: &str) -> bool {
    match (lhs, rhs) {
        (Value::Number(a), Value::Number(b)) => {
            let left = a.as_f64().unwrap_or(0.0);
            let right = b.as_f64().unwrap_or(0.0);
            match op {
                ">" => left > right,
                "<" => left < right,
                ">=" => left >= right,
                "<=" => left <= right,
                _ => false,
            }
        }
        (Value::String(a), Value::String(b)) => match op {
            ">" => a > b,
            "<" => a < b,
            ">=" => a >= b,
            "<=" => a <= b,
            _ => false,
        },
        _ => false,
    }
}

pub fn get_value_by_path<'a>(input: &'a Value, path: &str) -> Option<&'a Value> {
    let clean = path
        .trim()
        .trim_start_matches("$.")
        .trim_start_matches('$');

    if clean.is_empty() {
        return Some(input);
    }

    let mut current = input;
    for segment in clean.split('.') {
        let key = segment.trim();
        if key.is_empty() {
            continue;
        }
        current = current.as_object()?.get(key)?;
    }

    Some(current)
}
