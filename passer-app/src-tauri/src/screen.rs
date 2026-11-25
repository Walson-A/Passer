//! "See the screen" and "take control", offered to the other devices of the group.
//!
//! The work is Vasistas's (`vasistas share`): it captures the screen, encodes it, and
//! applies the viewer's mouse and keyboard, speaking its own protocol on stdio. passer-core
//! runs it through `passer_exec` and wires its stdio to the stream, after the usual
//! checks: member of the group, permission rule, visible indicator, session that the stop
//! button or Escape on this PC ends (which kills the process).
//!
//! Decided with Walson (25 Nov 2026): viewing and taking control **ask on this PC** by
//! default (sensitive capabilities, the core's default rule), and each device can be
//! allowed to do either **without asking** - a per-device rule set from its Details
//! panel, for his own phone when he is away from the PC. Agents never get it. No access
//! to a locked PC or to UAC prompts yet (Vasistas cannot see the secure desktop);
//! unlocking remotely is planned as a separate switch.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, Weak};

use passer_ffi::passer_bus::{
    Decision, Effect, Indicator, LeaseInfo, Policy, Rule, Who,
};
use passer_ffi::PasserDevice;
use serde::Serialize;
use tauri::{AppHandle, Emitter};

/// The longest a sensitive session lasts in passer-core; the viewer reconnects after.
const SESSION_SECS: u64 = 15 * 60;

/// Whether this PC can share its screen, for the window ("Vasistas is not installed").
#[derive(Serialize, Clone)]
pub struct ScreenStatus {
    pub available: bool,
    pub vasistas: Option<String>,
}

/// Where Vasistas is: `PASSER_VASISTAS` if set, else `vasistas.exe` on the PATH.
pub fn find_vasistas() -> Option<PathBuf> {
    if let Some(path) = std::env::var_os("PASSER_VASISTAS").map(PathBuf::from) {
        return path.is_file().then_some(path);
    }
    let exe = if cfg!(windows) { "vasistas.exe" } else { "vasistas" };
    std::env::split_paths(&std::env::var_os("PATH")?)
        .map(|dir| dir.join(exe))
        .find(|p| p.is_file())
}

/// The two capabilities, running `program`.
pub fn commands(program: PathBuf) -> Vec<passer_exec::Command> {
    let command = |name: &str, title: &str, description: &str, control: bool| {
        // Two arguments: Vasistas takes the next one as the name, as is, even if it
        // starts with `--` (and passer-exec refuses such names anyway).
        let mut args: Vec<String> = ["share", "--lang", "fr", "--viewer", "{caller_name}"]
            .map(String::from)
            .to_vec();
        if control {
            args.push("--control".to_owned());
        }
        passer_exec::Command {
            name: name.into(),
            title: title.into(),
            description: description.into(),
            effect: Effect::Sensitive,
            indicator: true,
            program: program.clone(),
            args,
        }
    };
    vec![
        command(
            "screen.view",
            "See the screen",
            "Shows this PC's screen, live. The person in front of it sees a sign and can stop it with Escape.",
            false,
        ),
        command(
            "screen.control",
            "Take control",
            "Shows this PC's screen and lets the viewer use its mouse and keyboard. Escape on this PC stops it.",
            true,
        ),
    ]
}

/// Earlier builds of this branch let every device of the group view and control
/// without asking (`Who::AnyDevice`, `screen.*`, allow). Removed at start, so a PC
/// that ran them is back to asking.
pub fn remove_group_rule(home: &std::path::Path) -> Result<(), String> {
    let mut policy = read_policy(home)?;
    let before = policy.rules.len();
    policy.rules.retain(|r| !(r.who == Who::AnyDevice && r.capability == "screen.*"));
    if policy.rules.len() != before {
        write_policy(home, &policy)?;
    }
    Ok(())
}

/// What one device may do with this PC's screen without asking.
#[derive(Serialize, Clone, Default)]
pub struct ScreenRules {
    pub view: bool,
    pub control: bool,
}

fn device_who(id: &str) -> Result<Who, String> {
    // `Who::Device` holds the core's `DeviceId`, which this crate cannot name: go through
    // its serde form, which is the one `policy.json` uses anyway.
    serde_json::from_value(serde_json::json!({ "kind": "device", "id": id })).map_err(|e| e.to_string())
}

pub fn rules_for(home: &std::path::Path, id: &str) -> Result<ScreenRules, String> {
    let who = device_who(id)?;
    let policy = read_policy(home)?;
    let allowed = |cap: &str| policy.rules.iter().any(|r| r.who == who && r.capability == cap && r.decision == Decision::Allow);
    Ok(ScreenRules { view: allowed("screen.view"), control: allowed("screen.control") })
}

/// Lets one device view (`screen.view`) or control (`screen.control`) without asking,
/// or takes that back. The rule is the device's own: a device added later gets nothing.
pub fn set_rule(home: &std::path::Path, id: &str, capability: &str, allow: bool) -> Result<(), String> {
    if capability != "screen.view" && capability != "screen.control" {
        return Err(format!("not a screen capability: {capability}"));
    }
    let who = device_who(id)?;
    let mut policy = read_policy(home)?;
    policy.rules.retain(|r| !(r.who == who && r.capability == capability));
    if allow {
        // Ahead of the defaults, so it wins over the "sensitive asks" rule.
        policy.rules.insert(0, Rule {
            who,
            capability: capability.into(),
            target: None,
            decision: Decision::Allow,
            lease_secs: Some(SESSION_SECS),
        });
    }
    write_policy(home, &policy)
}

fn read_policy(home: &std::path::Path) -> Result<Policy, String> {
    match std::fs::read_to_string(home.join("policy.json")) {
        Ok(text) => serde_json::from_str(&text).map_err(|e| e.to_string()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Policy::default()),
        Err(e) => Err(e.to_string()),
    }
}

fn write_policy(home: &std::path::Path, policy: &Policy) -> Result<(), String> {
    std::fs::create_dir_all(home).map_err(|e| e.to_string())?;
    std::fs::write(home.join("policy.json"), serde_json::to_string_pretty(policy).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())
}

/// A session on this PC's screen, as the window shows it.
#[derive(Serialize, Clone)]
pub struct ScreenSession {
    pub id: u64,
    /// The device viewing, as named in the group.
    pub device: String,
    pub device_id: String,
    /// True when the viewer may also use the mouse and keyboard.
    pub control: bool,
    pub started_at: u64,
}

/// The indicator passer-core requires: it tells the window which sessions are live, so
/// it can show who is watching and offer the stop button.
pub struct WindowIndicator {
    pub app: AppHandle,
    pub device: Weak<PasserDevice>,
    pub sessions: Arc<Mutex<HashMap<u64, ScreenSession>>>,
}

impl Indicator for WindowIndicator {
    fn show(&self, lease: &LeaseInfo) {
        let device_id = lease.subject.device.to_string();
        let device = self
            .device
            .upgrade()
            .and_then(|d| d.member_name(&device_id))
            .unwrap_or_default();
        let session = ScreenSession {
            id: lease.id,
            device,
            device_id,
            control: lease.capability == "screen.control",
            started_at: passer_ffi_now(),
        };
        self.sessions
            .lock()
            .expect("sessions lock")
            .insert(lease.id, session.clone());
        let _ = self.app.emit("screen-session-started", session);
    }

    fn hide(&self, lease_id: u64) {
        self.sessions.lock().expect("sessions lock").remove(&lease_id);
        let _ = self.app.emit("screen-session-ended", lease_id);
    }
}

fn passer_ffi_now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_rule_is_added_once_and_keeps_the_others() {
        let dir = tempfile::tempdir().unwrap();
        let other = Rule {
            who: Who::AnyAgent,
            capability: "device.info".into(),
            target: None,
            decision: Decision::Allow,
            lease_secs: None,
        };
        std::fs::write(
            dir.path().join("policy.json"),
            serde_json::to_string(&Policy { rules: vec![other.clone()] }).unwrap(),
        )
        .unwrap();
        ensure_rule(dir.path()).unwrap();
        ensure_rule(dir.path()).unwrap();
        let policy: Policy =
            serde_json::from_str(&std::fs::read_to_string(dir.path().join("policy.json")).unwrap())
                .unwrap();
        assert_eq!(policy.rules, vec![other, trusted_devices_rule()]);
    }

    #[test]
    fn viewers_cannot_turn_into_options() {
        let cmds = commands(PathBuf::from("vasistas.exe"));
        assert_eq!(cmds[0].args, vec!["share", "--lang", "fr", "--viewer", "{caller_name}"]);
        assert_eq!(
            cmds[1].args,
            vec!["share", "--lang", "fr", "--viewer", "{caller_name}", "--control"]
        );
        assert!(cmds.iter().all(|c| c.indicator && c.effect == Effect::Sensitive));
    }
}
