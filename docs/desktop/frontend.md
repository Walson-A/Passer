# Frontend Architecture (React/Vite)

The frontend is a lightweight React Application tailored for transient interactions. It lives in `passer-app/src` and employs the **Premium Glass** design language.

## 🎨 Visual Identity
The app uses TailwindCSS 4 and pure CSS `backdrop-filter` to enforce the "glassmorphism" aesthetic.
- The window is borderless and transparent.
- Background uses extremely subtle gradients and noise meshes.

## 🧩 Key Components

### `App.tsx`
Holds what several views share: the current view (Devices first), the Passboard filter, the Shortcuts server state (seeded from `get_server_status`, then kept by `server-started` / `server-stopped`, so it reflects whether the socket is really bound), and the one transfer history (`useHistory`), which the Passboard lists and each device's stage reads for its "last from it" line. It also goes to Devices on `device-joined`, so the code to compare is never shown on a hidden view.

> ⚠️ **`backdrop-filter` renders dark in this window.** The app runs with `"transparent": true`, so a backdrop filter samples semi-transparent pixels and composites them *darker* rather than producing frosted glass. A `backdrop-blur-[2px]` on the old status pill turned it into a near-black bar even though its fill was white at 0.5% opacity — the blur was making it opaque, not glassy. Blur is applied once, on the window shell in `Layout.tsx`; nested elements should get their glass from fill and border alone. Check this before adding `backdrop-blur` to any small element.

### `Passboard.tsx`
Everything that passed between your devices and this PC — texts, photos, files — newest first, as a wide grid of `HistoryItemRow`s (click to copy, open, show in folder). Each row says where it came from or went: **From iPhone de Walson**, **To MacBook Air**, or **Via iOS Shortcuts** for the legacy HTTP path, which shares one token between every phone and so cannot say which. Chips filter by device (or Shortcuts); a device's stage opens the Passboard already filtered on it. On a row: a link someone sent opens in the browser (*Open link*), and a received file can be offered to your other devices (*Share from this PC*). *Open the folder* opens the Passboard folder, where received files are saved. The history is in memory, for the session.

### `DropZone.tsx`
Files dropped on the window, routed by what is on screen (`App.tsx` passes the device on the Devices stage):
- **A device on stage that accepts files** (`file.drop`, streamed and of any size, or the older `file.receive`): they go **straight to it** - no question asked - with a toast showing the progress, then *Sent to <device>*.
- ***This PC* on stage**: they are **shared from this PC** straight away (`space_add_paths`).
- **Anywhere else**: a dialog asks where - one of your devices (only those that accept files can be picked; the others say *Doesn't accept files from here yet*), or *Share from this PC*. Not in a group yet: a pointer to Devices.

While dragging, the overlay says which of these will happen (*Drop to send to MacBook Air*, *Drop to share from this PC*, *Drop to send*).

### `Settings.tsx`
In sections, for the wide window. **General**: *Launch on startup* (`get_autostart` / `set_autostart`). **iOS Shortcuts**, presented as what it is — the legacy local HTTP server the Shortcuts app talks to, which linked devices do not need: the server switch (it replaced the status pill that sat above the old Passboard), its address, the pairing token (reveal, copy, make a new one with a confirmation that says every Shortcut stops working until updated), and *Set up Shortcuts on an iPhone*, which opens `PairDevice.tsx`. **About**: the version.

### Files, per device: `DeviceFiles.tsx`
There is no single shared folder: with three PCs and a phone, "the shared folder" would beg the question *whose*. Each device shares its own files, and you reach them through the device, under the Devices stage:
- **Another device**, when it offers `file.list`: *What <device> shares*, its eight latest files (name, size, date) and *See all*, which opens the panel in place into a browser - search by name, filter by kind (images, videos, documents, archives), sort by date, name or size - each file with **Get**, which streams it into this PC's Passboard (`devices_fetch_file`) with a progress bar; it then appears in the Passboard *From <device>*.
- **This PC**: *What this PC shares* - the Passer Space folder, which `file.list` / `file.get` offer the other members - with **Share files** (a native picker; the files are copied in), **Open the folder**, and **Stop sharing** per file, confirmed, since it deletes the file from that folder.

**The rule**: a device's space is what *it* offers; the others only take from it. To give a device something, you send it (it lands in its Passboard, its inbox); you add only to your own space. No remote writing or organising - the same reason there is no remote file management: any device of the group (a stolen phone, an AI agent) could fill or reorganise another's files.

The sidebar has no Space entry any more: *Passer Space* used to be that folder plus an `smb://` address that only worked once the user shared it in Windows themselves (folded away in November 2026, back in this form). A real synchronised folder across devices is a different product and is not planned.

### `Hud.tsx`
The corner notification, rendered into its own always-on-top window (see `backend.md`). It reports a transfer while the main window is out of sight - with the device's name when it came through the device network - then retires after four seconds. Clicking it brings Passer back.

> ⚠️ **It polls; it is not pushed to.** Events emitted from Rust never arrive in this window's webview. That was verified three times — a broadcast `emit`, a `WebviewWindow::emit` immediately after `show()`, and the same 250 ms later; the last two reported success and neither was ever received, while `invoke` *from* that webview worked throughout. So the HUD asks `get_last_transfer` every 400 ms and compares a sequence number, which needs nothing delivered inwards. Do not "simplify" this back into a listener.

### The window: `Layout.tsx`, `TitleBar.tsx`, `Sidebar.tsx`
Passer is a full, resizable window (1180×760 by default, 940×620 at least, centred), no longer the 390×520 panel docked by the taskbar: the device network outgrew it. The window stays frameless and transparent, drawn as one rounded dark pane; `Layout.tsx` gives every edge and corner a resize handle, since there is no native frame. `TitleBar.tsx` carries the wordmark, pin, minimise, maximise and close.

`Sidebar.tsx` replaced the bottom tab bar: Devices, Passboard, and Settings at the foot. Below it, once this PC is in a group, a card says whether the device network is up (*Ready* / *Offline*) and holds **Stop remote activity**, which ends everything other devices are doing here. It lives there, not on one device, because it concerns the whole PC.


### `Devices.tsx` and `DeviceStage.tsx`
The **Devices** space, in the direction Walson chose after the mockups (*A3*, see Benches): every device in one horizontal strip, the chosen one alone on stage. It talks to the backend only through the `devices_*` commands and the `device-joined` event (see "Device network" in `backend.md`), and renders every device name as plain text — names are chosen by the devices themselves.

- **The strip** shows every member at once (other devices first, the ones that manage the group before the rest, this PC last), each with its drawing and when it was last seen. Horizontal on purpose: it does not compete with the vertical sidebar.
- **The stage** (`DeviceStage.tsx`) draws the chosen device large (`DeviceRender.tsx`), says when it was last seen, its system and version, and *Manages devices* when it does, then **only the commands it offers this PC**, read from `devices_capabilities`: *Send a file* (when it offers `file.drop` or `file.receive`: a native picker, then a progress bar; any size through `file.drop`), *Send my clipboard* (`clipboard.write`) and *Get its clipboard* (`clipboard.read`). A command whose capability `needs_approval` carries a lock and *It asks first*, and the stage says it is waiting for that answer. A device that offers none of them (a phone, today) gets a sentence instead of buttons that would fail; one never heard from gets *Check again*.
- **What a device is, and when it was seen**, come from passer-core's member list (`devices_status`: `kind`, `os`, `os_version`, `app_version`, `core_version`, `answered_at`). The core asks every member on start, and the view asks again with `devices_refresh` on arrival, every minute while in front, and on *Check again*; `devices-changed` says a newcomer answered. The label is honest about what is known: *Seen just now*, *Seen 12 min ago*, *Not seen yet* — when it last answered this PC, not whether it is up this second (that comes with the coordination server). The dot is green within five minutes. When a device has not said its `kind`, the drawing falls back to a guess from its system and name (`kindOf`).
- **Details and removal** open a side panel: role, device ID, system, Passer and core versions, when it last answered; then **the history between it and this PC** (`devices_journal`, both directions, never the content: who asked what, *Done*, *Allowed once*, *Refused*, *Not allowed*); then *Remove from my devices* with its confirmation (approvers only).
- **Adding a device** opens `DeviceInvite.tsx` as a dialog over the view.

| State | What the user sees |
| ----- | ----- |
| Loading | Skeleton rows in a centred column, never an empty pane |
| Status failed | "Your devices didn't load", the raw error underneath, **Try again** |
| No group yet | A short explanation, **Start with this PC** (with when to choose it) or **I have an invitation** (with where to get one) |
| Joined with a link | A banner with the 6-digit code to compare, in two groups of three |
| A device joined | The banner with **It matches** / **It's different**; the newcomer goes on stage, and *It's different* opens its details with the removal armed. `App.tsx` switches to Devices on `device-joined`, so the code is never shown on a hidden view |
| Offline | An amber banner with *Check again*; *Add a device* is disabled with a reason |
| Not an approver | Instead of *Add a device*: which devices can add one |
| Action failed | An error next to the action, plain sentence first, raw detail below |

The footnote is one line, *End-to-end encrypted*; while `development_network` is true it carries a **Preview** toggle that unfolds what the preview network means for the user. It does not name n0 — that is in `backend.md`, for developers.

### The screen: the Details switches
When another device sees or controls this PC's screen, Vasistas itself shows it on the screen (who, *sees* or *controls*, the time left, framed corners) and stops on Escape. Passer adds no banner of its own: two bars saying the same thing were one too many. *Stop remote activity* in the sidebar still ends every session other devices have open here.

In a device's Details, *This PC's screen* has two switches, **See it without asking** and **Control it without asking**, off by default: then each request asks on this PC with the approval card. They are for your own devices, to reach the PC when nobody is in front of it. A change applies at once; switching one off also ends any session in progress. Shown only when Vasistas is installed.

### `DeviceInvite.tsx`
*Add a device*, as a dialog. Two steps, because the role is baked into the invitation: first **what the new device can do** (send and receive, or also add and remove devices — `approver`), then the one-time QR code with its link, a live **m:ss left** (the backend's 10 minutes) and an **Expired → New code** state, the "don't share it" warning, and *Copy link* with a *Copied* confirmation. Closing the dialog, or leaving the view, drops the code.

### `ApprovalPrompt.tsx`
Mounted above everything in `App.tsx`, centred over the window. Listens to `approval-request` / `approval-closed` and shows one request at a time, answering in reading order: **who** (the device, or the AI agent and the device it runs on, with the short id), **what** (the capability's title), **on what**, **how far a yes goes**, and **how long you have** (a ring that empties and turns amber, then red). The countdown runs from the moment each request *arrived*, because the backend times every request from when it asks — a request waiting behind another keeps its real remaining time instead of restarting at 55 s. A yes covers *this request only*: `minutes` is the lease of that one call (how long it may run before Stop or the lease cuts it), not a window of access — the next request asks again — so the card says "This request only" and the button says **Allow once**. Deny has the focus, so a stray Enter never grants anything; Escape denies, like letting the clock run out. A line counts the requests still waiting. Every string in it comes from another device and is rendered as plain text, wrapped rather than truncated so nothing can hide off-screen.

### `deviceUi.tsx`
What the device screens share: the types mirroring `devices.rs`, the button (`Action`), the code digits (`SasDigits`), the glyph, how a device looks (`osLabel`, `kindOf`, `screenFor` — a wallpaper per device derived from its id) and `FOCUS`, the keyboard ring used throughout (the sidebar uses the same one). It is deliberately soft, and nothing is focused on the user's behalf except the safe choice (Deny, Cancel).

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
