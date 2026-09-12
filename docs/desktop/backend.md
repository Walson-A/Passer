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

## ✂️ Core Utilities
- **`clipboard.rs`**: Safe reading and writing to the system clipboard (Text, HTML, Image, file lists) for iOS push/pull integrations.
- **`paths.rs`**: Resolves core application directories under `Desktop/Passer/` (`Passboard/` for Push/Pull, `Passer Space/` for the shared folder, `.cache/` for previews) and guarantees collision-free filenames.
- **`files.rs`**: Receives multipart file payloads, writes them to the local file system (sanitizing filenames against path traversal), and injects the results into the Windows clipboard as a native file list.

## tray.rs
- Provides a context menu when the user right-clicks the system tray icon (Quit, Show/Hide).
