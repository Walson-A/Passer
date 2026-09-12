use axum::{
    body::Body,
    extract::State,
    http::{Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use rand::Rng;
use std::sync::Arc;

use crate::paths::get_token_path;
use crate::types::ServerState;

/// Length of a generated pairing token (~190 bits of entropy at base62).
const TOKEN_LEN: usize = 32;

/// Header carrying the pairing token on every authenticated request.
pub const TOKEN_HEADER: &str = "x-passer-token";

/// Generates a fresh random pairing token.
pub fn generate_token() -> String {
    rand::thread_rng()
        .sample_iter(&rand::distributions::Alphanumeric)
        .take(TOKEN_LEN)
        .map(char::from)
        .collect()
}

/// Persists a token to disk so it survives restarts (a token that rotated on
/// every launch would force the user to re-configure their iOS Shortcuts).
pub fn save_token(token: &str) -> std::io::Result<()> {
    std::fs::write(get_token_path(), token)
}

/// Loads the persisted pairing token, generating and saving one on first run.
pub fn load_or_create_token() -> String {
    if let Ok(existing) = std::fs::read_to_string(get_token_path()) {
        let trimmed = existing.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }

    let token = generate_token();
    if let Err(e) = save_token(&token) {
        eprintln!(" [AUTH] Failed to persist pairing token: {}", e);
    }
    token
}

/// Compares two byte strings without short-circuiting on the first difference.
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

/// Extracts the token from the `X-Passer-Token` header, falling back to a
/// `token=` query parameter for clients where custom headers are awkward.
fn extract_token(req: &Request<Body>) -> Option<String> {
    if let Some(header) = req.headers().get(TOKEN_HEADER).and_then(|v| v.to_str().ok()) {
        return Some(header.to_string());
    }

    req.uri().query().and_then(|query| {
        query
            .split('&')
            .find_map(|pair| pair.strip_prefix("token="))
            .map(|value| value.to_string())
    })
}

/// Rejects any request that does not carry the correct pairing token.
pub async fn require_token(
    State(state): State<Arc<ServerState>>,
    req: Request<Body>,
    next: Next,
) -> Response {
    let expected = state
        .pairing_token
        .lock()
        .map(|t| t.clone())
        .unwrap_or_default();

    let authorized = match extract_token(&req) {
        // An empty expected token would otherwise authorize everyone.
        Some(provided) if !expected.is_empty() => {
            constant_time_eq(provided.as_bytes(), expected.as_bytes())
        }
        _ => false,
    };

    if authorized {
        return next.run(req).await;
    }

    (
        StatusCode::UNAUTHORIZED,
        Json(serde_json::json!({
            "status": "error",
            "message": "Missing or invalid pairing token. Send it as the X-Passer-Token header (or ?token=). You can copy it from Passer > Settings."
        })),
    )
        .into_response()
}
