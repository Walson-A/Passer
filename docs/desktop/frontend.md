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

### `Devices.tsx`
The **Devices** tab. It talks to the backend only through the `devices_*` commands and the `device-joined` event (see "Device network" in `backend.md`), and renders every device name as plain text — names are chosen by the devices themselves.

| State | What the user sees |
| ----- | ----- |
| Loading | Skeleton rows in the shape of the list, never an empty pane |
| Status failed | "Your devices didn't load", the raw error underneath, **Try again** |
| No group yet | A short explanation, **Start with this PC** (with when to choose it) or **I have an invitation** (with where to get one). The link form folds the illustration away so it and its error stay in view |
| Joined with a link | The 6-digit code to compare, in two groups of three |
| In a group | Group name, "This PC and N other devices", an **Online / Offline** pill; one list with this PC first, then the devices that manage the group, then the rest |
| Offline | An amber note saying other devices can't reach this PC, with a re-check button. *Add a device* says it needs the PC online |
| Not an approver | Instead of *Add a device*: which devices can add or remove one |
| A device joined | The code with **It matches** / **It's different**; the latter arms the removal of that device |
| Remove | An inline confirmation in the row, saying what removing does; Cancel has the focus |
| Action failed | An error card next to the list, plain sentence first, raw detail below |

Per-device presence is not shown: `devices_status` reports whether *this PC's* network runs (`running`), not whether each member is reachable. The pill is therefore the PC's, not the members'.

*Stop remote activity* ends every session other devices have open here (`devices_stop_sessions`); it is hidden while the PC is alone in its group. The footnote is one line, *End-to-end encrypted*; while `development_network` is true it carries a **Preview** toggle that unfolds what the preview network means for the user (test servers that see when devices connect, never what they send). It does not name n0 — that is in `backend.md`, for developers.

The device glyph is guessed from the name (phone, tablet, laptop): the backend sends no device type, and the name is always shown next to it, so a wrong guess costs nothing.

### `DeviceInvite.tsx`
*Add a device*, one level below the tab: it pushes in from the right like *Pair a device* under Settings, and Escape or the back button returns. Two steps, because the role is baked into the invitation: first **what the new device can do** (send and receive, or also add and remove devices — `approver`), then the one-time QR code with its link, a live **expires in m:ss** (the backend's 10 minutes) and an **Expired → New code** state, the "don't share it" warning, and *Copy link* with a *Copied* confirmation. Leaving the tab or the panel drops the code.

### `ApprovalPrompt.tsx`
Mounted above everything in `App.tsx`. Listens to `approval-request` / `approval-closed` and shows one request at a time as a sheet rising from the bottom, answering in reading order: **who** (the device, or the AI agent and the device it runs on, with the short id), **what** (the capability's title), **on what**, **how far a yes goes**, and **how long you have** (a ring that empties and turns amber, then red). The countdown runs from the moment each request *arrived*, because the backend times every request from when it asks — a request waiting behind another keeps its real remaining time instead of restarting at 55 s. A yes covers *this request only*: `minutes` is the lease of that one call (how long it may run before Stop or the lease cuts it), not a window of access — the next request asks again — so the card says "This request only" and the button says **Allow once**. Deny has the focus, so a stray Enter never grants anything; Escape denies, like letting the clock run out. A line counts the requests still waiting. Every string in it comes from another device and is rendered as plain text, wrapped rather than truncated so nothing can hide off-screen.

### `deviceUi.tsx`
What the three share: the types mirroring `devices.rs`, the button (`Action`), the code digits (`SasDigits`), the device glyph, and `FOCUS`, the keyboard ring used throughout (the tab bar uses the same one). It is deliberately soft, and nothing is focused on the user's behalf except the safe choice (Deny, Cancel): the code card leaves both answers unselected.

These screens sit one size step above the rest of the app (body 10–11px, titles 12px, button capitals at 10px with 0.12em tracking instead of `tracking-widest`), for a non-technical audience. Settings, Passboard and Space still use the older, smaller scale.

### Motion
Defined once in `App.css` under "Devices and approvals": rows rise 6px with a 40ms stagger, the approval sheet rises over a fading scrim, skeletons breathe, the countdown ring empties linearly. With `prefers-reduced-motion`, everything fades in place and nothing pulses.

## 🔬 Benches

Instruments for two different questions: how it looks, and how it behaves.

**`/banc.html` — the look.** `npm run dev`, then open it. Every variant of the HUD replays **at the same time, on a loop**: entry curves side by side, shadows side by side, and each payload shape. Nothing to click — you watch and compare, because a motion judged alone always looks about right, and only a neighbour reveals which is mushy and which is abrupt. The frames reproduce the real window (396×172) with its 32px inset so a shadow gets exactly the room it will really have, and the background switches between a dark desktop, a light one and a busy photo — a shadow that behaves on black can be a smear on white.

It renders the real `HudCard`, not a copy: a bench showing a lookalike stops being evidence the moment the two drift. It is deliberately **absent from `vite.config.ts`**, so it is dev-only and weighs nothing in the packaged app. It has already earned itself — it caught that every received image was labelled "File", which was invisible until the cases sat side by side.

**`/devices-banc.html` — the Devices tab and the approval card.** Same principle: the real `Devices`, `DeviceInvite` and `ApprovalPrompt`, inside the real `Layout` and `TabBar`, every state in its own window-sized frame (390×520) next to the others. Each frame is an iframe with its own fake backend (`mockIPC` from `@tauri-apps/api/mocks`, events included) speaking the same contract as `devices.rs`; states that need a user action — an open invitation, an armed removal, a failed join — are reached by scripted clicks, so they are the states a person really lands in. `?s=<scenario>` opens one frame alone. Also absent from `vite.config.ts`.

**`/directions.html?dir=a|b|c|a2|a3` — where Passer could go.** Static mockups of a full-size Passer window (1180×740, sidebar navigation) in three directions, to choose before any architecture changes: **A · Showroom** (one device large, its commands as round buttons, the others in a carousel — the direction Atlas chose for its Devices space), **B · Control center** (devices and AI agents, each one's permissions as Allow / Ask / Never, the journal), **C · Feed** (the Passboard as a conversation with each device). **A2** follows Walson's read of the three (A the most beautiful, B and C the most readable because every device is visible): all devices in one horizontal strip, the chosen one on stage with only its three working commands, and the thread of what went between it and this PC beside it; the stop button moves to the sidebar, since it belongs to the PC. A per-device thread needs transfers to carry the sending device, which only the passer-core path can know. **A3** answers the read of A2 (the thread beside the stage was too heavy, its pills and bubbles competing with the device): the stage takes the full width again, and what passed between the two shrinks to one line under it, with the history and the permissions one click away. Nothing is wired; the data is fictional and **✱** marks what passer-core does not provide yet (per-device presence, OS, battery). Dev-only, absent from `vite.config.ts`.

**`scripts/hud-bench.ps1` — the behaviour.** Hides the main window, fires real transfers through the REST API, and asserts that the HUD appears, lands where it should, and retires itself. `-Hold` keeps it on screen by re-firing, `-Kind text|image|file` picks the path, `-KeepMainVisible` checks it correctly declines. It reads the window size from `tauri.conf.json` and `MARGIN` from `hud.rs`, so changing either cannot leave the bench asserting against stale numbers.

## ♻️ State Management (`useHistory.ts`)
A custom hook that coordinates adding, deleting, and updating history objects locally. It listens for the backend's structured **`transfer`** events (typed `{ kind, direction, target, name, path, size }` payloads) rather than parsing human-readable log strings, so the feed stays robust as log wording changes.
