
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
use tauri::{
    Emitter, AppHandle, Manager, 
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent, MouseButton},
    WindowEvent,
};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_autostart::ManagerExt;

#[derive(Clone, serde::Serialize, serde::Deserialize)]
struct WebDavCreds {
    port: u16,
    user: String,
    pass: String,
}

// Shared state
#[derive(Clone)]
struct ServerState {
    app_handle: AppHandle,
    webdav_creds: Arc<std::sync::Mutex<Option<WebDavCreds>>>,
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

// --- Helper: Get Base Dirs ---
fn get_passer_base_dir() -> PathBuf {
    let user_profile = std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\".to_string());
    PathBuf::from(user_profile).join("Desktop").join("Passer")
}

fn get_downloads_dir() -> PathBuf {
    let path = get_passer_base_dir().join("Passboard"); // For Push/Pull
    let _ = fs::create_dir_all(&path);
    path
}

fn get_webdav_dir() -> PathBuf {
    let path = get_passer_base_dir().join("Passer Space"); // For WebDAV
    let _ = fs::create_dir_all(&path);
    path
}

// --- Helper: Sort into Subfolders (Legacy) ---
// Now we just dump into Passboard flat or keep logic? User said "Passboard pour les fichiers Push/Pull".
// Let's keep subfolders inside Passboard for organization if desired, or flatten. 
// User instruction: "C:\Users\Walson\Desktop\Passer\Passboard pour les fichiers de Push et Pass"
// I will keep the subfolder logic relative to get_downloads_dir() for now to avoid breaking existing flow.
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
    let state = Arc::new(ServerState {
        app_handle: app_handle.clone(),
        webdav_creds: Arc::new(std::sync::Mutex::new(None)),
    });

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

// --- WebDAV Server ---
use dav_server::{localfs::LocalFs, DavHandler};
use rand::Rng;
// ... (imports are fine, we use axum::* already)
// We need to import Body for manual construction if needed, or let Axum infer.
use axum::body::Body;
use axum::http::{Request, Response, HeaderValue, Method, StatusCode};

async fn start_webdav_server(app_handle: AppHandle, state: Arc<ServerState>) {
    let webdav_dir = get_webdav_dir();
    
    // Generate Random Password
    let password: String = rand::thread_rng()
        .sample_iter(&rand::distributions::Alphanumeric)
        .take(6)
        .map(char::from)
        .collect();
    
    let creds = WebDavCreds {
        port: 8001,
        user: "passer".to_string(),
        pass: password.clone(),
    };

    // Store in State for retrieval
    if let Ok(mut lock) = state.webdav_creds.lock() {
        *lock = Some(creds.clone());
    }
    
    // Send Creds to Frontend (Event)
    let _ = app_handle.emit("webdav-creds", creds);

    let dav_server = DavHandler::builder()
        .filesystem(LocalFs::new(webdav_dir, false, false, false))
        .locksystem(dav_server::fakels::FakeLs::new())
        .build_handler();
        
    let dav_server = Arc::new(dav_server);

    // Axum Handler
    let handler = move |mut req: Request<Body>| { // Request<Body>
        let dav_server = dav_server.clone();
        let pass = password.clone();
        async move {
            // 1. Basic Auth Check
            let auth_header = req.headers().get("authorization")
                .and_then(|h| h.to_str().ok());
            
            let authorized = if let Some(auth) = auth_header {
                 verify_basic_auth(auth, "passer", &pass).is_some()
            } else {
                 false
            };

            if !authorized {
                 return Response::builder()
                    .status(StatusCode::UNAUTHORIZED)
                    .header("WWW-Authenticate", "Basic realm=\"Passer Space\"")
                    .body(Body::empty())
                    .unwrap();
            }

            // 2. Fix Depth Header (iOS fix)
            if req.method() == Method::from_bytes(b"PROPFIND").unwrap() {
                 let fix_depth = req.headers().get("depth")
                     .and_then(|h| h.to_str().ok())
                     .map(|s| s == "infinity")
                     .unwrap_or(true); // Default to true if missing
                 
                 if fix_depth {
                     req.headers_mut().insert("depth", HeaderValue::from_static("1"));
                 }
            }
            
            // 3. Forward to DavServer
            // We need to map the Request<axum::body::Body> to Request<dav_server::body::Body>
            // or rely on compatibility.
            // dav_server 0.7 expects http::Request<B>. 
            // We'll try passing it directly. If types mismatch, we'll map body.
            
            let resp = dav_server.handle(req).await;
            
            // 4. Convert Response
            let (parts, body) = resp.into_parts();
            let new_body = Body::new(body); // Wrap dav_server body into axum Body
            
            Response::from_parts(parts, new_body)
        }
    };

    let app = Router::new().fallback(handler);

    println!("[WEBDAV] Starting on :8001");
    let addr = SocketAddr::from(([0, 0, 0, 0], 8001));
    if let Ok(listener) = tokio::net::TcpListener::bind(addr).await {
        if let Err(e) = axum::serve(listener, app).await {
             eprintln!("[WEBDAV] Error: {}", e);
        }
    } else {
        eprintln!("[WEBDAV] Failed to bind :8001");
    }
}

// Auth Helpers
fn verify_basic_auth(header: &str, expected_user: &str, expected_pass: &str) -> Option<()> {
    use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64_STANDARD};
    if !header.starts_with("Basic ") { return None; }
    let b64 = &header[6..];
    if let Ok(decoded) = BASE64_STANDARD.decode(b64) {
        if let Ok(creds) = String::from_utf8(decoded) {
             let expected = format!("{}:{}", expected_user, expected_pass);
             if creds == expected { return Some(()); }
        }
    }
    None
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

#[tauri::command]
async fn get_webdav_creds(state: tauri::State<'_, Arc<ServerState>>) -> Result<Option<WebDavCreds>, String> {
    if let Ok(lock) = state.webdav_creds.lock() {
        Ok(lock.clone())
    } else {
        Err("Failed to lock state".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[tauri::command]
async fn open_webdav() {
    let path = get_webdav_dir();
    if let Err(e) = open::that(&path) {
        eprintln!("Failed to open WebDAV dir: {}", e);
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec![]))) 
        .invoke_handler(tauri::generate_handler![get_ip, open_downloads, open_webdav, get_webdav_creds])
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                window.hide().unwrap();
                api.prevent_close();
            }
        })
        .setup(|app| {
            init_mdns();

            // Init State
            let state = Arc::new(ServerState {
                 app_handle: app.handle().clone(),
                 webdav_creds: Arc::new(std::sync::Mutex::new(None)),
            });

            // AppState management if needed (currently we pass state manually to closures)
            // But Axum handlers use their own state injection. 
            // We need to ensure consistency. The start_server function creates its own Arc<ServerState> currently?
            // Let's optimize: We should share the SAME state instance.
            init_mdns();

            // Enable Auto-Start
            let _ = app.autolaunch().enable();
            
            let handle = app.handle().clone();
            // let handle2 = app.handle().clone();
            // let state_for_webdav = state.clone();
            // let state_for_server = state.clone(); // If start_server uses it (it creates its own now, check signature)

            // WebDAV disabled by default (SMB Priority)
            // tauri::async_runtime::spawn(async move {
            //     start_webdav_server(handle2, state_for_webdav).await;
            // });
            
            // start_server creates its own state in "main.rs" logic? No, let's see start_server signature in previous steps.
            tauri::async_runtime::spawn(async move {
               start_server(handle).await; // Current start_server creates its own state. That's fine for now, they are disparate.
            });
            
            // Register state with tauri? Not strictly needed unless commands access it via State<T>
            app.manage(state);

            // --- System Tray Setup ---
            let show_i = MenuItem::with_id(app, "show", "Open Passer", true, None::<&str>).unwrap();
            let folder_i = MenuItem::with_id(app, "folder", "Open Passer Folder", true, None::<&str>).unwrap();
            let status_i = MenuItem::with_id(app, "status", "Status: Online", false, None::<&str>).unwrap(); // Disabled
            let copy_i = MenuItem::with_id(app, "copy", "Copy Connection Info", true, None::<&str>).unwrap();
            let quit_i = MenuItem::with_id(app, "quit", "Quit Passer", true, None::<&str>).unwrap();
            
            let menu = Menu::with_items(app, &[
                &show_i, 
                &folder_i, 
                &status_i, 
                &copy_i, 
                &quit_i
            ]).unwrap();

            let _tray = TrayIconBuilder::new()
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
                .build(app);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
