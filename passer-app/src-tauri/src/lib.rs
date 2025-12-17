
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
    let user_profile = std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\".to_string());
    let path = PathBuf::from(user_profile).join("Desktop").join("PasserFiles");
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

use std::io::Write;

async fn pull_clipboard(State(state): State<Arc<ServerState>>) -> impl axum::response::IntoResponse {
    let state_clone = state.clone();
    
    // Use proper error handling in spawned task
    let result = tokio::task::spawn_blocking(move || {
        // 1. Check for Files (via Native Windows API)
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
                    .compression_method(zip::CompressionMethod::Stored);

                for path_str in file_paths {
                    let path = std::path::Path::new(&path_str);
                    if path.exists() && path.is_file() {
                        let filename = path.file_name().unwrap_or_default().to_string_lossy();
                        if let Ok(_) = zip.start_file(filename, options) {
                            if let Ok(content) = fs::read(path) {
                                let _ = zip.write_all(&content);
                            }
                        }
                    }
                }

                if let Ok(_) = zip.finish() {
                    return Ok::<(&str, Vec<u8>), String>(("application/zip", zip_buffer));
                }
            }
        }

        let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;

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
               return Ok(("image/png", png_buffer));
            }
        }

        // 3. Fallback to Text
        let text = clipboard.get_text().unwrap_or_default();
        let json = serde_json::json!({ "text": text });
        Ok(("application/json", serde_json::to_vec(&json).unwrap()))
    })
    .await;

    match result {
        Ok(Ok((content_type, body))) => {
             // Log success
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
        },
        _ => {
             // Fallback error response
             let _ = state.app_handle.emit("log", LogEvent {
                message: "PULL: Failed to read clipboard or internal error".to_string(),
                kind: "error".to_string(),
            });
            ([(axum::http::header::CONTENT_TYPE, "application/json")], serde_json::to_vec(&serde_json::json!({"error": "Failed to read clipboard"})).unwrap())
        }
    }
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

    let result = tokio::task::spawn_blocking(move || {
        let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
        clipboard.set_text(text).map_err(|e| e.to_string())
    })
    .await;

    match result {
        Ok(Ok(_)) => Json(serde_json::json!({ "status": "success" })),
        Ok(Err(e)) => {
            Json(serde_json::json!({ "status": "error", "message": format!("Clipboard error: {}", e) }))
        },
        Err(e) => {
             Json(serde_json::json!({ "status": "error", "message": format!("Task join error: {}", e) }))
        }
    }
}

async fn push_image(
    State(state): State<Arc<ServerState>>,
    mut multipart: Multipart,
) -> Json<serde_json::Value> {
    let mut image_bytes = Vec::new();

    while let Some(field) = multipart.next_field().await.unwrap_or(None) {
        if let Some(content_type) = field.content_type() {
            if content_type.starts_with("image/") {
                let _ = state.app_handle.emit("log", LogEvent {
                    message: format!("Receiving image type: {}", content_type),
                    kind: "info".to_string(),
                });

                if let Ok(bytes) = field.bytes().await {
                    image_bytes = bytes.to_vec();
                    break;
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

    let processed = tokio::task::spawn_blocking(move || {
        let img = image::load_from_memory(&image_bytes).map_err(|e| format!("Decode: {}", e))?;
        let rgba = img.into_rgba8();
        let (w, h) = rgba.dimensions();
        let params = arboard::ImageData {
            width: w as usize,
            height: h as usize,
            bytes: Cow::Owned(rgba.into_vec()),
        };

        let mut clipboard = arboard::Clipboard::new().map_err(|e| format!("Clipboard Init: {}", e))?;
        clipboard.set_image(params).map_err(|e| format!("Clipboard Set: {}", e))
    })
    .await;

    match processed {
        Ok(Ok(_)) => Json(serde_json::json!({ "status": "success" })),
        Ok(Err(e)) => {
             let _ = state.app_handle.emit("log", LogEvent {
                message: format!("PUSH (Image) failed: {}", e),
                kind: "error".to_string(),
            });
            Json(serde_json::json!({ "status": "error", "message": e }))
        },
        Err(e) => {
             let _ = state.app_handle.emit("log", LogEvent {
                message: format!("PUSH (Image) fatal: {}", e),
                kind: "error".to_string(),
            });
            Json(serde_json::json!({ "status": "error", "message": "Internal Server Error" }))
        }
    }
}

async fn push_file(
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


async fn start_server(app_handle: AppHandle) {
    let state = Arc::new(ServerState { app_handle: app_handle.clone() });

    let app = Router::new()
        .route("/pull", get(pull_clipboard))
        .route("/push", post(push_clipboard))
        .route("/push/image", post(push_image))
        .route("/push/file", post(push_file))
        .layer(axum::extract::DefaultBodyLimit::disable())
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 8000));
    
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

// --- mDNS Helper ---
fn init_mdns() {
    std::thread::spawn(|| {
        if let Ok(mdns) = mdns_sd::ServiceDaemon::new() {
            // Advertise "passer.local" service
            // Service Type: _passer._tcp.local.
            // Instance Name: passer
            // Port: 8000
            let service_type = "_passer._tcp.local.";
            let instance_name = "passer";
            let host_name = "passer.local.";
            let port = 8000;
            let properties = [("version", "1.0")];

            let my_ip = local_ip_address::local_ip().unwrap_or("127.0.0.1".parse().unwrap());
            
            // Create service info
            // Note: hostname is tricky, mdns-sd might force the OS hostname or allow custom.
            // standard register uses the default logic.
            
            // Explicitly constructing ServiceInfo to try and satisfy "passer.local" requirement
            if let Ok(service_info) = mdns_sd::ServiceInfo::new(
                service_type,
                instance_name,
                host_name,
                my_ip.to_string().as_str(),
                port,
                &properties[..]
            ) {
                if let Err(e) = mdns.register(service_info) {
                    eprintln!("mDNS Register Error: {}", e);
                } else {
                    println!("mDNS Service Registered: {}.{} -> {}", instance_name, service_type, host_name);
                }
                
                // Keep the daemon alive
                loop {
                    std::thread::sleep(std::time::Duration::from_secs(60));
                }
            }
        }
    });
}

#[tauri::command]
fn get_ip() -> String {
    local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|_| "Unknown".to_string())
}

#[tauri::command]
async fn open_downloads(_app_handle: AppHandle) -> Result<(), String> {
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_ip, open_downloads])
        .setup(|app| {
            // Start mDNS
            init_mdns();

            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                start_server(handle).await;
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
