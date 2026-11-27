use axum::{
    extract::{State, Json, Multipart},
    http::StatusCode,
    response::IntoResponse,
};
use std::sync::Arc;
use std::borrow::Cow;
use tauri::Emitter;

use crate::types::{ServerState, ClipboardContent, LogEvent, TransferEvent};
use crate::paths::get_cache_dir;

// Helper function to strip HTML tags and decode entities
fn strip_html_tags(html: &str) -> String {
    // Remove HTML tags using simple regex-like approach
    let mut text = String::new();
    let mut in_tag = false;
    
    for ch in html.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => text.push(ch),
            _ => {}
        }
    }
    
    // Decode HTML entities
    html_escape::decode_html_entities(&text).to_string()
}


/// The files copied in the Explorer (Ctrl+C), regular files only. Blocking.
pub fn copied_files() -> Vec<std::path::PathBuf> {
    #[cfg(target_os = "windows")]
    {
        if let Ok(paths) = clipboard_win::get_clipboard::<Vec<String>, _>(clipboard_win::formats::FileList) {
            return paths
                .into_iter()
                .map(std::path::PathBuf::from)
                .filter(|p| p.is_file())
                .collect();
        }
    }
    Vec::new()
}

/// The copied image, encoded as PNG, if there is one. Blocking.
pub fn clipboard_png() -> Option<Vec<u8>> {
    let image = arboard::Clipboard::new().ok()?.get_image().ok()?;
    let mut png = Vec::new();
    let encoder = image::codecs::png::PngEncoder::new(&mut png);
    image::ImageEncoder::write_image(
        encoder,
        &image.bytes,
        image.width as u32,
        image.height as u32,
        image::ColorType::Rgba8.into(),
    )
    .ok()?;
    Some(png)
}

/// The copied text; when there is no plain text, the HTML one without its tags
/// (what ChatGPT's copy button puts there). Blocking.
pub fn clipboard_text() -> Result<String, String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    let mut text = clipboard.get_text().unwrap_or_default();
    if text.trim().is_empty() {
        #[cfg(target_os = "windows")]
        {
            if let Some(format_id) = clipboard_win::register_format("HTML Format") {
                use clipboard_win::formats::RawData;
                if let Ok(html_bytes) = clipboard_win::get_clipboard::<Vec<u8>, _>(RawData(format_id.into())) {
                    if let Ok(html_text) = String::from_utf8(html_bytes) {
                        text = strip_html_tags(&html_text);
                    }
                }
            }
        }
    }
    Ok(text)
}

pub async fn pull_clipboard(State(state): State<Arc<ServerState>>) -> impl IntoResponse {
    let state_clone = state.clone();
    
    // Use proper error handling in spawned task
    let result = tokio::task::spawn_blocking(move || {
        // 1. Files copied in the Explorer, zipped.
        let file_paths = copied_files();
        if !file_paths.is_empty() {
            let _ = state_clone.app_handle.emit("log", LogEvent {
                message: format!("Files detected via Clipboard API: {}", file_paths.len()),
                kind: "info".to_string(),
            });
            let mut zip_buffer = Vec::new();
            let cursor = std::io::Cursor::new(&mut zip_buffer);
            let mut zip = zip::ZipWriter::new(cursor);
            let options = zip::write::SimpleFileOptions::default()
                .compression_method(zip::CompressionMethod::Stored);
            for path in &file_paths {
                let filename = path.file_name().unwrap_or_default().to_string_lossy();
                if zip.start_file(filename, options).is_ok() {
                    if let Ok(content) = std::fs::read(path) {
                        use std::io::Write;
                        let _ = zip.write_all(&content);
                    }
                }
            }
            if zip.finish().is_ok() {
                return Ok::<(&str, Vec<u8>), String>(("application/zip", zip_buffer));
            }
        }

        // 2. An image, as PNG.
        if let Some(png) = clipboard_png() {
            return Ok(("image/png", png));
        }

        // 3. Text (with HTML support for ChatGPT).
        let text = clipboard_text()?;
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
                format!("PULL: Sending Text ({})", String::from_utf8_lossy(&body))
            };

            let _ = state.app_handle.emit("log", LogEvent {
                message: log_msg,
                kind: "info".to_string(),
            });

            (StatusCode::OK, [(axum::http::header::CONTENT_TYPE, content_type)], body)
        },
        _ => {
             let _ = state.app_handle.emit("log", LogEvent {
                message: "PULL: Failed to read clipboard or internal error".to_string(),
                kind: "error".to_string(),
            });
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                [(axum::http::header::CONTENT_TYPE, "application/json")],
                serde_json::to_vec(&serde_json::json!({
                    "status": "error",
                    "message": "Failed to read clipboard"
                })).unwrap(),
            )
        }
    }
}

pub async fn push_clipboard(
    State(state): State<Arc<ServerState>>,
    Json(payload): Json<ClipboardContent>,
) -> (StatusCode, Json<serde_json::Value>) {
    let text = payload.text.clone();

    let _ = state.app_handle.emit("log", LogEvent {
        message: format!("PUSH (Text) received: {}", text),
        kind: "success".to_string(),
    });

    let result = tokio::task::spawn_blocking(move || {
        let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
        clipboard.set_text(text).map_err(|e| e.to_string())
    })
    .await;

    match result {
        Ok(Ok(_)) => {
            if !payload.text.trim().is_empty() {
                let ev = TransferEvent {
                    kind: "text".to_string(),
                    direction: "incoming".to_string(),
                    target: "clipboard".to_string(),
                    name: Some(payload.text),
                    path: None,
                    size: None,
                    ..Default::default()
                };
                let _ = state.app_handle.emit("transfer", ev.clone());
                crate::hud::notify(&state.app_handle, &state, &ev);
            }
            (StatusCode::OK, Json(serde_json::json!({ "status": "success" })))
        },
        Ok(Err(e)) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "status": "error", "message": format!("Clipboard error: {}", e) })),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "status": "error", "message": format!("Task join error: {}", e) })),
        ),
    }
}

/// Decodes an image (PNG, JPEG, HEIC is not supported) and puts it on this PC's
/// clipboard. Blocking: call it from `spawn_blocking`.
pub fn set_clipboard_image(bytes: &[u8]) -> Result<(), String> {
    let img = image::load_from_memory(bytes).map_err(|e| format!("Decode: {}", e))?;
    let rgba = img.into_rgba8();
    let (w, h) = rgba.dimensions();
    let params = arboard::ImageData {
        width: w as usize,
        height: h as usize,
        bytes: Cow::Owned(rgba.into_vec()),
    };
    let mut clipboard = arboard::Clipboard::new().map_err(|e| format!("Clipboard Init: {}", e))?;
    clipboard.set_image(params).map_err(|e| format!("Clipboard Set: {}", e))
}

pub async fn push_image(
    State(state): State<Arc<ServerState>>,
    mut multipart: Multipart,
) -> (StatusCode, Json<serde_json::Value>) {
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
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "status": "error", "message": "No image found" })),
        );
    }

    // Save to cache for preview display in history
    let cache_dir = get_cache_dir();
    let cache_filename = format!("pushed_{}.png", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis());
    let cache_path = cache_dir.join(&cache_filename);
    let _ = std::fs::write(&cache_path, &image_bytes);
    let image_len = image_bytes.len() as u64;

    let _ = state.app_handle.emit("log", LogEvent {
        message: format!("PUSH (Image) received: {} bytes. Cache: {:?}", image_bytes.len(), cache_path),
        kind: "success".to_string(),
    });

    let processed = tokio::task::spawn_blocking(move || set_clipboard_image(&image_bytes)).await;

    match processed {
        Ok(Ok(_)) => {
            let ev = TransferEvent {
                kind: "image".to_string(),
                direction: "incoming".to_string(),
                target: "clipboard".to_string(),
                name: None,
                path: Some(cache_path.to_string_lossy().to_string()),
                size: Some(image_len),
                ..Default::default()
            };
            let _ = state.app_handle.emit("transfer", ev.clone());
            crate::hud::notify(&state.app_handle, &state, &ev);
            (StatusCode::OK, Json(serde_json::json!({ "status": "success" })))
        },
        Ok(Err(e)) => {
             let _ = state.app_handle.emit("log", LogEvent {
                message: format!("PUSH (Image) failed: {}", e),
                kind: "error".to_string(),
            });
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "status": "error", "message": e })),
            )
        },
        Err(e) => {
             let _ = state.app_handle.emit("log", LogEvent {
                message: format!("PUSH (Image) fatal: {}", e),
                kind: "error".to_string(),
            });
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "status": "error", "message": "Internal Server Error" })),
            )
        }
    }
}
