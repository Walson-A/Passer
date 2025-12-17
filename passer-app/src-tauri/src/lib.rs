
mod types;
mod paths;
mod clipboard;
mod files;
mod server;
mod webdav;
mod mdns;
mod commands;
mod tray;

pub use types::*;
pub use paths::*;

use tauri::{
    Manager,
    WindowEvent,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec![]))) 
        .invoke_handler(tauri::generate_handler![
            commands::get_ip,
            commands::open_downloads,
            commands::open_webdav,
            commands::get_webdav_creds
        ])
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                window.hide().unwrap();
                api.prevent_close();
            }
        })
        .setup(|app| {
            // Initialize mDNS
            mdns::init_mdns();

            // Enable Auto-Start
            let _ = app.autolaunch().enable();
            
            // Start HTTP Server
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
               server::start_server(handle).await;
            });
            
            // Setup System Tray
            tray::setup_tray(app)?;
            
            // Init and manage state for Tauri commands
            let state = ServerState::new(app.handle().clone());
            app.manage(state);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
