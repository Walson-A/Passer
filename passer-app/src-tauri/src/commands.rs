use std::sync::Arc;
use tauri::AppHandle;

use crate::types::{ServerState, WebDavCreds, ServerControl, LogEvent, PairingInfo, DeviceInfo, SERVER_PORT};
use crate::paths::{get_downloads_dir, get_webdav_dir, get_unique_file_path};
use crate::device;
use crate::server;
use tauri::Emitter;
use tauri_plugin_autostart::ManagerExt;

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
pub fn get_pairing_token(state: tauri::State<'_, Arc<ServerState>>) -> Result<String, String> {
    state
        .pairing_token
        .lock()
        .map(|t| t.clone())
        .map_err(|_| "Failed to lock pairing token".to_string())
}

/// Everything needed to pair a device, for the QR code / pairing screen.
#[tauri::command]
pub fn get_pairing_info(state: tauri::State<'_, Arc<ServerState>>) -> Result<PairingInfo, String> {
    let token = state
        .pairing_token
        .lock()
        .map(|t| t.clone())
        .map_err(|_| "Failed to lock pairing token".to_string())?;

    Ok(PairingInfo {
        name: device::display_name(),
        // mDNS name first (survives IP changes), raw IP kept as a fallback for
        // networks where .local resolution fails.
        host: device::mdns_host(),
        ip: get_ip(),
        port: SERVER_PORT,
        token,
        id: device::load_or_create_device_id(),
    })
}

/// Whether the HTTP listener is bound right now. Read on mount, because the
/// server may have started before the webview attached its event listeners.
#[tauri::command]
pub fn get_server_status(state: tauri::State<'_, Arc<ServerState>>) -> bool {
    state.listening.load(std::sync::atomic::Ordering::SeqCst)
}

/// Addresses for display in the UI. Unlike `get_pairing_info` this carries no
/// secret, so any surface that merely shows or copies an address can use it.
#[tauri::command]
pub fn get_device_info() -> DeviceInfo {
    DeviceInfo {
        name: device::display_name(),
        host: device::mdns_host(),
        ip: get_ip(),
        port: SERVER_PORT,
    }
}

/// Rotates the pairing token, immediately invalidating every paired device.
#[tauri::command]
pub fn regenerate_pairing_token(state: tauri::State<'_, Arc<ServerState>>) -> Result<String, String> {
    let new_token = crate::auth::generate_token();

    {
        let mut lock = state
            .pairing_token
            .lock()
            .map_err(|_| "Failed to lock pairing token".to_string())?;
        *lock = new_token.clone();
    }

    crate::auth::save_token(&new_token).map_err(|e| e.to_string())?;
    Ok(new_token)
}

#[tauri::command]
pub async fn toggle_server(
    state: tauri::State<'_, ServerControl>,
    server_state: tauri::State<'_, Arc<ServerState>>,
) -> Result<String, String> {
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
        let srv_state = (*server_state).clone();
        tauri::async_runtime::spawn(async move {
            server::start_server(app_handle, rx, srv_state).await;
        });
        
        // `server-started` is deliberately not emitted here: the bind can still
        // fail, and server.rs emits it only once the socket is really listening.
        let _ = state.app_handle.emit("log", LogEvent {
            message: "Server resumed by user.".to_string(),
            kind: "info".to_string(),
        });
        
        println!(" [SERVER] Resumed by user toggle");
        Ok("on".to_string())
    }
}

#[tauri::command]
pub fn get_autostart(app_handle: AppHandle) -> Result<bool, String> {
    app_handle.autolaunch().is_enabled().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_autostart(app_handle: AppHandle, enabled: bool) -> Result<(), String> {
    let manager = app_handle.autolaunch();
    if enabled {
        manager.enable().map_err(|e| e.to_string())
    } else {
        manager.disable().map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn get_app_version(app_handle: AppHandle) -> String {
    app_handle.package_info().version.to_string()
}

#[tauri::command]
pub async fn delete_cache_file(file_path: String) -> Result<(), String> {
    use crate::paths::get_cache_dir;
    use std::path::Path;
    
    let file_path_buf = Path::new(&file_path);

    // Nothing to do if the file is already gone.
    if !file_path_buf.exists() {
        return Ok(());
    }

    // Security: resolve both paths to their canonical form before comparing, so a
    // path containing `..` cannot escape the cache directory (component-based
    // `starts_with` alone would accept `<cache>/../../secret`).
    let cache_dir = std::fs::canonicalize(get_cache_dir())
        .map_err(|e| format!("Failed to resolve cache directory: {}", e))?;
    let target = std::fs::canonicalize(file_path_buf)
        .map_err(|e| format!("Failed to resolve file path: {}", e))?;

    if !target.starts_with(&cache_dir) {
        return Err("Invalid path: file is not in cache directory".to_string());
    }

    std::fs::remove_file(&target)
        .map_err(|e| format!("Failed to delete cache file: {}", e))?;
    println!(" [CACHE] Deleted: {:?}", target);

    Ok(())
}
