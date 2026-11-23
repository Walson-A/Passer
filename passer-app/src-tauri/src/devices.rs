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
//! | `clipboard.read` | sensitive | returns the text on this PC's clipboard, after the user approves |
//! | `file.receive`   | write     | saves a small file (< 700 KB) to the Passboard folder |
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
    CapabilitySpec, EffectKind, NetworkKind, PasserDevice, PasserError,
};
use serde::Serialize;
use serde_json::json;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::oneshot;

use crate::paths::{get_config_dir, get_downloads_dir, get_target_dir, get_unique_file_path};
use crate::types::{ServerState, TransferEvent};

/// Until Passer runs its own relays, devices reach each other through n0's public
/// development relays. Development only: see passer-core's docs/security.md.
const NETWORK: NetworkKind = NetworkKind::N0Dev;
/// Longest text accepted on the clipboard from another device.
const MAX_TEXT: usize = 200_000;
/// Largest file accepted before streams exist in the core (base64 in a 1 MiB frame).
const MAX_FILE_BYTES: usize = 700 * 1024;
/// A prompt nobody answers is refused just before the core's own 60 s limit.
const APPROVAL_WAIT: Duration = Duration::from_secs(55);

/// Shared state of the device network.
pub struct Devices {
    pub device: Arc<PasserDevice>,
    pending: Mutex<HashMap<u64, oneshot::Sender<bool>>>,
    next: AtomicU64,
    app: AppHandle,
}

impl Devices {
    /// Opens this PC's identity and, if it already belongs to a group, starts it.
    pub fn init(app: AppHandle, server: Arc<ServerState>) -> Result<Arc<Self>, String> {
        let home = get_config_dir().join("devices");
        let device = PasserDevice::open_on_desktop(home).map_err(|e| e.to_string())?;
        let devices = Arc::new(Self {
            device,
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
        Ok(devices)
    }

    /// Starts serving if this PC is in a group. Safe to call more than once.
    pub async fn start_if_ready(&self) -> Result<(), String> {
        if self.device.has_group() {
            self.device.start(NETWORK, None).await.map_err(|e| e.to_string())?;
        }
        Ok(())
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
        spec(
            "clipboard.read",
            "Read the PC clipboard",
            "Returns the text currently copied on this PC. Its user approves each read.",
            EffectKind::Sensitive,
            json!({ "type": "object", "additionalProperties": false }),
        ),
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
    ]
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

fn failed(message: impl std::fmt::Display) -> PasserError {
    PasserError::Invalid { message: message.to_string() }
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
                    });
                }
                Ok(json!({ "ok": true }).to_string())
            }
            "clipboard.read" => {
                let text = tokio::task::spawn_blocking(|| {
                    arboard::Clipboard::new().and_then(|mut c| c.get_text())
                })
                .await
                .map_err(failed)?
                .unwrap_or_default();
                self.record(TransferEvent {
                    kind: "text".into(),
                    direction: "outgoing".into(),
                    target: "clipboard".into(),
                    name: Some(format!("Read by {}", caller.device_name)),
                    path: None,
                    size: Some(text.len() as u64),
                });
                Ok(json!({ "text": text }).to_string())
            }
            "file.receive" => {
                let raw_name = input["name"].as_str().unwrap_or_default();
                // Same rule as the HTTP upload: keep the base name only, so a sender
                // cannot write outside the Passboard folder.
                let name = std::path::Path::new(raw_name)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .filter(|n| !n.is_empty() && *n != "." && *n != "..")
                    .unwrap_or("received_file")
                    .to_owned();
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
                });
                Ok(json!({ "saved": true, "size": size }).to_string())
            }
            other => Err(failed(format!("unknown capability {other}"))),
        }
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
    }
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

#[tauri::command]
pub fn devices_answer_approval(devices: DevicesState<'_>, id: u64, allow: bool) -> bool {
    devices.answer(id, allow)
}
