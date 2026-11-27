//! Passer's device network, built on passer-core.
//!
//! The legacy HTTP API (port 8000, pairing token) keeps serving the iOS Shortcuts. This
//! module adds the new way devices talk to this PC: a group of the user's devices, each
//! with its own key, end-to-end encrypted connections, and one permission checkpoint for
//! everything another device asks this PC to do.
//!
//! What this PC offers other devices of the group:
//!
//! | Capability       | Effect    | What it does |
//! |------------------|-----------|--------------|
//! | `device.info`    | read      | name, OS, version (built into the core) |
//! | `clipboard.write`| write     | puts text on this PC's clipboard |
//! | `clipboard.read` | read      | says what is copied on this PC: its text, or an image, or files copied in the Explorer |
//! | `clipboard.fetch`| read      | sends back, as a stream, the copied image (PNG) or one of the copied files |
//! | `clipboard.image`| write     | receives an image of any size as a stream and puts it on this PC's clipboard |
//! | `file.receive`   | write     | saves a small file (< 700 KB) to the Passboard folder (older apps) |
//! | `file.drop`      | write     | receives a file of any size (up to 4 GB) as a stream, into the Passboard folder |
//! | `file.get`       | read      | sends back a file from the Passer Space folder (the one already shared over WebDAV) |
//! | `file.list`      | read      | lists the files in the Passer Space folder (names, sizes, dates) |
//!
//! Approvals are shown in the main window; a request nobody answers is refused.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use async_trait::async_trait;
use base64::Engine;
use passer_ffi::{
    AdmissionListener, ApprovalInfo, ApprovalPrompter, CallerInfo, CapabilityHandler,
    CapabilitySpec, DeviceKind, EffectKind, NetworkKind, PasserDevice, PasserError, StreamKind,
};
use serde::Serialize;
use serde_json::json;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::oneshot;

use crate::paths::{
    get_config_dir, get_downloads_dir, get_target_dir, get_unique_file_path, get_webdav_dir,
};
use crate::types::{ServerState, TransferEvent};

/// Until Passer runs its own relays, devices reach each other through n0's public
/// development relays. Development only: see passer-core's docs/security.md.
const NETWORK: NetworkKind = NetworkKind::N0Dev;
/// Longest text accepted on the clipboard from another device.
const MAX_TEXT: usize = 200_000;
/// The largest image `clipboard.image` decodes: a phone screenshot is 1 to 5 MB.
const MAX_CLIPBOARD_IMAGE: u64 = 50 * 1024 * 1024;
/// Largest file accepted before streams exist in the core (base64 in a 1 MiB frame).
const MAX_FILE_BYTES: usize = 700 * 1024;
/// A prompt nobody answers is refused just before the core's own 60 s limit.
const APPROVAL_WAIT: Duration = Duration::from_secs(55);

/// Shared state of the device network.
pub struct Devices {
    pub device: Arc<PasserDevice>,
    /// Who is viewing or controlling this PC's screen right now.
    pub screen_sessions: Arc<Mutex<HashMap<u64, crate::screen::ScreenSession>>>,
    /// Where Vasistas was found at launch; without it the screen is not offered.
    pub vasistas: Option<std::path::PathBuf>,
    pending: Mutex<HashMap<u64, oneshot::Sender<bool>>>,
    next: AtomicU64,
    app: AppHandle,
}

impl Devices {
    /// Opens this PC's identity and, if it already belongs to a group, starts it.
    pub fn init(app: AppHandle, server: Arc<ServerState>) -> Result<Arc<Self>, String> {
        let home = get_config_dir().join("devices");
        let device = PasserDevice::open_on_desktop(home.clone()).map_err(|e| e.to_string())?;
        device.set_device_details(
            this_pc_kind(),
            windows_version(),
            Some(app.package_info().version.to_string()),
        );
        let devices = Arc::new(Self {
            device,
            screen_sessions: Arc::default(),
            vasistas: crate::screen::find_vasistas(),
            pending: Mutex::default(),
            next: AtomicU64::new(1),
            app: app.clone(),
        });
        devices
            .device
            .add_capabilities(pc_capabilities(), Arc::new(PcCapabilities { app, server }));
        devices
            .device
            .set_approval_prompter(Arc::new(WindowPrompter(Arc::downgrade(&devices))));
        devices
            .device
            .set_admission_listener(Arc::new(JoinNotifier(devices.app.clone())));

        // See the screen / take control, when Vasistas is installed.
        if let Some(vasistas) = devices.vasistas.clone() {
            if let Err(e) = crate::screen::remove_group_rule(&home) {
                eprintln!(" [devices] cannot update the screen rules: {e}");
            }
            let names = Arc::downgrade(&devices.device);
            devices.device.add_module(Arc::new(passer_exec::Exec::new(
                crate::screen::commands(vasistas),
                Arc::new(move |id: &str| names.upgrade().and_then(|d| d.member_name(id))),
            )));
        }
        devices.device.set_indicator(Arc::new(crate::screen::WindowIndicator {
            app: devices.app.clone(),
            device: Arc::downgrade(&devices.device),
            sessions: devices.screen_sessions.clone(),
        }));
        Ok(devices)
    }

    /// Starts serving if this PC is in a group. Safe to call more than once.
    pub async fn start_if_ready(&self) -> Result<(), String> {
        if self.device.has_group() {
            self.device.start(NETWORK, None).await.map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    /// Asks the other members what they are and offer, then tells the window.
    fn refresh_in_background(app: &AppHandle) {
        let app = app.clone();
        tauri::async_runtime::spawn(async move {
            let devices = app.state::<Arc<Devices>>().inner().clone();
            if devices.device.refresh_members().await.is_ok() {
                let _ = app.emit("devices-changed", ());
            }
        });
    }

    fn answer(&self, id: u64, allow: bool) -> bool {
        match self.pending.lock().expect("pending lock").remove(&id) {
            Some(tx) => tx.send(allow).is_ok(),
            None => false,
        }
    }
}

// ---------------------------------------------------------------------------------------
// What this PC can do for other devices
// ---------------------------------------------------------------------------------------

fn pc_capabilities() -> Vec<CapabilitySpec> {
    let spec = |name: &str, title: &str, description: &str, effect, schema: serde_json::Value| {
        CapabilitySpec {
            name: name.into(),
            title: title.into(),
            description: description.into(),
            input_schema_json: schema.to_string(),
            effect,
            target_kind: None,
            indicator_required: false,
            stream: None,
            max_bytes: None,
        }
    };
    vec![
        spec(
            "clipboard.write",
            "Put text on the PC clipboard",
            "Replaces the text on this PC's clipboard.",
            EffectKind::Write,
            json!({
                "type": "object",
                "properties": { "text": { "type": "string", "maxLength": MAX_TEXT } },
                "required": ["text"],
                "additionalProperties": false
            }),
        ),
        CapabilitySpec {
            stream: Some(StreamKind::Upload),
            ..spec(
                "clipboard.image",
                "Put an image on the PC clipboard",
                "Puts the image you send (PNG or JPEG, any size) on this PC's clipboard, ready to paste.",
                EffectKind::Write,
                json!({
                    "type": "object",
                    "properties": { "name": { "type": "string", "maxLength": 255 } },
                    "additionalProperties": false
                }),
            )
        },
        // The user's own devices read it without asking, as the direct connection always
        // did (decision with Walson, 2026-11-27); agents get nothing unless granted.
        spec(
            "clipboard.read",
            "Read the PC clipboard",
            "Says what is copied on this PC: { kind: text, text } or { kind: image } or { kind: files, files: [{ name, size }] }. Get the image or a file with clipboard.fetch.",
            EffectKind::Read,
            json!({ "type": "object", "additionalProperties": false }),
        ),
        CapabilitySpec {
            stream: Some(StreamKind::Download),
            ..spec(
                "clipboard.fetch",
                "Get what is copied on the PC",
                "Sends back the copied image as PNG, or the copied file at `index` (0 first), any size.",
                EffectKind::Read,
                json!({
                    "type": "object",
                    "properties": { "index": { "type": "integer", "minimum": 0, "maximum": 10000 } },
                    "additionalProperties": false
                }),
            )
        },
        spec(
            "file.receive",
            "Send a file to the PC",
            "Saves a small file (under 700 KB) into the PC's Passboard folder.",
            EffectKind::Write,
            json!({
                "type": "object",
                "properties": {
                    "name": { "type": "string", "minLength": 1, "maxLength": 255 },
                    "data_base64": { "type": "string", "maxLength": MAX_FILE_BYTES * 4 / 3 + 4 }
                },
                "required": ["name", "data_base64"],
                "additionalProperties": false
            }),
        ),
        spec(
            "file.list",
            "List the PC's shared files",
            "Lists the files in the PC's Passer Space folder, to get one with file.get.",
            EffectKind::Read,
            json!({ "type": "object", "additionalProperties": false }),
        ),
        CapabilitySpec {
            stream: Some(StreamKind::Download),
            ..spec(
                "file.get",
                "Get a file from the PC",
                "Sends back a file from the PC's Passer Space folder, by name.",
                EffectKind::Read,
                json!({
                    "type": "object",
                    "properties": { "name": { "type": "string", "minLength": 1, "maxLength": 255 } },
                    "required": ["name"],
                    "additionalProperties": false
                }),
            )
        },
        CapabilitySpec {
            stream: Some(StreamKind::Upload),
            ..spec(
                "file.drop",
                "Send a file to the PC",
                "Saves the file you send into the PC's Passboard folder, under its name.",
                EffectKind::Write,
                json!({
                    "type": "object",
                    "properties": { "name": { "type": "string", "minLength": 1, "maxLength": 255 } },
                    "required": ["name"],
                    "additionalProperties": false
                }),
            )
        },
    ]
}

/// A file directly in the Passer Space folder, by name: no path, no link leading out of it.
fn shared_file(name: &str) -> Result<std::path::PathBuf, PasserError> {
    file_in(&get_webdav_dir(), name)
}

fn file_in(dir: &std::path::Path, name: &str) -> Result<std::path::PathBuf, PasserError> {
    let root = std::fs::canonicalize(dir).map_err(failed)?;
    let wanted = base_name(name);
    let path = std::fs::canonicalize(root.join(&wanted)).map_err(|_| failed("no such file"))?;
    if path.parent() != Some(root.as_path()) || !path.is_file() || wanted != name {
        return Err(failed("no such file"));
    }
    Ok(path)
}

/// Regular files directly in `dir`, newest first, at most 500.
fn list_files(dir: &std::path::Path) -> Vec<serde_json::Value> {
    let mut files: Vec<(std::time::SystemTime, serde_json::Value)> = std::fs::read_dir(dir)
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|e| {
            let meta = e.metadata().ok()?;
            if !meta.is_file() {
                return None;
            }
            let name = e.file_name().into_string().ok()?;
            if name.starts_with('.') {
                return None;
            }
            let modified = meta.modified().unwrap_or(std::time::UNIX_EPOCH);
            let secs = modified
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0);
            Some((modified, json!({ "name": name, "size": meta.len(), "modified": secs })))
        })
        .collect();
    files.sort_by_key(|f| std::cmp::Reverse(f.0));
    files.into_iter().take(500).map(|(_, v)| v).collect()
}

/// The base name only, so a sender cannot write outside the Passboard folder (same rule
/// as the HTTP upload).
fn base_name(raw: &str) -> String {
    std::path::Path::new(raw)
        .file_name()
        .and_then(|n| n.to_str())
        .filter(|n| !n.is_empty() && *n != "." && *n != "..")
        .unwrap_or("received_file")
        .to_owned()
}

struct PcCapabilities {
    app: AppHandle,
    server: Arc<ServerState>,
}

impl PcCapabilities {
    fn record(&self, ev: TransferEvent) {
        let _ = self.app.emit("transfer", ev.clone());
        crate::hud::notify(&self.app, &self.server, &ev);
    }
}

/// What is copied on this PC, in the order the pull has always looked.
enum Copied {
    /// Files copied in the Explorer: name and size.
    Files(Vec<(String, u64)>),
    Image,
    Text(String),
}

/// Blocking: the files copied in the Explorer, else an image, else the text.
fn clipboard_content() -> Result<Copied, PasserError> {
    let files = crate::clipboard::copied_files();
    if !files.is_empty() {
        return Ok(Copied::Files(
            files
                .iter()
                .map(|p| {
                    let name = p.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
                    (name, std::fs::metadata(p).map(|m| m.len()).unwrap_or(0))
                })
                .collect(),
        ));
    }
    if arboard::Clipboard::new().and_then(|mut c| c.get_image()).is_ok() {
        return Ok(Copied::Image);
    }
    let text = crate::clipboard::clipboard_text().map_err(failed)?;
    if text.chars().count() > MAX_TEXT {
        return Err(failed("the copied text is too long (200,000 characters at most)"));
    }
    Ok(Copied::Text(text))
}

fn failed(message: impl std::fmt::Display) -> PasserError {
    PasserError::Invalid { message: message.to_string() }
}

impl PcCapabilities {
    /// `clipboard.fetch`: the copied file at `index`, or the copied image written to a
    /// PNG in the cache (the core streams that path).
    async fn provide_clipboard(&self, index: usize, caller: CallerInfo) -> Result<String, PasserError> {
        let (path, kind, name) = tokio::task::spawn_blocking(move || -> Result<_, String> {
            let files = crate::clipboard::copied_files();
            if !files.is_empty() {
                let path = files.get(index).cloned().ok_or("that file is no longer copied")?;
                let name = path.file_name().map(|n| n.to_string_lossy().into_owned());
                return Ok((path, "file", name));
            }
            let png = crate::clipboard::clipboard_png().ok_or("no image or file is copied on this PC")?;
            let path = crate::paths::get_cache_dir().join("clipboard_fetch.png");
            std::fs::write(&path, png).map_err(|e| e.to_string())?;
            Ok((path, "image", None))
        })
        .await
        .map_err(failed)?
        .map_err(failed)?;
        let size = std::fs::metadata(&path).map(|m| m.len()).ok();
        self.record(TransferEvent {
            kind: kind.into(),
            direction: "outgoing".into(),
            target: "clipboard".into(),
            name,
            path: Some(path.to_string_lossy().into_owned()),
            size,
            device: Some(caller.device_name.clone()),
            device_id: Some(caller.device_id.clone()),
        });
        Ok(path.to_string_lossy().into_owned())
    }

    /// `clipboard.image`: the whole image arrived in the core's private folder; put it
    /// on the clipboard, keep a copy for the history's preview, and drop the original.
    async fn receive_clipboard_image(&self, caller: CallerInfo, path: String) -> Result<String, PasserError> {
        let from = std::path::PathBuf::from(&path);
        let size = tokio::fs::metadata(&from).await.map_err(failed)?.len();
        if size > MAX_CLIPBOARD_IMAGE {
            let _ = tokio::fs::remove_file(&from).await;
            return Err(failed(format!("image over {} MB", MAX_CLIPBOARD_IMAGE / 1024 / 1024)));
        }
        let cache = crate::paths::get_cache_dir().join(format!(
            "pushed_{}.png",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis())
                .unwrap_or(0)
        ));
        let preview = cache.clone();
        tokio::task::spawn_blocking(move || -> Result<(), String> {
            let bytes = std::fs::read(&from).map_err(|e| e.to_string())?;
            let set = crate::clipboard::set_clipboard_image(&bytes);
            let _ = std::fs::write(&preview, &bytes);
            let _ = std::fs::remove_file(&from);
            set
        })
        .await
        .map_err(failed)?
        .map_err(failed)?;
        self.record(TransferEvent {
            kind: "image".into(),
            direction: "incoming".into(),
            target: "clipboard".into(),
            name: None,
            path: Some(cache.to_string_lossy().into_owned()),
            size: Some(size),
            device: Some(caller.device_name.clone()),
            device_id: Some(caller.device_id.clone()),
        });
        Ok(json!({ "copied": true, "size": size }).to_string())
    }
}

#[async_trait]
impl CapabilityHandler for PcCapabilities {
    async fn invoke(
        &self,
        capability: String,
        _target: Option<String>,
        input_json: String,
        caller: CallerInfo,
    ) -> Result<String, PasserError> {
        let input: serde_json::Value = serde_json::from_str(&input_json).map_err(failed)?;
        match capability.as_str() {
            "clipboard.write" => {
                let text = input["text"].as_str().unwrap_or_default().to_owned();
                let shown = text.clone();
                tokio::task::spawn_blocking(move || {
                    arboard::Clipboard::new().and_then(|mut c| c.set_text(text))
                })
                .await
                .map_err(failed)?
                .map_err(failed)?;
                if !shown.trim().is_empty() {
                    self.record(TransferEvent {
                        kind: "text".into(),
                        direction: "incoming".into(),
                        target: "clipboard".into(),
                        name: Some(shown),
                        path: None,
                        size: None,
                        device: Some(caller.device_name.clone()),
                        device_id: Some(caller.device_id.clone()),
                    });
                }
                Ok(json!({ "ok": true }).to_string())
            }
            "clipboard.read" => {
                let content = tokio::task::spawn_blocking(clipboard_content).await.map_err(failed)??;
                let (kind, name, size) = match &content {
                    Copied::Text(text) => ("text", format!("Read by {}", caller.device_name), text.len() as u64),
                    Copied::Image => ("image", format!("Image read by {}", caller.device_name), 0),
                    Copied::Files(files) => (
                        "file",
                        format!("{} file(s) read by {}", files.len(), caller.device_name),
                        files.iter().map(|f| f.1).sum(),
                    ),
                };
                self.record(TransferEvent {
                    kind: kind.into(),
                    direction: "outgoing".into(),
                    target: "clipboard".into(),
                    name: Some(name),
                    path: None,
                    size: Some(size),
                    device: Some(caller.device_name.clone()),
                    device_id: Some(caller.device_id.clone()),
                });
                Ok(match content {
                    // `text` stays, empty for an image or files: older apps read only it.
                    Copied::Text(text) => json!({ "kind": "text", "text": text }),
                    Copied::Image => json!({ "kind": "image", "text": "" }),
                    Copied::Files(files) => json!({
                        "kind": "files",
                        "text": "",
                        "files": files.iter().map(|(name, size)| json!({ "name": name, "size": size })).collect::<Vec<_>>(),
                    }),
                }
                .to_string())
            }
            "file.list" => {
                let dir = get_webdav_dir();
                let files = tokio::task::spawn_blocking(move || list_files(&dir))
                    .await
                    .map_err(failed)?;
                Ok(json!({ "files": files }).to_string())
            }
            "file.receive" => {
                let name = base_name(input["name"].as_str().unwrap_or_default());
                let bytes = base64::engine::general_purpose::STANDARD
                    .decode(input["data_base64"].as_str().unwrap_or_default())
                    .map_err(|_| failed("data_base64 is not valid base64"))?;
                if bytes.len() > MAX_FILE_BYTES {
                    return Err(failed("file too large for this version (700 KB maximum)"));
                }
                let dir = get_target_dir(&get_downloads_dir(), "application/octet-stream", &name);
                let path = get_unique_file_path(dir.join(&name));
                let size = bytes.len() as u64;
                let write_path = path.clone();
                tokio::task::spawn_blocking(move || std::fs::write(write_path, bytes))
                    .await
                    .map_err(failed)?
                    .map_err(failed)?;
                self.record(TransferEvent {
                    kind: "file".into(),
                    direction: "incoming".into(),
                    target: "folder".into(),
                    name: Some(name),
                    path: Some(path.to_string_lossy().into_owned()),
                    size: Some(size),
                    device: Some(caller.device_name.clone()),
                    device_id: Some(caller.device_id.clone()),
                });
                Ok(json!({ "saved": true, "size": size }).to_string())
            }
            other => Err(failed(format!("unknown capability {other}"))),
        }
    }

    /// `file.drop`: the whole file arrived in the core's private folder; move it into
    /// the Passboard folder under a free name.
    async fn receive_file(
        &self,
        capability: String,
        _target: Option<String>,
        input_json: String,
        caller: CallerInfo,
        path: String,
    ) -> Result<String, PasserError> {
        if capability == "clipboard.image" {
            return self.receive_clipboard_image(caller, path).await;
        }
        if capability != "file.drop" {
            return Err(failed(format!("unknown capability {capability}")));
        }
        let input: serde_json::Value = serde_json::from_str(&input_json).map_err(failed)?;
        let name = base_name(input["name"].as_str().unwrap_or_default());
        let dir = get_target_dir(&get_downloads_dir(), "application/octet-stream", &name);
        let dest = get_unique_file_path(dir.join(&name));
        let (from, to) = (std::path::PathBuf::from(&path), dest.clone());
        let size = tokio::task::spawn_blocking(move || -> std::io::Result<u64> {
            let size = std::fs::metadata(&from)?.len();
            // A rename fails across volumes (the Passboard folder may be on another disk).
            if std::fs::rename(&from, &to).is_err() {
                std::fs::copy(&from, &to)?;
            }
            Ok(size)
        })
        .await
        .map_err(failed)?
        .map_err(failed)?;
        self.record(TransferEvent {
            kind: "file".into(),
            direction: "incoming".into(),
            target: "folder".into(),
            name: Some(name),
            path: Some(dest.to_string_lossy().into_owned()),
            size: Some(size),
            device: Some(caller.device_name.clone()),
            device_id: Some(caller.device_id.clone()),
        });
        Ok(json!({ "saved": true, "size": size }).to_string())
    }

    /// `file.get`: the core streams the file named here.
    async fn provide_file(
        &self,
        capability: String,
        _target: Option<String>,
        input_json: String,
        caller: CallerInfo,
    ) -> Result<String, PasserError> {
        if capability == "clipboard.fetch" {
            let input: serde_json::Value = serde_json::from_str(&input_json).map_err(failed)?;
            let index = input["index"].as_u64().unwrap_or(0) as usize;
            return self.provide_clipboard(index, caller).await;
        }
        if capability != "file.get" {
            return Err(failed(format!("unknown capability {capability}")));
        }
        let input: serde_json::Value = serde_json::from_str(&input_json).map_err(failed)?;
        let path = shared_file(input["name"].as_str().unwrap_or_default())?;
        let size = std::fs::metadata(&path).map(|m| m.len()).ok();
        self.record(TransferEvent {
            kind: "file".into(),
            direction: "outgoing".into(),
            target: "folder".into(),
            // The device is its own field now: the Passboard says "To <device>".
            name: Some(path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default()),
            path: Some(path.to_string_lossy().into_owned()),
            size,
            device: Some(caller.device_name.clone()),
            device_id: Some(caller.device_id.clone()),
        });
        Ok(path.to_string_lossy().into_owned())
    }
}

// ---------------------------------------------------------------------------------------
// Approvals and joins, shown in the main window
// ---------------------------------------------------------------------------------------

/// What the window shows when another device asks for something sensitive.
#[derive(Serialize, Clone)]
struct ApprovalRequest {
    id: u64,
    requester: String,
    requester_id: String,
    agent: Option<String>,
    title: String,
    capability: String,
    target: Option<String>,
    minutes: u64,
    expires_in_secs: u64,
}

fn short(id: &str) -> String {
    id.chars().take(10).collect()
}

fn bring_main_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

struct WindowPrompter(std::sync::Weak<Devices>);

#[async_trait]
impl ApprovalPrompter for WindowPrompter {
    async fn ask(&self, r: ApprovalInfo) -> bool {
        let Some(devices) = self.0.upgrade() else {
            return false;
        };
        let id = devices.next.fetch_add(1, Ordering::Relaxed);
        let (tx, rx) = oneshot::channel();
        devices.pending.lock().expect("pending lock").insert(id, tx);
        let request = ApprovalRequest {
            id,
            requester: r.requester_name,
            requester_id: short(&r.requester_id),
            agent: r.agent,
            title: r.title,
            capability: r.capability,
            target: r.target,
            minutes: r.duration_minutes,
            expires_in_secs: APPROVAL_WAIT.as_secs(),
        };
        bring_main_window(&devices.app);
        let _ = devices.app.emit("approval-request", request);
        let answer = tokio::time::timeout(APPROVAL_WAIT, rx).await;
        devices.pending.lock().expect("pending lock").remove(&id);
        let _ = devices.app.emit("approval-closed", id);
        matches!(answer, Ok(Ok(true)))
    }
}

#[derive(Serialize, Clone)]
struct Joined {
    name: String,
    id: String,
    sas: String,
}

struct JoinNotifier(AppHandle);

impl AdmissionListener for JoinNotifier {
    fn admitted(&self, device_id: String, device_name: String, sas: String) {
        bring_main_window(&self.0);
        let _ = self.0.emit("device-joined", Joined { name: device_name, id: short(&device_id), sas });
        // Learn what the newcomer is and offers.
        Devices::refresh_in_background(&self.0);
    }
}

// ---------------------------------------------------------------------------------------
// What this PC says about itself
// ---------------------------------------------------------------------------------------

/// A PC with a battery is a laptop.
#[cfg(windows)]
fn this_pc_kind() -> DeviceKind {
    use windows_sys::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};
    // SAFETY: GetSystemPowerStatus fills the struct it is given and keeps no pointer.
    let mut status: SYSTEM_POWER_STATUS = unsafe { std::mem::zeroed() };
    if unsafe { GetSystemPowerStatus(&mut status) } == 0 {
        return DeviceKind::Unknown;
    }
    match status.BatteryFlag {
        128 => DeviceKind::Desktop, // no system battery
        255 => DeviceKind::Unknown, // unknown status
        _ => DeviceKind::Laptop,
    }
}

#[cfg(not(windows))]
fn this_pc_kind() -> DeviceKind {
    DeviceKind::Unknown
}

/// The real Windows version, e.g. `10.0.26100` (Windows 11 reports 10.0 too). Unlike
/// `GetVersionEx`, `RtlGetVersion` is not capped by the application manifest.
#[cfg(windows)]
fn windows_version() -> Option<String> {
    use windows_sys::Wdk::System::SystemServices::RtlGetVersion;
    use windows_sys::Win32::System::SystemInformation::OSVERSIONINFOW;
    // SAFETY: RtlGetVersion fills the struct whose size is set first and keeps no pointer.
    let mut info: OSVERSIONINFOW = unsafe { std::mem::zeroed() };
    info.dwOSVersionInfoSize = std::mem::size_of::<OSVERSIONINFOW>() as u32;
    if unsafe { RtlGetVersion(&mut info) } != 0 {
        return None;
    }
    Some(format!("{}.{}.{}", info.dwMajorVersion, info.dwMinorVersion, info.dwBuildNumber))
}

#[cfg(not(windows))]
fn windows_version() -> Option<String> {
    None
}

// ---------------------------------------------------------------------------------------
// Commands for the window
// ---------------------------------------------------------------------------------------

#[derive(Serialize)]
pub struct MemberView {
    id: String,
    short_id: String,
    name: String,
    approver: bool,
    this_device: bool,
    /// `phone`, `tablet`, `laptop`, `desktop` or `unknown`.
    kind: &'static str,
    /// What the member last said about itself; display only.
    os: Option<String>,
    os_version: Option<String>,
    app_version: Option<String>,
    core_version: Option<String>,
    /// When it last answered this PC (Unix seconds).
    answered_at: Option<u64>,
}

fn kind_name(kind: DeviceKind) -> &'static str {
    match kind {
        DeviceKind::Phone => "phone",
        DeviceKind::Tablet => "tablet",
        DeviceKind::Laptop => "laptop",
        DeviceKind::Desktop => "desktop",
        DeviceKind::Unknown => "unknown",
    }
}

/// What another member lets this PC call.
#[derive(Serialize)]
pub struct CapabilityView {
    name: String,
    title: String,
    description: String,
    /// `read`, `write` or `sensitive`.
    effect: &'static str,
    needs_approval: bool,
}

/// One line of this PC's journal: what was called, never what was sent.
#[derive(Serialize)]
pub struct JournalView {
    seq: u64,
    at: u64,
    outgoing: bool,
    peer_id: String,
    peer_short_id: String,
    peer_name: String,
    agent: Option<String>,
    capability: String,
    target: Option<String>,
    decision: String,
    approved: Option<bool>,
    outcome: String,
}

#[derive(Serialize)]
pub struct DevicesStatus {
    device_id: String,
    group: Option<String>,
    running: bool,
    /// True while the network uses n0's development relays.
    development_network: bool,
    members: Vec<MemberView>,
}

type DevicesState<'a> = tauri::State<'a, Arc<Devices>>;

#[tauri::command]
pub async fn devices_status(devices: DevicesState<'_>) -> Result<DevicesStatus, String> {
    let d = &devices.device;
    let members = d
        .members()
        .map(|list| {
            list.into_iter()
                .map(|m| MemberView {
                    short_id: short(&m.id),
                    id: m.id,
                    name: m.name,
                    approver: m.approver,
                    this_device: m.this_device,
                    kind: kind_name(m.kind),
                    os: m.os,
                    os_version: m.os_version,
                    app_version: m.app_version,
                    core_version: m.core_version,
                    answered_at: m.answered_at,
                })
                .collect()
        })
        .unwrap_or_default();
    Ok(DevicesStatus {
        device_id: d.device_id(),
        group: d.group_name(),
        running: d.is_running().await,
        development_network: matches!(NETWORK, NetworkKind::N0Dev),
        members,
    })
}

/// Creates a group with this PC as its first approver, then starts.
#[tauri::command]
pub async fn devices_create_group(devices: DevicesState<'_>, name: String) -> Result<(), String> {
    let name = name.trim();
    let group = if name.is_empty() { "My devices" } else { name };
    devices
        .device
        .create_group(group.into(), crate::device::display_name())
        .map_err(|e| e.to_string())?;
    devices.start_if_ready().await
}

/// Joins a group with a link from another device's invitation, then starts.
#[tauri::command]
pub async fn devices_join(devices: DevicesState<'_>, link: String) -> Result<String, String> {
    let joined = devices
        .device
        .join(link.trim().into(), crate::device::display_name(), NETWORK)
        .await
        .map_err(|e| e.to_string())?;
    devices.start_if_ready().await?;
    Ok(joined.sas)
}

/// A one-time link (shown as a QR code) for a new device.
#[tauri::command]
pub async fn devices_invite(devices: DevicesState<'_>, approver: bool) -> Result<String, String> {
    let invite = devices.device.invite(10, approver).await.map_err(|e| e.to_string())?;
    Ok(invite.link)
}

#[tauri::command]
pub async fn devices_remove(devices: DevicesState<'_>, id: String) -> Result<(), String> {
    devices.device.remove_device(id).await.map_err(|e| e.to_string())
}

/// The stop button: ends every session other devices have open on this PC.
#[tauri::command]
pub async fn devices_stop_sessions(devices: DevicesState<'_>) -> Result<(), String> {
    devices.device.stop_all_sessions().await.map_err(|e| e.to_string())
}

// --- Asking another device ------------------------------------------------------------
// What this PC can ask of the device shown on the Devices stage. Each one is a call
// through passer-core, so the other device's own rules apply: `clipboard.read` there
// waits for its user's approval (up to the core's 60 s).

async fn call_member(devices: &Devices, id: String, capability: &str, input: serde_json::Value) -> Result<serde_json::Value, String> {
    let out = devices
        .device
        .call(id, capability.into(), input.to_string())
        .await
        .map_err(|e| e.to_string())?;
    serde_json::from_str(&out).map_err(|e| e.to_string())
}

/// Tells the Passboard about a transfer this PC made to (or got from) a member.
fn record_with(devices: &Devices, id: &str, ev: TransferEvent) {
    let name = devices
        .device
        .members()
        .ok()
        .and_then(|list| list.into_iter().find(|m| m.id == id).map(|m| m.name));
    let _ = devices.app.emit(
        "transfer",
        TransferEvent { device: name, device_id: Some(id.to_owned()), ..ev },
    );
}

/// Sends the text currently copied on this PC to a member's clipboard.
#[tauri::command]
pub async fn devices_send_clipboard(devices: DevicesState<'_>, id: String) -> Result<(), String> {
    let text = tokio::task::spawn_blocking(|| arboard::Clipboard::new().and_then(|mut c| c.get_text()))
        .await
        .map_err(|e| e.to_string())?
        .unwrap_or_default();
    if text.trim().is_empty() {
        return Err("There is no text copied on this PC.".into());
    }
    if text.chars().count() > MAX_TEXT {
        return Err("The copied text is too long to send (200,000 characters at most).".into());
    }
    call_member(&devices, id.clone(), "clipboard.write", json!({ "text": text.clone() })).await?;
    record_with(&devices, &id, TransferEvent {
        kind: "text".into(),
        direction: "outgoing".into(),
        target: "clipboard".into(),
        name: Some(text),
        ..Default::default()
    });
    Ok(())
}

/// Copies a member's clipboard text onto this PC. Returns how many characters came.
#[tauri::command]
pub async fn devices_get_clipboard(devices: DevicesState<'_>, id: String) -> Result<usize, String> {
    let out = call_member(&devices, id.clone(), "clipboard.read", json!({})).await?;
    let text = out["text"].as_str().unwrap_or_default().to_owned();
    let count = text.chars().count();
    if count > 0 {
        record_with(&devices, &id, TransferEvent {
            kind: "text".into(),
            direction: "incoming".into(),
            target: "clipboard".into(),
            name: Some(text.clone()),
            ..Default::default()
        });
    }
    tokio::task::spawn_blocking(move || arboard::Clipboard::new().and_then(|mut c| c.set_text(text)))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    Ok(count)
}

/// Reports a file's progress to the window as `transfer-progress` { transfer, name,
/// done, total }, sending or fetching, at most every 120 ms (and always at the end), so
/// a 4 GB file does not flood the webview with events.
struct EmitProgress {
    app: AppHandle,
    transfer: String,
    name: String,
    last: Mutex<std::time::Instant>,
}

impl passer_ffi::TransferProgress for EmitProgress {
    fn progress(&self, done: u64, total: Option<u64>) {
        let finished = total.is_some_and(|t| done >= t);
        {
            let mut last = self.last.lock().expect("progress lock");
            if !finished && last.elapsed() < Duration::from_millis(120) {
                return;
            }
            *last = std::time::Instant::now();
        }
        let _ = self.app.emit(
            "transfer-progress",
            json!({ "transfer": self.transfer, "name": self.name, "done": done, "total": total }),
        );
    }
}

/// Sends one file to a member: streamed through `file.drop` when the member offers it
/// (any size, up to the core's 4 GB), else the older `file.receive` (700 KB at most).
/// Records it in the Passboard as sent. Returns the file's name.
async fn send_one(devices: &Devices, id: &str, path: std::path::PathBuf, transfer: &str) -> Result<String, String> {
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| format!("{} is not a file", path.display()))?
        .to_owned();
    let offers = devices.device.member_capabilities(id.to_owned()).map_err(|e| e.to_string())?;
    let size = tokio::fs::metadata(&path).await.map_err(|e| format!("{name}: {e}"))?.len();

    if offers.iter().any(|c| c.name == "file.drop") {
        let progress = Arc::new(EmitProgress {
            app: devices.app.clone(),
            transfer: transfer.to_owned(),
            name: name.clone(),
            last: Mutex::new(std::time::Instant::now() - Duration::from_secs(1)),
        });
        devices
            .device
            .send_file(
                id.to_owned(),
                "file.drop".into(),
                json!({ "name": name }).to_string(),
                path.to_string_lossy().into_owned(),
                Some(progress),
            )
            .await
            .map_err(|e| format!("{name}: {e}"))?;
    } else if offers.iter().any(|c| c.name == "file.receive") {
        if size as usize > MAX_FILE_BYTES {
            return Err(format!("{name} is too large for this device (700 KB at most): it needs a newer Passer."));
        }
        let read_path = path.clone();
        let bytes = tokio::task::spawn_blocking(move || std::fs::read(read_path))
            .await
            .map_err(|e| e.to_string())?
            .map_err(|e| format!("{name}: {e}"))?;
        let data = base64::engine::general_purpose::STANDARD.encode(&bytes);
        call_member(devices, id.to_owned(), "file.receive", json!({ "name": name.clone(), "data_base64": data }))
            .await
            .map_err(|e| format!("{name}: {e}"))?;
    } else {
        return Err("This device doesn't accept files from here.".into());
    }

    record_with(devices, id, TransferEvent {
        kind: "file".into(),
        direction: "outgoing".into(),
        target: "folder".into(),
        name: Some(name.clone()),
        path: Some(path.to_string_lossy().into_owned()),
        size: Some(size),
        ..Default::default()
    });
    Ok(name)
}

/// "Send a file" on the Devices stage: a native file picker, then `send_one`.
/// `None` when the user closed the picker. Progress comes as `transfer-progress` with
/// `transfer`.
#[tauri::command]
pub async fn devices_pick_and_send(
    app: AppHandle,
    devices: DevicesState<'_>,
    id: String,
    transfer: String,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let picker = app.clone();
    let picked = tokio::task::spawn_blocking(move || picker.dialog().file().set_title("Send a file").blocking_pick_file())
        .await
        .map_err(|e| e.to_string())?;
    let Some(file) = picked else { return Ok(None) };
    let path = file.into_path().map_err(|e| e.to_string())?;
    send_one(&devices, &id, path, &transfer).await.map(Some)
}

/// Sends files dropped on the window to a member, one by one (`transfer` is
/// `drop-<index>` in the progress events). Stops at the first that fails and says
/// which; the ones before it went through.
#[tauri::command]
pub async fn devices_send_paths(devices: DevicesState<'_>, id: String, paths: Vec<String>) -> Result<u32, String> {
    let mut sent = 0;
    for (i, p) in paths.into_iter().enumerate() {
        send_one(&devices, &id, std::path::PathBuf::from(p), &format!("drop-{i}")).await?;
        sent += 1;
    }
    Ok(sent)
}

#[tauri::command]
pub fn devices_answer_approval(devices: DevicesState<'_>, id: u64, allow: bool) -> bool {
    devices.answer(id, allow)
}

/// Progress of a file transfer started from this window.

/// Gets a file by name from another member's `file.get`, into the Passboard folder,
/// and lists it there as coming from that member. Progress comes as
/// `transfer-progress` with `transfer`. Returns where it was saved.
#[tauri::command]
pub async fn devices_fetch_file(
    devices: DevicesState<'_>,
    id: String,
    name: String,
    transfer: String,
) -> Result<String, String> {
    let base = base_name(&name);
    let dir = get_target_dir(&get_downloads_dir(), "application/octet-stream", &base);
    let dest = get_unique_file_path(dir.join(&base));
    let progress = Arc::new(EmitProgress {
        app: devices.app.clone(),
        transfer,
        name: base.clone(),
        last: Mutex::new(std::time::Instant::now() - Duration::from_secs(1)),
    });
    devices
        .device
        .fetch_file(
            id.clone(),
            "file.get".into(),
            json!({ "name": name }).to_string(),
            dest.to_string_lossy().into_owned(),
            Some(progress),
        )
        .await
        .map_err(|e| e.to_string())?;
    let size = tokio::fs::metadata(&dest).await.map(|m| m.len()).ok();
    record_with(&devices, &id, TransferEvent {
        kind: "file".into(),
        direction: "incoming".into(),
        target: "folder".into(),
        name: Some(base),
        path: Some(dest.to_string_lossy().into_owned()),
        size,
        ..Default::default()
    });
    Ok(dest.to_string_lossy().into_owned())
}

/// The files a member shares (its `file.list`): `[{ name, size, modified }]`, newest
/// first.
#[tauri::command]
pub async fn devices_list_files(devices: DevicesState<'_>, id: String) -> Result<serde_json::Value, String> {
    let out = call_member(&devices, id, "file.list", json!({})).await?;
    Ok(out.get("files").cloned().unwrap_or_else(|| json!([])))
}

// --- What this PC shares ------------------------------------------------------------
// The Passer Space folder, which `file.list` / `file.get` offer to the other members.

/// The files this PC shares, as the other members see them.
#[tauri::command]
pub async fn space_files() -> Result<Vec<serde_json::Value>, String> {
    let dir = get_webdav_dir();
    tokio::task::spawn_blocking(move || list_files(&dir)).await.map_err(|e| e.to_string())
}

/// "Share a file": a native picker (several files), each copied into the shared folder
/// under a free name. Returns how many were added (0 when the picker was closed).
#[tauri::command]
pub async fn space_pick_and_add(app: AppHandle) -> Result<u32, String> {
    use tauri_plugin_dialog::DialogExt;
    let picked = tokio::task::spawn_blocking(move || app.dialog().file().set_title("Share files").blocking_pick_files())
        .await
        .map_err(|e| e.to_string())?;
    let Some(files) = picked else { return Ok(0) };
    let paths = files.into_iter().filter_map(|f| f.into_path().ok()).collect::<Vec<_>>();
    add_to_space(paths).await
}

/// Copies files into the shared folder (also what the "Share" choice of a drop does).
#[tauri::command]
pub async fn space_add_paths(paths: Vec<String>) -> Result<u32, String> {
    add_to_space(paths.into_iter().map(std::path::PathBuf::from).collect()).await
}

async fn add_to_space(paths: Vec<std::path::PathBuf>) -> Result<u32, String> {
    tokio::task::spawn_blocking(move || -> Result<u32, String> {
        let dir = get_webdav_dir();
        let mut added = 0;
        for from in paths {
            if !from.is_file() {
                continue;
            }
            let name = base_name(&from.file_name().and_then(|n| n.to_str()).unwrap_or_default().to_owned());
            let to = get_unique_file_path(dir.join(name));
            std::fs::copy(&from, &to).map_err(|e| format!("{}: {e}", from.display()))?;
            added += 1;
        }
        Ok(added)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Stops sharing a file: removes its copy from the shared folder (the original, where
/// it was picked from, is untouched).
#[tauri::command]
pub async fn space_remove(name: String) -> Result<(), String> {
    let path = shared_file(&name).map_err(|e| e.to_string())?;
    tokio::fs::remove_file(path).await.map_err(|e| e.to_string())
}

/// Whether this PC offers its screen (Vasistas found) and where Vasistas is.
#[tauri::command]
pub fn devices_screen_status(devices: DevicesState<'_>) -> crate::screen::ScreenStatus {
    crate::screen::ScreenStatus {
        available: devices.vasistas.is_some(),
        vasistas: devices.vasistas.as_ref().map(|p| p.display().to_string()),
    }
}

/// What one device may do with this PC's screen without asking.
#[tauri::command]
pub fn devices_screen_rules(id: String) -> Result<crate::screen::ScreenRules, String> {
    crate::screen::rules_for(&get_config_dir().join("devices"), &id)
}

/// Lets one device view or control this PC's screen without asking, or takes it back.
/// The core applies the new rules at once (`reload_policy`). Taking a permission back
/// also ends every session other devices have open here, so a control session that
/// the switch allowed stops with it.
#[tauri::command]
pub async fn devices_set_screen_rule(
    devices: DevicesState<'_>,
    id: String,
    capability: String,
    allow: bool,
) -> Result<crate::screen::ScreenRules, String> {
    let home = get_config_dir().join("devices");
    crate::screen::set_rule(&home, &id, &capability, allow)?;
    devices.device.reload_policy().await.map_err(|e| e.to_string())?;
    if !allow {
        let _ = devices.device.stop_all_sessions().await;
    }
    crate::screen::rules_for(&home, &id)
}

/// Who is viewing or controlling this PC's screen right now.
#[tauri::command]
pub fn devices_screen_sessions(devices: DevicesState<'_>) -> Vec<crate::screen::ScreenSession> {
    devices.screen_sessions.lock().expect("sessions lock").values().cloned().collect()
}

/// Asks every other member, now, what it is and offers. Returns how many answered.
#[tauri::command]
pub async fn devices_refresh(devices: DevicesState<'_>) -> Result<u32, String> {
    devices.device.refresh_members().await.map_err(|e| e.to_string())
}

/// What a member (by id) lets this PC call, as it last said.
#[tauri::command]
pub fn devices_capabilities(devices: DevicesState<'_>, id: String) -> Result<Vec<CapabilityView>, String> {
    let list = devices.device.member_capabilities(id).map_err(|e| e.to_string())?;
    Ok(list
        .into_iter()
        .map(|c| CapabilityView {
            name: c.name,
            title: c.title,
            description: c.description,
            effect: match c.effect {
                EffectKind::Read => "read",
                EffectKind::Write => "write",
                EffectKind::Sensitive => "sensitive",
            },
            needs_approval: c.needs_approval,
        })
        .collect())
}

/// The latest journal lines, newest first; only those with one member when `id` is set.
#[tauri::command]
pub async fn devices_journal(
    devices: DevicesState<'_>,
    id: Option<String>,
    limit: Option<u32>,
) -> Result<Vec<JournalView>, String> {
    let lines = devices
        .device
        .journal_recent(limit.unwrap_or(50).min(200), id)
        .await
        .map_err(|e| e.to_string())?;
    Ok(lines
        .into_iter()
        .map(|l| JournalView {
            peer_short_id: short(&l.peer_id),
            seq: l.seq,
            at: l.at,
            outgoing: l.outgoing,
            peer_id: l.peer_id,
            peer_name: l.peer_name,
            agent: l.agent,
            capability: l.capability,
            target: l.target,
            decision: l.decision,
            approved: l.approved,
            outcome: l.outcome,
        })
        .collect())
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    #[test]
    fn shared_files_stay_in_their_folder() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("notes.pdf"), b"x").unwrap();
        std::fs::write(dir.path().join(".hidden"), b"x").unwrap();
        std::fs::create_dir(dir.path().join("sub")).unwrap();
        std::fs::write(dir.path().join("sub").join("deep.txt"), b"x").unwrap();
        let outside = tempfile::tempdir().unwrap();
        std::fs::write(outside.path().join("secret.txt"), b"x").unwrap();

        assert!(file_in(dir.path(), "notes.pdf").is_ok());
        assert!(file_in(dir.path(), "sub").is_err(), "folders are not files");
        assert!(file_in(dir.path(), "sub/deep.txt").is_err(), "no paths");
        assert!(file_in(dir.path(), r"..\secret.txt").is_err());
        assert!(file_in(dir.path(), "../secret.txt").is_err());
        assert!(file_in(dir.path(), "missing.txt").is_err());

        let listed = list_files(dir.path());
        assert_eq!(listed.len(), 1, "{listed:?}");
        assert_eq!(listed[0]["name"], "notes.pdf");
    }

    #[test]
    fn this_pc_describes_itself() {
        let version = windows_version().expect("RtlGetVersion answers");
        assert!(version.starts_with("10.0."), "{version}");
        assert_ne!(this_pc_kind(), DeviceKind::Unknown);
    }
}
