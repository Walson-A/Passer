# Frontend Architecture (React/Vite)

The frontend is a lightweight React Application tailored for transient interactions. It lives in `passer-app/src` and employs the **Premium Glass** design language.

## 🎨 Visual Identity
The app uses TailwindCSS 4 and pure CSS `backdrop-filter` to enforce the "glassmorphism" aesthetic.
- The window is borderless and transparent.
- Background uses extremely subtle gradients and noise meshes.

## 🧩 Key Components

### `App.tsx` The State Machine
`App.tsx` directly listens to Tauri IPC events (`log` queue). When the backend processes `PUSH` or `PULL` events, `App.tsx` updates its state (`idle` -> `pushing` -> `success`), which trickles down to orchestrate smooth UI animations.

### `ServerStatusBar.tsx`
A pill-shaped indicator living in the Passboard view, doubling as the server toggle. Every label is written from this PC's point of view:

| State | Label |
| ----- | ----- |
| Listener bound, idle | `Ready` |
| Server stopped | `Paused` |
| A device is sending to this PC | `Receiving...` |
| A device is fetching from this PC | `Sending...` |
| Just completed | `Done!` |
| Mid toggle | `Starting...` / `Stopping...` |

It says `Ready` at rest rather than `Receiving`, which would claim an action that is not happening; `Receiving...` is reserved for when a transfer really is in flight. Its on/off state follows `server-started` / `server-stopped` and is seeded from `get_server_status`, so it reflects whether the socket is genuinely bound rather than assuming it is.

> ⚠️ **`backdrop-filter` renders dark in this window.** The app runs with `"transparent": true`, so a backdrop filter samples semi-transparent pixels and composites them *darker* rather than producing frosted glass. A `backdrop-blur-[2px]` on the status pill turned it into a near-black bar even though its fill was white at 0.5% opacity — the blur was making it opaque, not glassy. Blur is applied once, on the window shell in `Layout.tsx`; nested elements should get their glass from fill and border alone. Check this before adding `backdrop-blur` to any small element.

### `Passboard.tsx`
The primary feed component representing the history of transfers. Instead of a database, this is an ephemeral runtime history, bringing the latest items to the top seamlessly.
- **`HistoryItemRow.tsx`**: A granular row component with deep interactions (click to copy, click to open native file).

### `DropZone.tsx`
A graceful full-screen absolute layover that captures dragging events. Highly optimized to prevent unwanted browser default behaviours.

### `Settings.tsx`
A glass modal opened from the footer gear. Reads and writes real preferences over IPC: a **Launch on startup** toggle (`get_autostart` / `set_autostart`), a copyable server address, and the app version (`get_app_version`).

### `Hud.tsx`
The corner notification, rendered into its own always-on-top window (see `backend.md`). It reports a transfer while the main window is out of sight, then retires after four seconds. Clicking it brings Passer back.

> ⚠️ **It polls; it is not pushed to.** Events emitted from Rust never arrive in this window's webview. That was verified three times — a broadcast `emit`, a `WebviewWindow::emit` immediately after `show()`, and the same 250 ms later; the last two reported success and neither was ever received, while `invoke` *from* that webview worked throughout. So the HUD asks `get_last_transfer` every 400 ms and compares a sequence number, which needs nothing delivered inwards. Do not "simplify" this back into a listener.

## 🔬 Benches

Two instruments, for two different questions.

**`/banc.html` — the look.** `npm run dev`, then open it. Every variant of the HUD replays **at the same time, on a loop**: entry curves side by side, shadows side by side, and each payload shape. Nothing to click — you watch and compare, because a motion judged alone always looks about right, and only a neighbour reveals which is mushy and which is abrupt. The frames reproduce the real window (396×172) with its 32px inset so a shadow gets exactly the room it will really have, and the background switches between a dark desktop, a light one and a busy photo — a shadow that behaves on black can be a smear on white.

It renders the real `HudCard`, not a copy: a bench showing a lookalike stops being evidence the moment the two drift. It is deliberately **absent from `vite.config.ts`**, so it is dev-only and weighs nothing in the packaged app. It has already earned itself — it caught that every received image was labelled "File", which was invisible until the cases sat side by side.

**`scripts/hud-bench.ps1` — the behaviour.** Hides the main window, fires real transfers through the REST API, and asserts that the HUD appears, lands where it should, and retires itself. `-Hold` keeps it on screen by re-firing, `-Kind text|image|file` picks the path, `-KeepMainVisible` checks it correctly declines. It reads the window size from `tauri.conf.json` and `MARGIN` from `hud.rs`, so changing either cannot leave the bench asserting against stale numbers.

## ♻️ State Management (`useHistory.ts`)
A custom hook that coordinates adding, deleting, and updating history objects locally. It listens for the backend's structured **`transfer`** events (typed `{ kind, direction, target, name, path, size }` payloads) rather than parsing human-readable log strings, so the feed stays robust as log wording changes.
