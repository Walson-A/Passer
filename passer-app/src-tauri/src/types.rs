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
}

impl ServerState {
    pub fn new(app_handle: AppHandle) -> Arc<Self> {
        Arc::new(Self {
            app_handle,
            webdav_creds: Arc::new(std::sync::Mutex::new(None)),
        })
    }
}

#[derive(Serialize, Deserialize)]
pub struct ClipboardContent {
    pub text: String,
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
