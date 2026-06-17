//! SMTP email sending engine.
//! Pure transport layer — reads config from DB settings, builds messages, sends via lettre.

use lettre::transport::smtp::authentication::Credentials;
use lettre::transport::smtp::SmtpTransport;
use lettre::{Message, Transport};
use sha2::{Sha256, Digest};

const ENC_PREFIX: &str = "enc:v1:";
const SMTP_TIMEOUT_SECS: u64 = 30;

/// Build an SMTP transport from config parameters.
pub fn build_smtp_transport(
    host: &str,
    port: u16,
    user: &str,
    pass: &str,
    encryption: &str,
    timeout_secs: u64,
) -> Result<SmtpTransport, String> {
    let timeout = std::time::Duration::from_secs(timeout_secs);
    let creds = Credentials::new(user.to_string(), pass.to_string());

    let builder = match encryption {
        "tls" => SmtpTransport::relay(host)
            .map_err(|e| format!("SMTP relay error: {e}"))?,
        "starttls" => SmtpTransport::starttls_relay(host)
            .map_err(|e| format!("SMTP relay error: {e}"))?,
        _ => SmtpTransport::builder_dangerous(host),
    };

    let transport = builder
        .port(port)
        .credentials(creds)
        .timeout(Some(timeout))
        .build();
    Ok(transport)
}

/// Build a lettre Message from parameters.
pub fn build_email_message(
    from_email: &str,
    from_name: &str,
    to_email: &str,
    subject: &str,
    body: &str,
) -> Result<Message, String> {
    Message::builder()
        .from(format!("{from_name} <{from_email}>").parse().map_err(|e| format!("invalid from: {e}"))?)
        .to(to_email.parse().map_err(|e| format!("invalid to: {e}"))?)
        .subject(subject)
        .body(body.to_string())
        .map_err(|e| format!("failed to build email: {e}"))
}

/// Send an email synchronously (call inside spawn_blocking).
pub fn send_email_sync(transport: &SmtpTransport, msg: &Message) -> Result<(), String> {
    transport.send(msg).map_err(|e| format!("SMTP send failed: {e}"))?;
    Ok(())
}

/// Verify SMTP connectivity without sending an email.
/// Attempts to connect and authenticate, then disconnects.
pub fn verify_smtp_connection(
    host: &str,
    port: u16,
    user: &str,
    pass: &str,
    encryption: &str,
    timeout_secs: u64,
) -> Result<String, String> {
    let transport = build_smtp_transport(host, port, user, pass, encryption, timeout_secs)?;
    match transport.test_connection() {
        Ok(true) => Ok(format!("Connection to {host}:{port} successful ({encryption})")),
        Ok(false) => Err(format!("Connection to {host}:{port} failed: server rejected connection")),
        Err(e) => Err(format!("Connection to {host}:{port} failed: {e}")),
    }
}

/// Encrypt a password for storage at rest.
/// Uses XOR with SHA-256 derived key stream, prefixed with version marker.
pub fn encrypt_password(plaintext: &str, jwt_secret: &str) -> String {
    if plaintext.is_empty() {
        return String::new();
    }
    let plain_bytes = plaintext.as_bytes();
    let key_stream = derive_key_stream(jwt_secret, plain_bytes.len());
    let encrypted: Vec<u8> = plain_bytes.iter().zip(key_stream.iter()).map(|(p, k)| p ^ k).collect();
    format!("{}{}", ENC_PREFIX, data_encoding::BASE64.encode(&encrypted))
}

/// Decrypt a password read from storage.
pub fn decrypt_password(stored: &str, jwt_secret: &str) -> String {
    if stored.is_empty() {
        return String::new();
    }
    let Some(encoded) = stored.strip_prefix(ENC_PREFIX) else {
        tracing::warn!("smtp_password is not encrypted (missing enc:v1: prefix); will not use");
        return String::new();
    };
    let Ok(encrypted) = data_encoding::BASE64.decode(encoded.as_bytes()) else {
        tracing::warn!("smtp_password failed to decode base64");
        return String::new();
    };
    let key_stream = derive_key_stream(jwt_secret, encrypted.len());
    let decrypted: Vec<u8> = encrypted.iter().zip(key_stream.iter()).map(|(e, k)| e ^ k).collect();
    String::from_utf8(decrypted).unwrap_or_default()
}

/// Derive a deterministic key stream from the JWT secret.
fn derive_key_stream(secret: &str, len: usize) -> Vec<u8> {
    let mut stream = Vec::with_capacity(len);
    let mut counter: u32 = 0;
    while stream.len() < len {
        let mut hasher = Sha256::new();
        hasher.update(secret.as_bytes());
        hasher.update(counter.to_le_bytes());
        let hash = hasher.finalize();
        stream.extend_from_slice(&hash);
        counter += 1;
    }
    stream.truncate(len);
    stream
}

/// Check if a stored value is an encrypted password (has the enc: prefix).
pub fn is_encrypted(value: &str) -> bool {
    value.starts_with(ENC_PREFIX)
}

/// Default SMTP timeout in seconds.
pub fn default_timeout() -> u64 {
    SMTP_TIMEOUT_SECS
}
