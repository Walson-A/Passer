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

#[tauri::command]
pub async fn set_window_on_top(app_handle: tauri::AppHandle, state: bool) -> Result<(), String> {
    use tauri::Manager;
    if let Some(window) = app_handle.get_webview_window("main") {
        window.set_always_on_top(state).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Window not found".to_string())
    }
}
#[tauri::command]
pub async fn handle_file_drop(paths: Vec<String>) -> Result<(), String> {
    let target_dir = get_webdav_dir();
    
    for path_str in paths {
        let source_path = std::path::Path::new(&path_str);
        if source_path.exists() {
            let filename = source_path.file_name()
                .ok_or_else(|| "Invalid filename".to_string())?;
            let target_path = target_dir.join(filename);
            
            // If it's a file, copy it. If it's a directory, we might need recursive copy or just ignore.
            // For now, let's stick to files for simplicity and robustness.
            if source_path.is_file() {
                std::fs::copy(source_path, &target_path)
                    .map_err(|e| format!("Failed to copy file {:?}: {}", source_path, e))?;
            }
        }
    }
    
    Ok(())
}
