# Backend Architecture (Rust/Tauri)

The backend powers the desktop application by providing an interface with the OS, managing the HTTP/REST APIs, and orchestrating native OS features. It resides in the `src-tauri/src/` directory.

## 🚀 Application Lifecycle (`lib.rs`)
- Extends the core Tauri builder.
- Manages plugins:
  - `tauri-plugin-single-instance`: **Registered first**, as the plugin requires. A second launch no longer starts a rival process that silently fails to bind port 8000 — it shows, unminimises and focuses the window already running.
  - `tauri-plugin-autostart`: Allows the application to launch silently on boot. Enabled on first run only (via a `.initialized` marker), so a user who later turns it off is not overridden at every launch.
  - `tauri-plugin-opener`: Safe handling of external URLs or files.
- Positions the window dynamically at the bottom right corner of the primary monitor using `monitor.work_area()` and `window.outer_size()`.

## 🖥️ Commands & IPC (`commands.rs`)
The IPC (Inter-Process Communication) gateway between the React frontend and Rust system access.
- **`get_ip`**: Fetches the local IP address using the `local_ip_address` crate.
- **`open_downloads`**: Opens the `Passboard` folder (Push/Pull files) in the native file explorer.
- **`open_webdav`**: Opens the `Passer Space` shared folder in the native file explorer.
- **`get_webdav_creds`**: Returns the WebDAV credentials held in state (used only once the WebDAV server is enabled — see `api.md`).
- **`toggle_server`**: Starts or stops the local Axum HTTP server (port 8000) safely from the UI.
- **`get_server_status`**: Whether the listener is bound *right now*, read from a `listening` flag on `ServerState`. The UI seeds itself from this on mount and then follows the `server-started` / `server-stopped` events, which `server.rs` emits only once the socket has really come up or gone down. Previously the UI assumed the server was running, so a failed bind — port already taken — still displayed as receiving.
- **`get_device_info`**: Machine name plus its mDNS address, IP and port, for any surface that shows or copies an address. Carries no secret, unlike `get_pairing_info`.
- **`get_pairing_info`**: Everything a device needs to pair, including the token and the stable device id (see `api.md`).
- **`get_autostart` / `set_autostart`**: Read and write the launch-on-login preference.
- **`get_pairing_token` / `regenerate_pairing_token`**: Read the pairing secret, or rotate it and invalidate every paired device.
- **`handle_file_drop`**: Copies files dragged onto the window into the `Passer Space` folder, renaming to avoid collisions.
- **`set_window_on_top`**: Toggles the always-on-top ("pin") window flag.
- **`delete_cache_file`**: Deletes a cached preview image, validated to stay inside the `.cache` directory.

## 🔔 Transfer HUD (`hud.rs`)
A second window, declared in `tauri.conf.json` as `hud` (320×96, transparent, undecorated, always on top, off the taskbar, `focus` and `focusable` both false). It loads the same `index.html` as the main window and is told apart by its label in `main.tsx`, so there is one frontend bundle rather than two.

- **`notify`** is called from each transfer site in `clipboard.rs` and `files.rs`. It records the transfer with an incrementing sequence number, and shows the window — but only when the main window is hidden, since the HUD exists to report what happens while Passer is out of sight.
- Positioning uses `monitor.work_area()`, not `monitor.size()`: the work area already excludes the taskbar, so nothing has to guess its height or cope with it being moved, hidden or scaled.
- **Rust drives the window; the frontend only draws.** The HUD cannot show itself, because while hidden its webview receives nothing — see the warning in `frontend.md`.
- Commands: `get_last_transfer` (what to draw), `hide_hud` (the frontend's dismiss), `focus_main_window` (clicking the HUD).

## 🔗 Device network (`devices.rs`)
The new way devices talk to this PC, built on [passer-core](https://github.com/Walson-A/passer-core) (pinned by commit in `Cargo.toml`). It runs **next to** the legacy HTTP API, which keeps serving the iOS Shortcuts.

- **Identity**: `PasserDevice::open_on_desktop` keeps this PC's key in `%APPDATA%\Passer\devices\device.key`, encrypted with DPAPI. The group's signed device log, the permission rules (`policy.json`) and the call journal live in the same folder.
- **Start**: at launch if the PC already belongs to a group; otherwise after `devices_create_group` or `devices_join`.
- **What other devices of the group may ask this PC** (the core checks membership, input schema, rules, approval and journals every call *before* `PcCapabilities::invoke` runs):

  | Capability | Effect | Default | What it does |
  |---|---|---|---|
  | `device.info` | read | allowed | name, kind (laptop or desktop: a PC with a battery is a laptop), Windows version (`RtlGetVersion`), Passer and passer-core versions |
  | `clipboard.write` | write | allowed | puts text (≤ 200 000 characters) on the clipboard; history + HUD |
  | `clipboard.read` | sensitive | **asks** | returns the clipboard text after the user approves |
  | `file.receive` | write | allowed | saves a small file (≤ 700 KB, sent inline) into the Passboard folder, base name only; kept for older apps |
  | `file.drop` | write | allowed | receives a file of any size (up to 4 GB) as a stream; the core keeps it private until it is complete, then it moves into the Passboard folder, base name only |
  | `file.list` | read | allowed | lists the files directly in the Passer Space folder (name, size, date), newest first, at most 500 |
  | `file.get` | read | allowed | streams a file from the Passer Space folder, by exact name: no path, no link leading out of the folder |

- **Approvals**: `WindowPrompter` brings the main window forward and emits `approval-request`; the frontend answers with `devices_answer_approval`. No answer within 55 s means no (the core's own limit is 60 s). `approval-closed` removes the card.
- **Joins**: when a device joins through an invitation of this PC, `device-joined` carries its name and the 6-digit code to compare. The PC then asks the newcomer what it is and offers, and emits `devices-changed` when it has answered.
- **What the other members are and offer**: after start, on a join, and on `devices_refresh`, the core asks each member for `bus.capabilities` and, only where it runs without approval, `device.info`. Answers are cached in `devices\members.json` for display only: every call is still decided by the target. A refresh never makes another device ask its user anything.
- **Network**: n0's development relays for now (`NetworkKind::N0Dev`), shown as a preview in the UI. Production needs Passer's own relay and coordination server.
- **Commands**: `devices_status` (members with kind, OS, versions and when they last answered), `devices_create_group`, `devices_join`, `devices_invite` (one-time link, 10 min, optionally as approver), `devices_remove`, `devices_stop_sessions` (the stop button), `devices_answer_approval`, `devices_refresh`, `devices_capabilities` (what a member lets this PC call, and what needs approval), `devices_journal` (calls made and received, newest first, never their content; optionally with one member), `devices_fetch_file` (a file by name from a member's `file.get`, into Passboard, emitting `device-transfer-progress` `{id, done, total}`).

## 🖥️ Screen (`screen.rs`)
Other devices of the group can see this PC's screen (`screen.view`) and take control (`screen.control`), when Vasistas is installed (`PASSER_VASISTAS`, or `vasistas.exe` on the PATH; `devices_screen_status` says which).

- **How**: passer-core's `passer-exec` runs `vasistas share --lang fr --viewer <caller> [--control]` and wires its stdio to the stream; Vasistas captures, encodes, applies the viewer's input and shows its own sign on screen.
- **Who**: the group's own devices, without a confirmation on this PC (a rule added once to `devices\policy.json`), as Walson decided; AI agents get nothing. Effect `sensitive`, so a session lasts at most 15 minutes; the viewer reconnects after.
- **Stopping**: Escape on this PC (Vasistas), the stop button (`devices_stop_sessions`), or removing the device; the process is killed when its session ends.
- **Indicator**: passer-core refuses these capabilities without one. `WindowIndicator` records live sessions (`devices_screen_sessions`) and emits `screen-session-started` / `screen-session-ended` for the window.
- **Not covered**: a locked PC or UAC prompts (Vasistas cannot see the secure desktop).

## ✂️ Core Utilities
- **`clipboard.rs`**: Safe reading and writing to the system clipboard (Text, HTML, Image, file lists) for iOS push/pull integrations.
- **`paths.rs`**: Resolves core application directories under `Desktop/Passer/` (`Passboard/` for Push/Pull, `Passer Space/` for the shared folder, `.cache/` for previews) and guarantees collision-free filenames.
- **`files.rs`**: Receives multipart file payloads, writes them to the local file system (sanitizing filenames against path traversal), and injects the results into the Windows clipboard as a native file list.

## tray.rs
- Provides a context menu when the user right-clicks the system tray icon (Quit, Show/Hide).
