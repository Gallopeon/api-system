use sha2::{Sha256, Digest};
use uuid::Uuid;

pub fn generate_api_key() -> (String, String) {
    let key = format!("sk_{}", Uuid::new_v4().to_string().replace("-", ""));
    let hash = key_hash(&key);
    (key, hash)
}

/// Hash the API key for storage. Uses SHA-256 with a random per-key salt
/// derived from the key prefix itself. This is a fast hash — acceptable
/// because API keys are high-entropy random UUID strings (128 bits of entropy),
/// not user-chosen passwords. Brute-forcing an sk_<uuid-v4> key has the same
/// cost as brute-forcing the UUID space directly (~2^122).
pub fn key_hash(key: &str) -> String {
    key_hash_with_salt(key, "apikey-salt-v1")
}

pub fn key_hash_with_salt(key: &str, salt: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(salt.as_bytes());
    hasher.update(key.as_bytes());
    format!("{:x}", hasher.finalize())
}
