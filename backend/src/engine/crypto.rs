use uuid::Uuid;

pub fn generate_api_key() -> (String, String) {
    let key = format!("sk_{}", Uuid::new_v4().to_string().replace("-", ""));
    let hash = key_hash(&key);
    (key, hash)
}

pub fn key_hash(key: &str) -> String {
    format!("{:x}", md5::compute(key.as_bytes()))
}
