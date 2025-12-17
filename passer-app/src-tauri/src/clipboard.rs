use axum::{
    extract::{State, Json, Multipart},
    response::IntoResponse,
};
use std::sync::Arc;
use std::borrow::Cow;
use tauri::Emitter;

use crate::types::{ServerState, ClipboardContent, LogEvent};

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


pub async fn pull_clipboard(State(state): State<Arc<ServerState>>) -> impl IntoResponse {
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
                            if let Ok(content) = std::fs::read(path) {
                                use std::io::Write;
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

        // 3. Fallback to Text (with HTML support for ChatGPT)
        let mut text = clipboard.get_text().unwrap_or_default();
        
        // If text/plain is empty, try reading HTML and strip tags
        if text.trim().is_empty() {
            #[cfg(target_os = "windows")]
            {
                // Try to get HTML from clipboard using registered format
                // CF_HTML is a standard Windows clipboard format
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

pub async fn push_clipboard(
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

pub async fn push_image(
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
