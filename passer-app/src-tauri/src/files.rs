use axum::{
    extract::{State, Multipart},
    http::StatusCode,
    Json,
};
use std::sync::Arc;
use tauri::Emitter;

use crate::types::{ServerState, LogEvent, TransferEvent};
use crate::paths::{get_downloads_dir, get_target_dir, get_unique_file_path};

pub async fn push_file(
    State(state): State<Arc<ServerState>>,
    mut multipart: Multipart,
) -> (StatusCode, Json<serde_json::Value>) {
    let download_base = get_downloads_dir();
    let mut saved_files: Vec<String> = Vec::new();
    let mut count = 0;

    while let Some(field_result) = multipart.next_field().await.transpose() {
        match field_result {
            Ok(field) => {
                let content_type = field.content_type().unwrap_or("application/octet-stream").to_string();
                let raw_filename = field.file_name().unwrap_or("unknown_file").to_string();
                let _field_name = field.name().unwrap_or("unknown_field").to_string();

                // Security: keep only the base name so a client cannot escape the target
                // directory via path separators, `..`, or an absolute path.
                let filename = std::path::Path::new(&raw_filename)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .filter(|n| !n.is_empty() && *n != "." && *n != "..")
                    .unwrap_or("unknown_file")
                    .to_string();
                
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
                            // Structured event for the history feed.
                            let _ = state.app_handle.emit("transfer", TransferEvent {
                                kind: "file".to_string(),
                                direction: "incoming".to_string(),
                                target: "folder".to_string(),
                                name: Some(filename.clone()),
                                path: Some(target_path.to_string_lossy().to_string()),
                                size: Some(bytes.len() as u64),
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
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "status": "error", "message": "No files saved" })),
        );
    }

    let _ = state.app_handle.emit("log", LogEvent {
        message: format!("PUSH: Received {} files. Injecting to Clipboard...", count),
        kind: "success".to_string(),
    });

    let paths_clone = saved_files.clone();

    // Inject the received files into the Windows clipboard as a native file list
    // (CF_HDROP) via clipboard-win. This replaces the previous `Set-Clipboard`
    // PowerShell call, which allowed command injection through crafted filenames.
    let clipboard_res = tokio::task::spawn_blocking(move || -> Result<usize, String> {
        use clipboard_win::Setter;

        // Smart append: start from whatever is already on the clipboard, then add
        // the new files (deduplicated) so successive pushes accumulate.
        let mut final_paths: Vec<String> =
            clipboard_win::get_clipboard::<Vec<String>, _>(clipboard_win::formats::FileList)
                .unwrap_or_default();
        for new_p in paths_clone {
            if !final_paths.contains(&new_p) {
                final_paths.push(new_p);
            }
        }

        let _clip = clipboard_win::Clipboard::new_attempts(10)
            .map_err(|e| format!("Open clipboard: {}", e))?;
        let _ = clipboard_win::raw::empty();
        clipboard_win::formats::FileList
            .write_clipboard(&final_paths)
            .map_err(|e| format!("Set FileList: {}", e))?;

        Ok(final_paths.len())
    })
    .await;

    // The files are on disk by this point, which is what the caller asked for.
    // Clipboard injection is a convenience on top, so its failure is reported
    // in the body rather than by failing the whole transfer.
    match clipboard_res {
        Ok(Ok(_)) => (
            StatusCode::OK,
            Json(serde_json::json!({ "status": "success", "count": count })),
        ),
        Ok(Err(e)) => {
             let _ = state.app_handle.emit("log", LogEvent {
                message: format!("Clipboard injection failed: {}", e),
                kind: "error".to_string(),
            });
            (
                StatusCode::OK,
                Json(serde_json::json!({ "status": "success", "count": count, "clipboard_error": e })),
            )
        },
        Err(e) => (
            StatusCode::OK,
            Json(serde_json::json!({
                "status": "success",
                "count": count,
                "clipboard_error": format!("Thread Error: {}", e)
            })),
        ),
    }
}
