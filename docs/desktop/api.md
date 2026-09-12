# API & Network Integration

The core value proposition of Passer is bridging the iPhone ecosystem with the PC effortlessly. A background HTTP server and an mDNS advertiser make this work over the local network.

## 1. The REST API (`server.rs`)
Running on port `8000`, this standard HTTP server built with the Rust `axum` framework fields requests from iOS Shortcuts.

- **`GET /pull`**: Responds with the PC's current clipboard. It returns a ZIP archive when files are copied, a PNG when an image is copied, and otherwise the plain text (falling back to `CF_HTML` stripped of its tags for sources such as ChatGPT).
- **`POST /push`**: Overwrites the PC clipboard with plaintext (JSON body `{ "text": "..." }`).
- **`POST /push/image`**: Reads a multipart image and sets it as the PC clipboard image. A copy is cached under `Passer/.cache/` so it can be previewed in the history feed.
- **`POST /push/file`**: Uploads arbitrary files. Each file is written to `Desktop/Passer/Passboard/<category>/` (Images, Videos, Audio, Documents, Misc), and the saved paths are injected into the Windows clipboard as a native file list so they can be pasted directly.
- **`GET /ping`**: Unauthenticated liveness probe returning `{ app, version, host }`. Lets a device confirm it is talking to a Passer host (and which machine) before pairing. It exposes no user data.

## Pairing token
Every route except `/ping` requires a **pairing token**. Without it the server replies `401 Unauthorized`.

- Send it as the `X-Passer-Token` header, or as a `?token=...` query parameter when custom headers are inconvenient.
- The token is 32 random alphanumeric characters, generated on first run and persisted to `%APPDATA%\Passer\pairing.token` so it survives restarts — a token that rotated every launch would force the Shortcuts to be re-edited constantly.
- It is stored outside the user-visible `Passer` folder so it is never exposed alongside shared files.
- Copy it from **Passer → Settings**, and paste it into each Shortcut's headers. Regenerating it from Settings immediately invalidates every previously paired device.
- Comparison is constant-time, and the HTTP server and the UI read the same in-memory token, so a regeneration takes effect without restarting the server.

### Other security notes
- Uploaded filenames are reduced to their base name before being written, so a crafted name cannot use `..` or an absolute path to escape the target directory.
- The server does **not** enable CORS, so a web page in a browser cannot read `/pull` or drive the push endpoints; only non-browser clients (the iOS Shortcuts) can reach the API.
- Traffic stays on the local network (LAN); no external endpoints are exposed.

## 2. Passer Space (Shared Folder)
"Passer Space" is a local folder (`Desktop/Passer/Passer Space/`) meant to act as a drop zone shared with the iPhone. Files dragged onto the app window, or added from the UI, land here. The app surfaces an `smb://passer.local` address so the folder can be reached from the iOS **Files** app once the folder is shared at the OS level.

> **Note:** A self-contained WebDAV server (`webdav.rs`, port `8001`, HTTP Basic auth with a random per-launch password) is included in the codebase but is **not started by default**. Wiring it up so Passer Space works with no manual OS sharing is planned — see the roadmap.

## 3. Network Discovery (`mdns.rs`)
To prevent the user from constantly updating IP addresses in their iOS Shortcuts, Passer broadcasts an mDNS (Multicast DNS) signal over the local network.
- Registers the service `_passer._tcp.local.` (instance `passer`) on port `8000`, advertising the host `passer.local` mapped to the machine's current LAN IP.
- The iPhone resolves `passer.local` natively, so Shortcuts can target `http://passer.local:8000` and keep working even when the PC's IP changes.
