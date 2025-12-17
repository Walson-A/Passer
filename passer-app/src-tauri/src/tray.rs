use tauri::{
    App, Manager,
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent, MouseButton},
};

use crate::paths::get_passer_base_dir;

pub fn setup_tray(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    let show_i = MenuItem::with_id(app, "show", "Open Passer", true, None::<&str>)?;
    let folder_i = MenuItem::with_id(app, "folder", "Open Passer Folder", true, None::<&str>)?;
    let status_i = MenuItem::with_id(app, "status", "Status: Online", false, None::<&str>)?; // Disabled
    let copy_i = MenuItem::with_id(app, "copy", "Copy Connection Info", true, None::<&str>)?;
    let quit_i = MenuItem::with_id(app, "quit", "Quit Passer", true, None::<&str>)?;
    
    let menu = Menu::with_items(app, &[
        &show_i, 
        &folder_i, 
        &status_i, 
        &copy_i, 
        &quit_i
    ])?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
             match event.id.as_ref() {
                "show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "folder" => {
                     // Open root "Passer" folder
                     let path = get_passer_base_dir();
                     #[cfg(target_os = "windows")]
                     let _ = std::process::Command::new("explorer").arg(&path).spawn();
                     #[cfg(target_os = "macos")]
                     let _ = std::process::Command::new("open").arg(&path).spawn();
                }
                "copy" => {
                    // Copy smb://passer.local
                    if let Ok(mut clipboard) = arboard::Clipboard::new() {
                        let _ = clipboard.set_text("smb://passer.local");
                    }
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
             }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, .. } = event {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}
