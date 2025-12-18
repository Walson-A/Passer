
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
            commands::open_downloads,
            commands::open_webdav,
            commands::get_webdav_creds,
            commands::handle_file_drop,
            commands::set_window_on_top
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

            // Position Window at Bottom Right (Smart + Margin)
            let window = app.get_webview_window("main").unwrap();
            let handle = window.clone();
            
            tauri::async_runtime::spawn(async move {
                std::thread::sleep(std::time::Duration::from_millis(150));
                
                if let Ok(Some(monitor)) = handle.current_monitor() {
                     // Get Work Area (excludes Taskbar)
                     let work_area = monitor.work_area();
                     {
                        let window_size = handle.outer_size().unwrap();
                        let margin = 0; // Flush with screen edge & taskbar
                        
                        // Calculate position relative to Work Area
                        let x = work_area.position.x + work_area.size.width as i32 - window_size.width as i32 - margin;
                        let y = work_area.position.y + work_area.size.height as i32 - window_size.height as i32 - margin;
                        
                        let _ = handle.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }));
                     }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
