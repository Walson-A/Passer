use std::sync::Arc;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

#[derive(Clone, serde::Serialize, serde::Deserialize)]
pub struct WebDavCreds {
    pub port: u16,
    pub user: String,
    pub pass: String,
}

// Shared state
#[derive(Clone)]
pub struct ServerState {
    pub app_handle: AppHandle,
    pub webdav_creds: Arc<std::sync::Mutex<Option<WebDavCreds>>>,
    /// Secret required on every REST request. Shared between the HTTP server
    /// and the Tauri commands so the UI always shows the token actually in use.
    pub pairing_token: Arc<std::sync::Mutex<String>>,
    /// Whether the HTTP listener is bound *right now*. The UI used to assume it
    /// was, so a failed bind (port already taken) still showed as running.
    pub listening: Arc<std::sync::atomic::AtomicBool>,
}

impl ServerState {
    pub fn new(app_handle: AppHandle) -> Arc<Self> {
        Arc::new(Self {
            app_handle,
            webdav_creds: Arc::new(std::sync::Mutex::new(None)),
            pairing_token: Arc::new(std::sync::Mutex::new(crate::auth::load_or_create_token())),
            listening: Arc::new(std::sync::atomic::AtomicBool::new(false)),
        })
    }
}

/// Port the REST API listens on. Shared so the pairing payload can never
/// advertise a port the server is not actually bound to.
pub const SERVER_PORT: u16 = 8000;

#[derive(Serialize, Deserialize)]
pub struct ClipboardContent {
    pub text: String,
}

/// Everything a device needs to pair, delivered in one call so the UI never
/// assembles a half-populated QR code.
#[derive(Serialize, Clone)]
pub struct PairingInfo {
    pub name: String,
    pub host: String,
    pub ip: String,
    pub port: u16,
    pub token: String,
    /// Stable machine identifier, so a paired device can confirm it is talking
    /// to the PC it paired with even after that PC is renamed.
    pub id: String,
}

/// Addresses for display in the UI. Carries no secret, so it can be used by
/// any surface that just needs to show or copy where this PC lives.
#[derive(Serialize, Clone)]
pub struct DeviceInfo {
    pub name: String,
    pub host: String,
    pub ip: String,
    pub port: u16,
}

#[derive(Serialize, Clone)]
pub struct LogEvent {
    pub message: String,
    pub kind: String, // "info", "error", "success"
}

/// Structured transfer event consumed by the history feed. Replaces the
/// previous approach of regex-parsing human-readable log strings.
#[derive(Serialize, Clone)]
pub struct TransferEvent {
    pub kind: String,        // "text" | "image" | "file"
    pub direction: String,   // "incoming" | "outgoing"
    pub target: String,      // "clipboard" | "folder"
    pub name: Option<String>,
    pub path: Option<String>,
    pub size: Option<u64>,
}

// Server Control State
pub struct ServerControl {
    pub tx: std::sync::Mutex<Option<tokio::sync::broadcast::Sender<()>>>,
    pub app_handle: AppHandle,
}

impl ServerControl {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            tx: std::sync::Mutex::new(None),
            app_handle,
        }
    }
}
