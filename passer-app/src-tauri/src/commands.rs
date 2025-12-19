use std::sync::Arc;
use tauri::AppHandle;

use crate::types::{ServerState, WebDavCreds, ServerControl, LogEvent};
use crate::paths::{get_downloads_dir, get_webdav_dir, get_unique_file_path};
use crate::server;
use tauri::Emitter;

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
            let initial_target = target_dir.join(filename);
            
            // Get unique file path to avoid collisions
            let target_path = get_unique_file_path(initial_target);
            
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

#[tauri::command]
pub async fn toggle_server(state: tauri::State<'_, ServerControl>) -> Result<String, String> {
    let mut tx_lock = state.tx.lock().map_err(|_| "Failed to lock server control".to_string())?;
    
    if let Some(tx) = tx_lock.as_ref() {
        // Server is running -> Stop it
        let _ = tx.send(());
        *tx_lock = None;
        println!(" [SERVER] Stopped by user toggle");
        // log emission is handled in server.rs 'server-stopped'
        // But we return state "off"
        Ok("off".to_string())
    } else {
        // Server is stopped -> Start it
        let (tx, rx) = tokio::sync::broadcast::channel(1);
        *tx_lock = Some(tx);
        
        let app_handle = state.app_handle.clone();
        tauri::async_runtime::spawn(async move {
            server::start_server(app_handle, rx).await;
        });
        
        // Emit events
        let _ = state.app_handle.emit("server-started", ());
        let _ = state.app_handle.emit("log", LogEvent {
            message: "Server resumed by user.".to_string(),
            kind: "info".to_string(),
        });
        
        println!(" [SERVER] Resumed by user toggle");
        Ok("on".to_string())
    }
}

#[tauri::command]
pub async fn delete_cache_file(file_path: String) -> Result<(), String> {
    use crate::paths::get_cache_dir;
    use std::path::Path;
    
    let cache_dir = get_cache_dir();
    let file_path_buf = Path::new(&file_path);
    
    // Security: Ensure the file is within the cache directory
    if !file_path_buf.starts_with(&cache_dir) {
        return Err("Invalid path: file is not in cache directory".to_string());
    }
    
    // Delete the file if it exists
    if file_path_buf.exists() {
        std::fs::remove_file(file_path_buf)
            .map_err(|e| format!("Failed to delete cache file: {}", e))?;
        println!(" [CACHE] Deleted: {:?}", file_path_buf);
    }
    
    Ok(())
}
