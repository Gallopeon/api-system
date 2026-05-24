use chrono::Timelike;
use sqlx::MySqlPool;
use std::collections::HashMap;

/// Risk score: 0 = trusted, 100 = maximum suspicious
pub struct RiskAssessment {
    pub score: u32,
    pub reasons: Vec<String>,
    pub is_suspicious: bool,
}

/// Evaluate login risk based on device fingerprint, IP, and history.
pub async fn assess_login_risk(
    pool: &MySqlPool,
    user_id: &str,
    client_ip: &str,
    device_fingerprint: Option<&str>,
    user_agent: Option<&str>,
) -> RiskAssessment {
    let mut score: u32 = 0;
    let mut reasons: Vec<String> = Vec::new();

    // 1. Check if this is a new device (fingerprint)
    if let Some(fp) = device_fingerprint {
        if !fp.is_empty() {
            let known: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM user_devices WHERE user_id = ? AND fingerprint_hash = ?"
            )
            .bind(user_id).bind(fp)
            .fetch_one(pool).await.unwrap_or(0);

            if known == 0 {
                score += 35;
                reasons.push("new_device".to_string());
                // Record the new device
                let id = uuid::Uuid::new_v4().to_string();
                let ua_hash = user_agent.map(|ua| {
                    format!("{:x}", md5::compute(ua.as_bytes()))
                });
                let _ = sqlx::query(
                    "INSERT IGNORE INTO user_devices (id, user_id, fingerprint_hash, user_agent_hash, last_ip, trust_level) VALUES (?, ?, ?, ?, ?, 'unknown')"
                ).bind(&id).bind(user_id).bind(fp).bind(&ua_hash).bind(client_ip).execute(pool).await;
            } else {
                // Update last seen
                let _ = sqlx::query(
                    "UPDATE user_devices SET last_ip = ?, last_seen_at = NOW() WHERE user_id = ? AND fingerprint_hash = ?"
                ).bind(client_ip).bind(user_id).bind(fp).execute(pool).await;
            }
        }
    }

    // 2. Check IP change from last known location
    let last_ip: Option<String> = sqlx::query_scalar(
        "SELECT client_ip FROM login_history WHERE user_id = ? AND success = 1 ORDER BY created_at DESC LIMIT 1"
    )
    .bind(user_id)
    .fetch_optional(pool).await.ok().flatten();

    if let Some(ref prev_ip) = last_ip {
        if prev_ip != client_ip {
            // Different IP — moderate risk if not in same /16 subnet
            let same_subnet = prev_ip.split('.').take(2).eq(client_ip.split('.').take(2));
            if !same_subnet {
                score += 20;
                reasons.push("ip_change".to_string());
            }
        }
    }

    // 3. Check recent failed login attempts (brute force)
    let recent_failures: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM login_history WHERE user_id = ? AND success = 0 AND created_at > DATE_SUB(NOW(), INTERVAL 10 MINUTE)"
    )
    .bind(user_id)
    .fetch_one(pool).await.unwrap_or(0);

    if recent_failures >= 5 {
        score += 30;
        reasons.push("brute_force_pattern".to_string());
    } else if recent_failures >= 2 {
        score += 10;
        reasons.push("recent_failures".to_string());
    }

    // 4. Check login frequency anomaly (too many logins in short period)
    let recent_logins: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM login_history WHERE user_id = ? AND success = 1 AND created_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)"
    )
    .bind(user_id)
    .fetch_one(pool).await.unwrap_or(0);

    if recent_logins >= 5 {
        score += 15;
        reasons.push("high_login_frequency".to_string());
    }

    // 5. Time-based anomaly (logins at unusual hours)
    let current_hour = chrono::Utc::now().hour();
    let historical_hours: Vec<u32> = sqlx::query_scalar(
        "SELECT HOUR(CAST(created_at AS DATETIME)) FROM login_history WHERE user_id = ? AND success = 1 ORDER BY created_at DESC LIMIT 50"
    )
    .bind(user_id)
    .fetch_all(pool).await.unwrap_or_default();

    if !historical_hours.is_empty() {
        let mut hour_counts: HashMap<u32, u32> = HashMap::new();
        for h in &historical_hours {
            *hour_counts.entry(*h).or_default() += 1;
        }
        let total = historical_hours.len() as f64;
        let current_count = hour_counts.get(&current_hour).copied().unwrap_or(0) as f64;
        let _expected = total / 24.0;
        // If current hour has zero historical logins and we have enough data
        if current_count == 0.0 && total > 20.0 {
            score += 15;
            reasons.push("unusual_hour".to_string());
        }
    }

    let is_suspicious = score >= 40;
    RiskAssessment { score, reasons, is_suspicious }
}

/// Evaluate request behavior risk (per-request, lighter weight).
/// Returns a delta score that adds to the session's accumulated risk.
pub fn evaluate_request_risk(
    requests_in_window: u64,
    forbidden_responses: u64,
    window_seconds: u64,
) -> u32 {
    let mut delta = 0u32;

    // High request rate
    if window_seconds > 0 {
        let rps = requests_in_window as f64 / window_seconds as f64;
        if rps > 50.0 {
            delta += 15;
        } else if rps > 20.0 {
            delta += 5;
        }
    }

    // Permission boundary probing (many 403s)
    if forbidden_responses > 3 {
        delta += 20;
    } else if forbidden_responses > 0 {
        delta += 5;
    }

    delta
}

/// Generate a simple device fingerprint ID from browser characteristics
pub fn generate_fingerprint_id(screen: &str, tz: &str, platform: &str, language: &str) -> String {
    let raw = format!("{}|{}|{}|{}", screen, tz, platform, language);
    format!("{:x}", md5::compute(raw.as_bytes()))
}
