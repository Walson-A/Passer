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
A pill-shaped persistent indicator. It displays the active state of the server (On/Off) and temporarily acts as a pulsing activity indicator during active file or clipboard transfers.

### `Passboard.tsx`
The primary feed component representing the history of transfers. Instead of a database, this is an ephemeral runtime history, bringing the latest items to the top seamlessly.
- **`HistoryItemRow.tsx`**: A granular row component with deep interactions (click to copy, click to open native file).

### `DropZone.tsx`
A graceful full-screen absolute layover that captures dragging events. Highly optimized to prevent unwanted browser default behaviours.

### `Settings.tsx`
A glass modal opened from the footer gear. Reads and writes real preferences over IPC: a **Launch on startup** toggle (`get_autostart` / `set_autostart`), a copyable server address, and the app version (`get_app_version`).

## ♻️ State Management (`useHistory.ts`)
A custom hook that coordinates adding, deleting, and updating history objects locally. It listens for the backend's structured **`transfer`** events (typed `{ kind, direction, target, name, path, size }` payloads) rather than parsing human-readable log strings, so the feed stays robust as log wording changes.
