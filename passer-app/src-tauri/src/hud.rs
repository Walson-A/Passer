//! The transfer HUD: a small always-on-top window that appears in the corner
//! of the screen when something is transferred while the main window is out of
//! sight.
//!
//! It loads the same `index.html` as the main window and is told apart by its
//! label, so there is one frontend bundle rather than two.

use std::sync::Arc;
use tauri::{AppHandle, Manager, PhysicalPosition, Position};

use crate::types::{LastTransfer, ServerState, TransferEvent};

pub const HUD_LABEL: &str = "hud";
pub const MAIN_LABEL: &str = "main";

/// Gap kept between the HUD *window* and the edges of the usable screen.
///
/// Zero on purpose: the card already sits 32px inside this window so its shadow
/// has room to fall off, and adding a window inset on top would push the visible
/// card ~48px off the corner, which reads as detached rather than docked.
const MARGIN: i32 = 0;

/// Places the HUD at the bottom-right of the *work area*.
///
/// `work_area()` excludes the taskbar; `monitor.size()` does not, and would
/// slide the window underneath it - or require guessing the taskbar's height,
/// which breaks the moment it is moved, hidden, or scaled differently.
fn position_bottom_right(window: &tauri::WebviewWindow) -> Result<(), String> {
    let monitor = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "No monitor found".to_string())?;

    let work_area = monitor.work_area();
    let size = window.outer_size().map_err(|e| e.to_string())?;

    let x = work_area.position.x + work_area.size.width as i32 - size.width as i32 - MARGIN;
    let y = work_area.position.y + work_area.size.height as i32 - size.height as i32 - MARGIN;

    window
        .set_position(Position::Physical(PhysicalPosition { x, y }))
        .map_err(|e| e.to_string())
}

/// True when the main window is on screen, in which case the HUD stays away:
/// its whole purpose is to report what happens while Passer is not visible.
fn main_window_is_visible(app: &AppHandle) -> bool {
    app.get_webview_window(MAIN_LABEL)
        .and_then(|w| w.is_visible().ok())
        .unwrap_or(false)
}

/// Records a transfer and surfaces the HUD for it.
///
/// Driven from Rust rather than from the HUD's own webview: while the window is
/// hidden that webview is throttled and does not process the event, so asking it
/// to show itself could never work. Rust shows the window first; the frontend
/// then fetches what to draw via `get_last_transfer`.
pub fn notify(app: &AppHandle, state: &Arc<ServerState>, event: &TransferEvent) {
    if let Ok(mut slot) = state.last_transfer.lock() {
        let seq = slot.as_ref().map(|l| l.seq + 1).unwrap_or(1);
        *slot = Some(LastTransfer { seq, transfer: event.clone() });
    }

    if main_window_is_visible(app) {
        return;
    }

    if let Some(window) = app.get_webview_window(HUD_LABEL) {
        if let Err(e) = position_bottom_right(&window) {
            eprintln!(" [HUD] positioning failed: {}", e);
        }
        match window.show() {
            Ok(()) => println!(" [HUD] shown for a {} transfer", event.kind),
            Err(e) => eprintln!(" [HUD] show failed: {}", e),
        }

        // No event is sent to the window on purpose. Two attempts were made -
        // one immediately after `show()`, one 250ms later - and both reported
        // success while nothing in the webview ever received them. The HUD
        // polls `get_last_transfer` instead, which needs nothing delivered.
    }
}

/// What the HUD should currently display. Fetched on mount and whenever the
/// window becomes visible, because the event itself may have fired earlier.
#[tauri::command]
pub fn get_last_transfer(state: tauri::State<'_, Arc<ServerState>>) -> Option<LastTransfer> {
    state.last_transfer.lock().ok().and_then(|s| s.clone())
}

#[tauri::command]
pub fn hide_hud(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(HUD_LABEL) {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Brings the main window back, used when the HUD itself is clicked.
#[tauri::command]
pub fn focus_main_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(MAIN_LABEL) {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
    if let Some(hud) = app.get_webview_window(HUD_LABEL) {
        let _ = hud.hide();
    }
    Ok(())
}
