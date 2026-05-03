use std::collections::BTreeSet;
use serde_json::Value;
use crate::types::DiffEntry;

pub fn diff_value(path: &str, from: Option<&Value>, to: Option<&Value>, changes: &mut Vec<DiffEntry>) {
    match (from, to) {
        (None, Some(right)) => {
            changes.push(DiffEntry {
                path: path.to_string(),
                change_type: "added".to_string(),
                from: Value::Null,
                to: right.clone(),
            });
        }
        (Some(left), None) => {
            changes.push(DiffEntry {
                path: path.to_string(),
                change_type: "removed".to_string(),
                from: left.clone(),
                to: Value::Null,
            });
        }
        (Some(Value::Object(left)), Some(Value::Object(right))) => {
            let keys = left
                .keys()
                .chain(right.keys())
                .cloned()
                .collect::<BTreeSet<_>>();

            for key in keys {
                let child_path = format!("{}.{}", path, key);
                diff_value(&child_path, left.get(&key), right.get(&key), changes);
            }
        }
        (Some(Value::Array(left)), Some(Value::Array(right))) => {
            let max_len = left.len().max(right.len());
            for index in 0..max_len {
                let child_path = format!("{}[{}]", path, index);
                diff_value(&child_path, left.get(index), right.get(index), changes);
            }
        }
        (Some(left), Some(right)) => {
            if left != right {
                changes.push(DiffEntry {
                    path: path.to_string(),
                    change_type: "modified".to_string(),
                    from: left.clone(),
                    to: right.clone(),
                });
            }
        }
        (None, None) => {}
    }
}
