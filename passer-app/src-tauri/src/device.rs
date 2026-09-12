use rand::Rng;

use crate::paths::get_device_id_path;

/// Length of the persistent device id. Not a secret - it only has to be
/// collision-free, so it is shorter than the pairing token.
const DEVICE_ID_LEN: usize = 16;

/// Maximum length of the derived mDNS label. A DNS label allows 63 characters;
/// this is kept shorter so the name stays readable in a device picker.
const MAX_LABEL_LEN: usize = 30;

/// Human-readable machine name, as shown in a device picker.
pub fn display_name() -> String {
    std::env::var("COMPUTERNAME").unwrap_or_else(|_| "PC".to_string())
}

/// DNS label derived from the machine name, so every PC advertises a distinct
/// mDNS host. Previously every install claimed `passer.local`, which meant two
/// Passer machines on one network resolved to whichever answered first - a
/// phone could then send its token, and its files, to the wrong PC.
pub fn mdns_label() -> String {
    let mut label: String = display_name()
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect();

    // A label may not contain runs of separators, nor lead or trail with one.
    while label.contains("--") {
        label = label.replace("--", "-");
    }

    label = label.trim_matches('-').chars().take(MAX_LABEL_LEN).collect();
    label = label.trim_matches('-').to_string();

    if label.is_empty() {
        "passer".to_string()
    } else {
        label
    }
}

/// Fully qualified mDNS name, e.g. `walson-laptop.local`.
pub fn mdns_host() -> String {
    format!("{}.local", mdns_label())
}

/// Stable identifier for this machine, generated once and persisted.
///
/// The machine name alone is not enough to recognise a paired PC: it can be
/// renamed, and two machines can share a name. This lets a paired device
/// confirm it is talking to the PC it paired with before sending its token.
pub fn load_or_create_device_id() -> String {
    if let Ok(existing) = std::fs::read_to_string(get_device_id_path()) {
        let trimmed = existing.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }

    let id: String = rand::thread_rng()
        .sample_iter(&rand::distributions::Alphanumeric)
        .take(DEVICE_ID_LEN)
        .map(char::from)
        .collect();

    if let Err(e) = std::fs::write(get_device_id_path(), &id) {
        eprintln!(" [DEVICE] Failed to persist device id: {}", e);
    }
    id
}
