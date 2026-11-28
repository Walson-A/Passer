//! What this PC could not hand to a sleeping phone, and the notification that wakes it.
//!
//! An iPhone's app is suspended when it is not in front: the PC cannot reach it. So when
//! sending to a member fails because it is unreachable, the item waits here, and the PC
//! asks Expo's push service to show a notification on that phone ("WALSON-HP wants to
//! send you photo.jpg"). When the phone opens (a tap on the notification, or iOS waking
//! it in the background), it asks this PC for what waits for it:
//!
//! | Capability      | Effect | What it does |
//! |-----------------|--------|--------------|
//! | `push.register` | write  | the caller gives its Expo push token (or `null` to stop) |
//! | `outbox.list`   | read   | what waits for the caller: texts inline, files by id |
//! | `outbox.get`    | read   | streams one waiting file, by id |
//! | `outbox.done`   | write  | the caller has it: forget it |
//!
//! Each item is for one device and only that device sees it. Files are kept by path
//! (not copied); an item waits a week at most. No server of ours is involved: the PC
//! calls Expo, which holds the Apple key that EAS set up for the app.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

/// How long an item waits for its phone.
const KEEP_SECS: u64 = 7 * 24 * 3600;
/// At most this many items wait per device: older ones go first.
const MAX_ITEMS: usize = 50;
/// Expo's push endpoint.
const EXPO_PUSH: &str = "https://exp.host/--/api/v2/push/send";

/// Something waiting for one device.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Item {
    pub id: String,
    /// The device it is for.
    pub device_id: String,
    /// `text` (for its clipboard) or `file`.
    pub kind: String,
    /// A file's name.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<u64>,
    /// A text item's text.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    /// A file item's path on this PC; never shown to the phone.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    /// Unix seconds.
    pub at: u64,
}

impl Item {
    /// What the phone sees: no path.
    pub fn public(&self) -> serde_json::Value {
        serde_json::json!({
            "id": self.id,
            "kind": self.kind,
            "name": self.name,
            "size": self.size,
            "text": self.text,
            "at": self.at,
        })
    }
}

#[derive(Serialize, Deserialize, Default)]
struct State {
    /// Expo push token by device id.
    tokens: HashMap<String, String>,
    items: Vec<Item>,
}

pub struct Outbox {
    file: PathBuf,
    state: Mutex<State>,
}

fn now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

impl Outbox {
    /// Opens `outbox.json` in `home` (empty when missing or unreadable).
    pub fn open(home: &std::path::Path) -> Self {
        let file = home.join("outbox.json");
        let state = std::fs::read_to_string(&file)
            .ok()
            .and_then(|text| serde_json::from_str(&text).ok())
            .unwrap_or_default();
        Self { file, state: Mutex::new(state) }
    }

    fn save(&self, state: &State) {
        if let Some(dir) = self.file.parent() {
            let _ = std::fs::create_dir_all(dir);
        }
        if let Ok(text) = serde_json::to_string_pretty(state) {
            let _ = std::fs::write(&self.file, text);
        }
    }

    /// Records (or, with `None`, forgets) a device's Expo push token.
    pub fn set_token(&self, device_id: &str, token: Option<String>) {
        let mut state = self.state.lock().expect("outbox lock");
        match token {
            Some(token) => state.tokens.insert(device_id.to_owned(), token),
            None => state.tokens.remove(device_id),
        };
        self.save(&state);
    }

    pub fn token(&self, device_id: &str) -> Option<String> {
        self.state.lock().expect("outbox lock").tokens.get(device_id).cloned()
    }

    /// Queues an item; returns it with its id and time.
    pub fn add(&self, mut item: Item) -> Item {
        let mut state = self.state.lock().expect("outbox lock");
        item.at = now();
        item.id = format!("{:x}{:04x}", item.at, rand::random::<u16>());
        state.items.push(item.clone());
        let device = item.device_id.clone();
        let mine = state.items.iter().filter(|i| i.device_id == device).count();
        if mine > MAX_ITEMS {
            if let Some(oldest) = state.items.iter().position(|i| i.device_id == device) {
                state.items.remove(oldest);
            }
        }
        self.save(&state);
        item
    }

    /// What waits for a device, oldest first; expired items are dropped on the way.
    pub fn list(&self, device_id: &str) -> Vec<Item> {
        let mut state = self.state.lock().expect("outbox lock");
        let cutoff = now().saturating_sub(KEEP_SECS);
        let before = state.items.len();
        state.items.retain(|i| i.at >= cutoff);
        if state.items.len() != before {
            self.save(&state);
        }
        state.items.iter().filter(|i| i.device_id == device_id).cloned().collect()
    }

    /// One item, only for the device it is for.
    pub fn get(&self, device_id: &str, id: &str) -> Option<Item> {
        self.list(device_id).into_iter().find(|i| i.id == id)
    }

    /// The device has it; returns whether it was there.
    pub fn done(&self, device_id: &str, id: &str) -> bool {
        let mut state = self.state.lock().expect("outbox lock");
        let before = state.items.len();
        state.items.retain(|i| !(i.device_id == device_id && i.id == id));
        let removed = state.items.len() != before;
        if removed {
            self.save(&state);
        }
        removed
    }
}

/// Asks Expo to show `body` under `title` on the phone with `token`, and to wake the
/// app in the background when iOS allows it. Visible on purpose: iOS rations silent
/// pushes, and drops them for an app the user swiped away.
pub async fn notify(token: &str, title: &str, body: &str) -> Result<(), String> {
    let message = serde_json::json!({
        "to": token,
        "title": title,
        "body": body,
        "sound": "default",
        "priority": "high",
        "contentAvailable": true,
        "data": { "passer": "outbox" },
    });
    let response = reqwest::Client::new()
        .post(EXPO_PUSH)
        .header("accept", "application/json")
        .json(&message)
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("push: {e}"))?;
    let status = response.status();
    let answer: serde_json::Value = response.json().await.unwrap_or_default();
    // Expo answers 200 with a ticket per message; a refused one says why in it.
    let ticket = &answer["data"];
    let ticket = if ticket.is_array() { &ticket[0] } else { ticket };
    if !status.is_success() || ticket["status"] == "error" {
        let why = ticket["message"].as_str().or(answer["errors"][0]["message"].as_str()).unwrap_or("refused");
        return Err(format!("push: {why}"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn file_item(device: &str, name: &str) -> Item {
        Item {
            id: String::new(),
            device_id: device.into(),
            kind: "file".into(),
            name: Some(name.into()),
            size: Some(3),
            text: None,
            path: Some(format!("C:\\{name}")),
            at: 0,
        }
    }

    #[test]
    fn items_wait_for_their_own_device_only_and_survive_a_restart() {
        let dir = tempfile::tempdir().unwrap();
        let outbox = Outbox::open(dir.path());
        outbox.set_token("phone", Some("ExponentPushToken[abc]".into()));
        let a = outbox.add(file_item("phone", "a.jpg"));
        outbox.add(file_item("tablet", "b.jpg"));

        let again = Outbox::open(dir.path());
        assert_eq!(again.token("phone").as_deref(), Some("ExponentPushToken[abc]"));
        let mine = again.list("phone");
        assert_eq!(mine.len(), 1);
        assert_eq!(mine[0].name.as_deref(), Some("a.jpg"));
        assert!(again.get("tablet", &a.id).is_none(), "another device can't see it");
        assert!(mine[0].public().get("path").is_none(), "the path stays on the PC");

        assert!(again.done("phone", &a.id));
        assert!(again.list("phone").is_empty());
        again.set_token("phone", None);
        assert!(again.token("phone").is_none());
    }

    #[test]
    fn old_items_go_and_a_device_keeps_at_most_fifty() {
        let dir = tempfile::tempdir().unwrap();
        let outbox = Outbox::open(dir.path());
        for i in 0..55 {
            outbox.add(file_item("phone", &format!("{i}.jpg")));
        }
        let items = outbox.list("phone");
        assert_eq!(items.len(), MAX_ITEMS);
        assert_eq!(items[0].name.as_deref(), Some("5.jpg"), "the oldest went first");

        outbox.state.lock().unwrap().items[0].at = 1;
        assert_eq!(outbox.list("phone").len(), MAX_ITEMS - 1, "a week-old item is dropped");
    }
}
