//! "See the screen" and "take control", offered to the other devices of the group.
//!
//! The work is Vasistas's (`vasistas share`): it captures the screen, encodes it, and
//! applies the viewer's mouse and keyboard, speaking its own protocol on stdio. passer-core
//! runs it through `passer_exec` and wires its stdio to the stream, after the usual
//! checks: member of the group, permission rule, visible indicator, session that the stop
//! button or Escape on this PC ends (which kills the process).
//!
//! Decided with Walson: only his own devices; they may view and take control without a
//! confirmation on this PC, because Vasistas shows a visible sign and Escape stops it; no
//! access to a locked PC or to UAC prompts (Vasistas cannot see the secure desktop).

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

/// The rule that lets the group's own devices view and control without asking. Agents
/// are not devices (`Who::AnyDevice` excludes them), so they still get nothing.
pub fn trusted_devices_rule() -> Rule {
    Rule {
        who: Who::AnyDevice,
        capability: "screen.*".into(),
        target: None,
        decision: Decision::Allow,
        lease_secs: Some(SESSION_SECS),
    }
}

/// Adds the rule to the device's `policy.json` once, keeping any other rule.
pub fn ensure_rule(home: &std::path::Path) -> Result<(), String> {
    let path = home.join("policy.json");
    let mut policy: Policy = match std::fs::read_to_string(&path) {
        Ok(text) => serde_json::from_str(&text).map_err(|e| e.to_string())?,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Policy::default(),
        Err(e) => return Err(e.to_string()),
    };
    let rule = trusted_devices_rule();
    if policy.rules.iter().any(|r| r.capability == rule.capability && r.who == rule.who) {
        return Ok(());
    }
    policy.rules.push(rule);
    std::fs::create_dir_all(home).map_err(|e| e.to_string())?;
    std::fs::write(&path, serde_json::to_string_pretty(&policy).map_err(|e| e.to_string())?)
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
