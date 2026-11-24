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
    CapabilitySpec, DeviceKind, EffectKind, NetworkKind, PasserDevice, PasserError,
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
        device.set_device_details(
            this_pc_kind(),
            windows_version(),
            Some(app.package_info().version.to_string()),
        );
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
    call_member(&devices, id, "clipboard.write", json!({ "text": text })).await?;
    Ok(())
}

/// Copies a member's clipboard text onto this PC. Returns how many characters came.
#[tauri::command]
pub async fn devices_get_clipboard(devices: DevicesState<'_>, id: String) -> Result<usize, String> {
    let out = call_member(&devices, id, "clipboard.read", json!({})).await?;
    let text = out["text"].as_str().unwrap_or_default().to_owned();
    let count = text.chars().count();
    tokio::task::spawn_blocking(move || arboard::Clipboard::new().and_then(|mut c| c.set_text(text)))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    Ok(count)
}

/// Sends a small file to a member (base64, 700 KB at most until the core has streams).
#[tauri::command]
pub async fn devices_send_file(
    devices: DevicesState<'_>,
    id: String,
    name: String,
    data_base64: String,
) -> Result<(), String> {
    if data_base64.len() > MAX_FILE_BYTES * 4 / 3 + 4 {
        return Err("This file is too large for now (700 KB at most).".into());
    }
    call_member(&devices, id, "file.receive", json!({ "name": name, "data_base64": data_base64 })).await?;
    Ok(())
}

#[tauri::command]
pub fn devices_answer_approval(devices: DevicesState<'_>, id: u64, allow: bool) -> bool {
    devices.answer(id, allow)
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
    fn this_pc_describes_itself() {
        let version = windows_version().expect("RtlGetVersion answers");
        assert!(version.starts_with("10.0."), "{version}");
        assert_ne!(this_pc_kind(), DeviceKind::Unknown);
    }
}
