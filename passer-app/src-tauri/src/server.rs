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

pub async fn start_server(app_handle: AppHandle, mut rx: tokio::sync::broadcast::Receiver<()>) {
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
            
            // Serve with graceful shutdown
            if let Err(e) = axum::serve(listener, app)
                .with_graceful_shutdown(async move {
                    let _ = rx.recv().await;
                    println!(" [SERVER] Shutdown signal received");
                })
                .await 
            {
                eprintln!(" [SERVER] Error serving: {}", e);
            }
            
            let _ = app_handle.emit("server-stopped", ());
            let _ = app_handle.emit("log", LogEvent {
                message: "Server stopped.".to_string(),
                kind: "info".to_string(),
            });
        },
        Err(e) => {
            // Check if it's a port already in use error
            let err_msg = if e.kind() == std::io::ErrorKind::AddrInUse {
                format!(
                    "Port 8000 is already in use. Please close the application using this port and restart Passer.\n\nError details: {}",
                    e
                )
            } else {
                format!(
                    "Failed to start server on port 8000.\n\nError: {}\n\nPlease check your network configuration and firewall settings.",
                    e
                )
            };
            
            eprintln!(" [SERVER] FATAL ERROR: {}", err_msg);
            let _ = app_handle.emit("log", LogEvent {
                message: err_msg.clone(),
                kind: "error".to_string(),
            });
        }
    }
}
