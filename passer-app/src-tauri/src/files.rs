use axum::{
    extract::{State, Multipart},
    Json,
};
use std::sync::Arc;
use tauri::Emitter;

use crate::types::{ServerState, LogEvent};
use crate::paths::{get_downloads_dir, get_target_dir, get_unique_file_path};

pub async fn push_file(
    State(state): State<Arc<ServerState>>,
    mut multipart: Multipart,
) -> Json<serde_json::Value> {
    let download_base = get_downloads_dir();
    let mut saved_files: Vec<String> = Vec::new();
    let mut count = 0;

    while let Some(field_result) = multipart.next_field().await.transpose() {
        match field_result {
            Ok(field) => {
                let content_type = field.content_type().unwrap_or("application/octet-stream").to_string();
                let filename = field.file_name().unwrap_or("unknown_file").to_string();
                let _field_name = field.name().unwrap_or("unknown_field").to_string();
                
                let target_dir = get_target_dir(&download_base, &content_type, &filename);
                let initial_path = target_dir.join(&filename);
                
                // Get unique file path (handles collisions by renaming)
                let target_path = get_unique_file_path(initial_path);
                let was_renamed = target_path != target_dir.join(&filename);
                
                if let Ok(bytes) = field.bytes().await {
                     match std::fs::write(&target_path, &bytes) {
                        Ok(_) => {
                            let log_message = if was_renamed {
                                format!("Saved to {:?} ({} bytes) (renamed to avoid collision)", target_path, bytes.len())
                            } else {
                                format!("Saved to {:?} ({} bytes)", target_path, bytes.len())
                            };
                            let _ = state.app_handle.emit("log", LogEvent {
                               message: log_message,
                               kind: "info".to_string(),
                           });
                            saved_files.push(target_path.to_string_lossy().to_string());
                            count += 1;
                        },
                        Err(e) => {
                             let _ = state.app_handle.emit("log", LogEvent {
                                message: format!("Failed to write file: {}", e),
                                kind: "error".to_string(),
                            });
                        }
                     }
                }
            },
            Err(e) => {
                 let _ = state.app_handle.emit("log", LogEvent {
                    message: format!("Error reading multipart field: {}", e),
                    kind: "error".to_string(),
                });
                break;
            }
        }
    }

    if saved_files.is_empty() {
        return Json(serde_json::json!({ "status": "error", "message": "No files saved" }));
    }

    let _ = state.app_handle.emit("log", LogEvent {
        message: format!("PUSH: Received {} files. Injecting to Clipboard...", count),
        kind: "success".to_string(),
    });

    let paths_clone = saved_files.clone();
    
    // Use Native Clipboard (clipboard-win) instead of PowerShell
    let clipboard_res = tokio::task::spawn_blocking(move || {
        // We will try to APPEND to existing files if possible, similar to Smart Append
        // But for simplicity and robustness in "clean" version, let's just Set the new files.
        // If we want append, we read first.
        
        let mut final_paths = paths_clone;
        
        // Optional: Smart Append Logic (Native)
        if let Ok(existing_paths) = clipboard_win::get_clipboard::<Vec<String>, _>(clipboard_win::formats::FileList) {
             let mut current_set: Vec<String> = existing_paths.into_iter().collect();
             for new_p in &final_paths {
                 if !current_set.contains(new_p) {
                     current_set.push(new_p.clone());
                 }
             }
             final_paths = current_set;
        }

        // Set Clipboard using PowerShell (Native crate doesn't support Set FileList easily)
        let path_args = final_paths.join("\",\"");
        let formatted_paths = format!("\"{}\"", path_args); 
        
        // This command sets the clipboard to the list of files
        let write_cmd = format!("Set-Clipboard -Path {}", formatted_paths);
        
        let output_write = std::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", &write_cmd])
            .output();
            
        match output_write {
            Ok(o) => if o.status.success() { Ok(final_paths.len()) } else { Err(format!("PS Error: {:?}", o)) },
            Err(e) => Err(e.to_string()),
        }
    })
    .await;

    match clipboard_res {
        Ok(Ok(_)) => Json(serde_json::json!({ "status": "success", "count": count })),
        Ok(Err(e)) => {
             let _ = state.app_handle.emit("log", LogEvent {
                message: format!("Clipboard injection failed: {}", e),
                kind: "error".to_string(),
            });
            Json(serde_json::json!({ "status": "error", "message": e }))
        },
        Err(e) => Json(serde_json::json!({ "status": "error", "message": format!("Thread Error: {}", e) }))
    }
}
