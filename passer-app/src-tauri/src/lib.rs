
use axum::{
    extract::{State, Json, Multipart},
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::Arc;
use std::borrow::Cow;
use std::path::PathBuf;
use std::fs;
use tower_http::cors::CorsLayer;
use tauri::{Emitter, AppHandle};

// Shared state
#[derive(Clone)]
struct ServerState {
    app_handle: AppHandle,
}

#[derive(Serialize, Deserialize)]
struct ClipboardContent {
    text: String,
}

#[derive(Serialize, Clone)]
struct LogEvent {
    message: String,
    kind: String, // "info", "error", "success"
}

// --- Helper: Get Download Dir ---
fn get_downloads_dir() -> PathBuf {
    // Basic implementation: UserProfile/Downloads/Passer_Received
    // In a real app we might use the `dirs` crate, but env var is fine for prototype
    let user_profile = std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\".to_string());
    let path = PathBuf::from(user_profile).join("Downloads").join("Passer_Received");
    let _ = fs::create_dir_all(&path);
    path
}

// --- Helper: Sort into Subfolders ---
fn get_target_dir(base: &PathBuf, content_type: &str, filename: &str) -> PathBuf {
    let lower_name = filename.to_lowercase();
    let sub = if content_type.starts_with("image/") || lower_name.ends_with(".png") || lower_name.ends_with(".jpg") || lower_name.ends_with(".jpeg") || lower_name.ends_with(".heic") {
        "Images"
    } else if content_type.starts_with("video/") || lower_name.ends_with(".mp4") || lower_name.ends_with(".mov") {
        "Videos"
    } else if content_type.starts_with("audio/") || lower_name.ends_with(".mp3") || lower_name.ends_with(".wav") {
        "Audio"
    } else if content_type.starts_with("application/pdf") || lower_name.ends_with(".pdf") || lower_name.ends_with(".doc") || lower_name.ends_with(".docx") {
        "Documents"
    } else {
        "Misc"
    };
    
    let path = base.join(sub);
    let _ = fs::create_dir_all(&path);
    path
}

use std::io::Write; // Ensure Write trait is imported for Zip

async fn pull_clipboard(State(state): State<Arc<ServerState>>) -> impl axum::response::IntoResponse {
    let state_clone = state.clone();
    let (content_type, body) = tokio::task::spawn_blocking(move || {
        // 1. Check for Files (via Native Windows API)
        // Using clipboard-win crate is much faster and reliable than PowerShell
        
        let file_list_result: Result<Vec<String>, _> = clipboard_win::get_clipboard(clipboard_win::formats::FileList);

        if let Ok(file_paths) = file_list_result {
            if !file_paths.is_empty() {
                 let _ = state_clone.app_handle.emit("log", LogEvent {
                    message: format!("Files detected via Clipboard API: {}", file_paths.len()),
                    kind: "info".to_string(),
                });

                // Files detected! Create a ZIP.
                let mut zip_buffer = Vec::new();
                let cursor = std::io::Cursor::new(&mut zip_buffer);
                let mut zip = zip::ZipWriter::new(cursor);
                
                let options = zip::write::SimpleFileOptions::default()
                    .compression_method(zip::CompressionMethod::Stored); // Faster, less CPU

                for path_str in file_paths {
                    let path = std::path::Path::new(&path_str);
                    if path.exists() && path.is_file() {
                        let filename = path.file_name().unwrap_or_default().to_string_lossy();
                        
                        // Start file in zip
                        if let Ok(_) = zip.start_file(filename, options) {
                            // Read file content
                            if let Ok(content) = fs::read(path) {
                                let _ = zip.write_all(&content);
                            }
                        }
                    }
                }

                if let Ok(_) = zip.finish() {
                    return ("application/zip", zip_buffer);
                }
            }
        }

        let mut clipboard = arboard::Clipboard::new().unwrap();

        // 2. Try Image
        if let Ok(image) = clipboard.get_image() {
            let mut png_buffer = Vec::new();
            let encoder = image::codecs::png::PngEncoder::new(&mut png_buffer);
            
            if let Ok(_) = image::ImageEncoder::write_image(
                encoder, 
                &image.bytes, 
                image.width as u32, 
                image.height as u32, 
                image::ColorType::Rgba8.into()
            ) {
               return ("image/png", png_buffer);
            }
        }

        // 3. Fallback to Text
        let text = clipboard.get_text().unwrap_or_default();
        let json = serde_json::json!({ "text": text });
        ("application/json", serde_json::to_vec(&json).unwrap())
    })
    .await
    .unwrap();

    // Log what we are sending
    let log_msg = if content_type == "application/zip" {
        format!("PULL: Sending ZIP Archive ({} bytes)", body.len())
    } else if content_type == "image/png" {
        format!("PULL: Sending Image ({} bytes)", body.len())
    } else {
        format!("PULL: Sending Text ({:.50}...)", String::from_utf8_lossy(&body))
    };

    let _ = state.app_handle.emit("log", LogEvent {
        message: log_msg,
        kind: "info".to_string(),
    });

    ([(axum::http::header::CONTENT_TYPE, content_type)], body)
}

async fn push_clipboard(
    State(state): State<Arc<ServerState>>,
    Json(payload): Json<ClipboardContent>,
) -> Json<serde_json::Value> {
    let text = payload.text.clone();

    let _ = state.app_handle.emit("log", LogEvent {
        message: format!("PUSH (Text) received: {:.50}...", text),
        kind: "success".to_string(),
    });

    tokio::task::spawn_blocking(move || {
        let mut clipboard = arboard::Clipboard::new().unwrap();
        if let Err(e) = clipboard.set_text(text) {
            eprintln!("Failed to set clipboard: {}", e);
        }
    })
    .await
    .unwrap();

    Json(serde_json::json!({ "status": "success" }))
}


async fn push_image(
    State(state): State<Arc<ServerState>>,
    mut multipart: Multipart,
) -> Json<serde_json::Value> {
    let mut image_bytes = Vec::new();

    // 1. Read Multipart Frame
    while let Some(field) = multipart.next_field().await.unwrap_or(None) {
        if let Some(content_type) = field.content_type() {
            if content_type.starts_with("image/") {
                // Log content type
                let _ = state.app_handle.emit("log", LogEvent {
                    message: format!("Receiving image type: {}", content_type),
                    kind: "info".to_string(),
                });

                if let Ok(bytes) = field.bytes().await {
                    image_bytes = bytes.to_vec();
                    break; // Only take the first image
                }
            }
        }
    }

    if image_bytes.is_empty() {
        let _ = state.app_handle.emit("log", LogEvent {
            message: "PUSH (Image) failed: No image data found".to_string(),
            kind: "error".to_string(),
        });
        return Json(serde_json::json!({ "status": "error", "message": "No image found" }));
    }

    let _ = state.app_handle.emit("log", LogEvent {
        message: format!("PUSH (Image) received: {} bytes", image_bytes.len()),
        kind: "success".to_string(),
    });

    // 2. Process & Clip Logic
    let processed = tokio::task::spawn_blocking(move || {
        match image::load_from_memory(&image_bytes) {
            Ok(img) => {
                let rgba = img.into_rgba8();
                let (w, h) = rgba.dimensions();
                let params = arboard::ImageData {
                    width: w as usize,
                    height: h as usize,
                    bytes: Cow::Owned(rgba.into_vec()),
                };

                let mut clipboard = arboard::Clipboard::new().unwrap();
                match clipboard.set_image(params) {
                    Ok(_) => Ok(()),
                    Err(e) => Err(format!("Clipboard set error: {}", e)),
                }
            },
            Err(e) => Err(format!("Image decode error: {}", e)),
        }
    })
    .await
    .unwrap();

    if let Err(e) = processed {
         let _ = state.app_handle.emit("log", LogEvent {
            message: format!("PUSH (Image) failed: {}", e),
            kind: "error".to_string(),
        });
        return Json(serde_json::json!({ "status": "error", "message": e }));
    }

    Json(serde_json::json!({ "status": "success" }))
}

async fn push_file(
    State(state): State<Arc<ServerState>>,
    mut multipart: Multipart,
) -> Json<serde_json::Value> {
    let download_base = get_downloads_dir();
    let mut saved_files: Vec<String> = Vec::new();
    let mut count = 0;

    // Process all files in the multipart form
    while let Some(field_result) = multipart.next_field().await.transpose() {
        match field_result {
            Ok(field) => {
                let content_type = field.content_type().unwrap_or("application/octet-stream").to_string();
                let filename = field.file_name().unwrap_or("unknown_file").to_string();
                let field_name = field.name().unwrap_or("unknown_field").to_string();
                
                let _ = state.app_handle.emit("log", LogEvent {
                    message: format!("Processing field: {} (File: {}, Type: {})", field_name, filename, content_type),
                    kind: "info".to_string(),
                });

                let target_dir = get_target_dir(&download_base, &content_type, &filename);
                let target_path = target_dir.join(&filename);
                
                if let Ok(bytes) = field.bytes().await {
                     match fs::write(&target_path, &bytes) {
                        Ok(_) => {
                            let _ = state.app_handle.emit("log", LogEvent {
                               message: format!("Saved to {:?}", target_path),
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
                } else {
                     let _ = state.app_handle.emit("log", LogEvent {
                        message: "Failed to read bytes from field".to_string(),
                        kind: "error".to_string(),
                    });
                }
            },
            Err(e) => {
                 let _ = state.app_handle.emit("log", LogEvent {
                    message: format!("Error reading multipart field: {}", e),
                    kind: "error".to_string(),
                });
                break; // Stop loop on error
            }
        }
    }

    if saved_files.is_empty() {
        let _ = state.app_handle.emit("log", LogEvent {
            message: "PUSH (Files) failed: No files saved".to_string(),
            kind: "error".to_string(),
        });
        return Json(serde_json::json!({ "status": "error", "message": "No files received" }));
    }

    let _ = state.app_handle.emit("log", LogEvent {
        message: format!("PUSH: Received {} files. Saving to Clipboard...", count),
        kind: "success".to_string(),
    });

    // Clipboard Injection (HDROP) with Smart Append
    let paths_clone = saved_files.clone();
    let _download_base_str = download_base.to_string_lossy().to_string(); // Check against download folder

    let clipboard_res = tokio::task::spawn_blocking(move || {
        use std::process::Command;

        // 1. Try to get current clipboard files (Smart Append)
        let mut final_paths = paths_clone.clone();
        
        // PowerShell command to get current file paths
        let read_cmd = "Get-Clipboard -Format FileDropList | Select-Object -ExpandProperty FullName";
        
        let output_read = Command::new("powershell")
            .args(["-NoProfile", "-Command", read_cmd])
            .output();

        if let Ok(o) = output_read {
            if o.status.success() {
                let stdout = String::from_utf8_lossy(&o.stdout);
                let current_lines: Vec<&str> = stdout.trim().split(|c| c == '\r' || c == '\n').filter(|s| !s.trim().is_empty()).collect();
                
                // Smart Append Logic: 
                // Only append if the clipboard contains files from our App (to avoid mess) OR if we decide to just append always.
                // Let's be aggressive: Append always if it's files.
                // Actually safer: Append if the current clipboard has at least 1 valid file path.
                
                if !current_lines.is_empty() {
                     // Check if they are valid paths (basic check)
                     let mut new_list: Vec<String> = current_lines.iter().map(|s| s.trim().to_string()).collect();
                     for new_f in &paths_clone {
                         // Avoid duplicates
                         if !new_list.contains(new_f) {
                             new_list.push(new_f.clone());
                         }
                     }
                     final_paths = new_list;
                }
            }
        }

        // 2. Set Clipboard with Final List
        let path_args = final_paths.join("\",\"");
        let formatted_paths = format!("\"{}\"", path_args); 
        
        let write_cmd = format!("Set-Clipboard -Path {}", formatted_paths);
        
        let output_write = Command::new("powershell")
            .args(["-NoProfile", "-Command", &write_cmd])
            .output();
            
        match output_write {
            Ok(o) => if o.status.success() { Ok(final_paths.len()) } else { Err(format!("PS Error: {:?}", o)) },
            Err(e) => Err(e.to_string()),
        }
    })
    .await
    .unwrap();
    
    // Note: I removed the direct clipboard-win usage inside the closure to swap to PowerShell strategy 
    // because encoding CF_HDROP manually in Rust is error-prone without `dropfiles` crate.
    // PowerShell is built-in and handles the OS complexity.

    if let Err(e) = clipboard_res {
         let _ = state.app_handle.emit("log", LogEvent {
            message: format!("Clipboard injection failed: {}", e),
            kind: "error".to_string(),
        });
        return Json(serde_json::json!({ "status": "error", "message": e }));
    }

    Json(serde_json::json!({ "status": "success", "count": count }))
}


async fn start_server(app_handle: AppHandle) {
    let state = Arc::new(ServerState { app_handle: app_handle.clone() });

    let app = Router::new()
        .route("/pull", get(pull_clipboard))
        .route("/push", post(push_clipboard))
        .route("/push/image", post(push_image))
        .route("/push/file", post(push_file))
        .layer(axum::extract::DefaultBodyLimit::disable()) // Allow unlimited body size
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 8000));
    
    // Log startup to Console AND Frontend
    println!(" [SERVER] Attempting to bind to http://0.0.0.0:8000"); 
    let _ = app_handle.emit("log", LogEvent {
        message: format!("Server starting on http://0.0.0.0:8000"),
        kind: "info".to_string(),
    });

    match tokio::net::TcpListener::bind(addr).await {
        Ok(listener) => {
            println!(" [SERVER] Listening on http://0.0.0.0:8000");
             let _ = app_handle.emit("log", LogEvent {
                message: "Server listening successfully!".to_string(),
                kind: "success".to_string(),
            });
            if let Err(e) = axum::serve(listener, app).await {
                eprintln!(" [SERVER] Error serving: {}", e);
            }
        },
        Err(e) => {
            let err_msg = format!("FAILED TO BIND PORT 8000: {}", e);
            eprintln!(" [SERVER] FATAL ERROR: {}", err_msg);
             let _ = app_handle.emit("log", LogEvent {
                message: err_msg,
                kind: "error".to_string(),
            });
        }
    }
}

#[tauri::command]
fn get_ip() -> String {
    local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|_| "Unknown".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_ip])
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                start_server(handle).await;
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
