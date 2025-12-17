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
