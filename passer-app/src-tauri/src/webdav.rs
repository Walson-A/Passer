use axum::{
    Router,
    body::Body,
    http::{Request, Response, HeaderValue, Method, StatusCode},
};
use std::net::SocketAddr;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use dav_server::{localfs::LocalFs, DavHandler};
use rand::Rng;

use crate::types::{ServerState, WebDavCreds};
use crate::paths::get_webdav_dir;

#[allow(dead_code)]
pub async fn start_webdav_server(app_handle: AppHandle, state: Arc<ServerState>) {
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
    let handler = move |mut req: Request<Body>| {
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
            let resp = dav_server.handle(req).await;
            
            // 4. Convert Response
            let (parts, body) = resp.into_parts();
            let new_body = Body::new(body);
            
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
#[allow(dead_code)]
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
