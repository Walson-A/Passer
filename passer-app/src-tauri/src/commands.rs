use std::sync::Arc;
use tauri::AppHandle;

use crate::types::{ServerState, WebDavCreds};
use crate::paths::{get_downloads_dir, get_webdav_dir};

#[tauri::command]
pub fn get_ip() -> String {
    local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|_| "Unknown".to_string())
}

#[tauri::command]
pub async fn open_downloads(_app_handle: AppHandle) -> Result<(), String> {
    let path = get_downloads_dir();
    
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let _ = Command::new("explorer").arg(&path).spawn().map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let _ = Command::new("open").arg(&path).spawn().map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn get_webdav_creds(state: tauri::State<'_, Arc<ServerState>>) -> Result<Option<WebDavCreds>, String> {
    if let Ok(lock) = state.webdav_creds.lock() {
        Ok(lock.clone())
    } else {
        Err("Failed to lock state".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[tauri::command]
pub async fn open_webdav() {
    let path = get_webdav_dir();
    if let Err(e) = open::that(&path) {
        eprintln!("Failed to open WebDAV dir: {}", e);
    }
}
