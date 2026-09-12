# API & Network Integration

The core value proposition of Passer is bridging the iPhone ecosystem with the PC effortlessly. A background HTTP server and an mDNS advertiser make this work over the local network.

## 1. The REST API (`server.rs`)
Running on port `8000`, this standard HTTP server built with the Rust `axum` framework fields requests from iOS Shortcuts.

- **`GET /pull`**: Responds with the PC's current clipboard. It returns a ZIP archive when files are copied, a PNG when an image is copied, and otherwise the plain text (falling back to `CF_HTML` stripped of its tags for sources such as ChatGPT).
- **`POST /push`**: Overwrites the PC clipboard with plaintext (JSON body `{ "text": "..." }`).
- **`POST /push/image`**: Reads a multipart image and sets it as the PC clipboard image. A copy is cached under `Passer/.cache/` so it can be previewed in the history feed.
- **`POST /push/file`**: Uploads arbitrary files. Each file is written to `Desktop/Passer/Passboard/<category>/` (Images, Videos, Audio, Documents, Misc), and the saved paths are injected into the Windows clipboard as a native file list so they can be pasted directly.
- **`GET /ping`**: Unauthenticated liveness probe. Lets a device confirm it is talking to the machine it paired with *before* sending its token. Exposes no user data.

```json
{ "app": "passer", "version": "1.0.0", "host": "WALSON-LAPTOP",
  "name": "WALSON-LAPTOP", "mdns": "walson-laptop.local", "id": "fSNmP3mMLvF1TTAA" }
```

| Field | Meaning |
| ----- | ------- |
| `host` | Display name. Kept with its original meaning for existing clients. |
| `name` | Explicit synonym of `host`, matching `name` in the pairing payload. |
| `mdns` | The machine's mDNS address. Note this is what the pairing payload calls `host` — the two surfaces used the same word for different things, so the address gets its own field here rather than overloading `host`. |
| `id`   | Stable machine identifier (see the pairing payload). |

## Pairing token
Every route except `/ping` requires a **pairing token**. Without it the server replies `401 Unauthorized`.

- Send it as the `X-Passer-Token` header, or as a `?token=...` query parameter when custom headers are inconvenient.
- The token is 32 random alphanumeric characters, generated on first run and persisted to `%APPDATA%\Passer\pairing.token` so it survives restarts — a token that rotated every launch would force the Shortcuts to be re-edited constantly.
- It is stored outside the user-visible `Passer` folder so it is never exposed alongside shared files.
- Copy it from **Passer → Settings**, and paste it into each Shortcut's headers. Regenerating it from Settings immediately invalidates every previously paired device.
- Comparison is constant-time, and the HTTP server and the UI read the same in-memory token, so a regeneration takes effect without restarting the server.

### Pairing payload (QR code)
**Passer → Settings → Pair a device** renders a QR code encoding a single URL. This is the contract the mobile app parses:

```
passer://pair?v=1&name=WALSON-LAPTOP&host=walson-laptop.local&ip=<LAN IP>&port=8000&token=<token>&id=<id>
```

| Field  | Meaning |
| ------ | ------- |
| `v`    | Payload version, so the app can handle future format changes. Unknown parameters must be ignored, so additions do not bump it. |
| `name` | Human-readable machine name (`COMPUTERNAME`), for a device picker. |
| `host` | Preferred address — the machine's mDNS name, including `.local`. Survives IP changes. |
| `ip`   | Current LAN IP, a fallback for networks where `.local` resolution fails. |
| `port` | REST API port (`SERVER_PORT`, shared with the server so the payload can never advertise an unbound port). |
| `token`| The pairing token to send as `X-Passer-Token`. |
| `id`   | Stable machine identifier, generated once and persisted to `%APPDATA%\Passer\device.id`. A client should check it against `/ping` before sending the token: the machine name is not enough, since a PC can be renamed and two PCs can share a name. |

A client should try `host` first and fall back to `ip`. Because the payload carries the secret, the pairing screen warns against sharing or screenshotting the code.

### Error responses
Failures use a real HTTP status code and a single body shape:

```json
{ "status": "error", "message": "..." }
```

| Status | When |
| ------ | ---- |
| `400`  | The request was understood but unusable — `/push/image` with no image part, `/push/file` with nothing saved. |
| `401`  | Missing or invalid pairing token (any route except `/ping`). |
| `500`  | The clipboard could not be read or written. |

One deliberate exception: if `/push/file` writes the files but the clipboard injection afterwards fails, it still returns **200** with `{ "status": "success", "count": N, "clipboard_error": "..." }`. The transfer itself succeeded — the files are on disk, which is what was asked for — and the clipboard is a convenience layered on top.

### Other security notes
- Uploaded filenames are reduced to their base name before being written, so a crafted name cannot use `..` or an absolute path to escape the target directory.
- The server does **not** enable CORS, so a web page in a browser cannot read `/pull` or drive the push endpoints; only non-browser clients (the iOS Shortcuts) can reach the API.
- Traffic stays on the local network (LAN); no external endpoints are exposed.

## 2. Passer Space (Shared Folder)
"Passer Space" is a local folder (`Desktop/Passer/Passer Space/`) meant to act as a drop zone shared with the iPhone. Files dragged onto the app window, or added from the UI, land here. The app surfaces an `smb://<machine>.local` address (e.g. `smb://walson-laptop.local`) so the folder can be reached from the iOS **Files** app once the folder is shared at the OS level.

> **Note:** A self-contained WebDAV server (`webdav.rs`, port `8001`, HTTP Basic auth with a random per-launch password) is included in the codebase but is **not started by default**. Wiring it up so Passer Space works with no manual OS sharing is planned — see the roadmap.

## 3. Network Discovery (`mdns.rs`)
To prevent the user from constantly updating IP addresses in their iOS Shortcuts, Passer broadcasts an mDNS (Multicast DNS) signal over the local network.
- Registers the service `_passer._tcp.local.` on port `8000`. Both the instance name and the advertised host are derived from `COMPUTERNAME`, lowercased and reduced to a DNS label — `WALSON-LAPTOP` becomes the instance `walson-laptop` and the host `walson-laptop.local`, mapped to the machine's current LAN IP.
- TXT properties carry `id`, `name` and `version`, so a future discovery flow can identify a specific PC from the browse results without connecting first.
- The iPhone resolves `.local` names natively, so a client can target `http://walson-laptop.local:8000` and keep working when the PC's IP changes.

> **Every PC used to advertise `passer.local`.** With two Passer machines on one network that name resolved to whichever answered first, so a phone could send its token — and its files — to the wrong PC. The name is now unique per machine and `passer.local` is no longer registered, which means clients written against the old name (including the original iOS Shortcuts) must be pointed at the new one.
