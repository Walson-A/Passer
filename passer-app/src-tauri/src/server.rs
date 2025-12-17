use axum::{
    routing::{get, post},
    Router,
};
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;
use tauri::{AppHandle, Emitter};

use crate::types::{ServerState, LogEvent};
use crate::clipboard;
use crate::files;

pub async fn start_server(app_handle: AppHandle) {
    let state = ServerState::new(app_handle.clone());

    let app = Router::new()
        .route("/pull", get(clipboard::pull_clipboard))
        .route("/push", post(clipboard::push_clipboard))
        .route("/push/image", post(clipboard::push_image))
        .route("/push/file", post(files::push_file))
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
