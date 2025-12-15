
use axum::{
    extract::{State, Json},
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tauri::{Emitter, AppHandle};

// Shared state for Axum to access Tauri AppHandle
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

// --- Axum Handlers ---

async fn pull_clipboard(State(state): State<Arc<ServerState>>) -> Json<ClipboardContent> {
    // Run clipboard op in blocking thread to be safe
    let text = tokio::task::spawn_blocking(|| {
        let mut clipboard = arboard::Clipboard::new().unwrap();
        clipboard.get_text().unwrap_or_default()
    })
    .await
    .unwrap_or_default();

    // Log to GUI
    let _ = state.app_handle.emit("log", LogEvent {
        message: format!("PULL requested. Sending: {:.50}...", text),
        kind: "info".to_string(),
    });

    Json(ClipboardContent { text })
}

async fn push_clipboard(
    State(state): State<Arc<ServerState>>,
    Json(payload): Json<ClipboardContent>,
) -> Json<serde_json::Value> {
    let text = payload.text.clone();

    // Log to GUI
    let _ = state.app_handle.emit("log", LogEvent {
        message: format!("PUSH received: {:.50}...", text),
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

async fn start_server(app_handle: AppHandle) {
    let state = Arc::new(ServerState { app_handle: app_handle.clone() });

    let app = Router::new()
        .route("/pull", get(pull_clipboard))
        .route("/push", post(push_clipboard))
        .layer(CorsLayer::permissive()) // Allow iPhone
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 8000));
    
    // Log startup
    let _ = app_handle.emit("log", LogEvent {
        message: format!("Server starting on http://0.0.0.0:8000"),
        kind: "info".to_string(),
    });

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
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
