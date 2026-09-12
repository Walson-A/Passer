# Passer Mobile — Specification & Handoff Brief

> **Status:** Not started. This document is the complete brief for building the Passer mobile app.
> **Primary target:** iOS. **Android must stay buildable and unblocked** (see §9).
> **Author's directive:** *design and ergonomics are the priority — that is what sells this product.* Read §2 before writing any code.

---

## 1. Context — what already exists

**Passer** is a local-network bridge between a phone and a PC: copy on one, paste on the other; send files without cloud, account, or internet. Everything stays on the LAN.

The **desktop app** is shipped and at v1.0.0:

| | |
|---|---|
| Stack | Tauri v2 (Rust) + React 19 + Vite 7 + TailwindCSS 4 |
| Platform | Windows (clipboard integration is Windows-specific) |
| Location | `passer-app/` in this repo |
| Server | Axum HTTP on port **8000**, bound `0.0.0.0` |
| Discovery | mDNS, advertises `<machine>.local` (e.g. `walson-laptop.local`) |
| Docs | `docs/desktop/` — read `api.md` first |

Today the phone side is **iOS Shortcuts** (Push / Pull / Pass). They work but the UX ceiling is low: no device picker, no history, no real error messages, and pairing means hand-typing a 32-character token into each Shortcut's headers.

**The mobile app exists to break that ceiling.** It is not a port of the Shortcuts — it is the product the Shortcuts were a prototype for.

### What the app genuinely wins over Shortcuts
- **Pairing by QR** instead of transcribing a secret by hand.
- **Multiple PCs**, chosen from a list, with names.
- **Transfer history** with previews, retry, and real error messages.
- **A designed surface** — the Shortcuts have no UI at all.

### What it does *not* win (be honest about this in-product)
It does **not** gain background automation. See §3 — those limits are iOS's, not the framework's, and no amount of engineering removes them. Do not design a feature that depends on silent background clipboard sync; it cannot ship.

---

## 2. The design bar (read this first)

This is the section that matters most. Passer's competition is "AirDrop, but I have a PC" — the functionality is table stakes, **the feel is the product.** A transfer app that works but feels generic has failed.

### Principles

1. **The main action is one thumb, one tap, under two seconds.** From opening the app to content landing on the PC. If a flow needs a second screen, it is the wrong flow. Measure this, do not assume it.
2. **The app must feel physical.** Transfers have direction, weight, and momentum. Content should visibly *travel*. The desktop app already does this (a light sweep crosses the status bar during transfer) — the phone is the other end of that same motion.
3. **Every state is designed.** Empty, loading, offline, PC-asleep, wrong-network, token-rejected. Unstyled error text is a bug. The offline state in particular is *common* here (PC off, different Wi-Fi) and deserves real art direction, not a grey sentence.
4. **Confirmation is felt, not read.** Haptics + motion + color confirm a send. A toast saying "Success" is the lazy version.
5. **Nothing generic.** No default template look, no stock component kit shipped as-is, no unmodified tab bar with three grey icons. If a screen could belong to any app, redo it.
6. **Restraint.** "Premium Glass" is not "many effects." Blur, depth, and a near-black ground; one accent; motion that serves feedback. The desktop palette is deliberately desaturated — match that discipline.

### Inherited visual identity — "Premium Glass"

Source of truth: `docs/design_concept.md`. Feel target: Apple's Home app / Tesla UI. Transparency, depth, tactile quality.

**Tokens** (lifted from `passer-app/src/App.css` — the mobile app must be recognizably the same product):

```
Ground            #0F0F0F   (near-black; OLED black #050505 acceptable for full-bleed)
Card              rgba(255,255,255,0.03)
Border            rgba(255,255,255,0.08)   // ultra-thin, low opacity
Glass surface     rgba(20,20,20,0.6) + blur(24px)

Text primary      #FFFFFF
Text secondary    #9CA3AF
Text tertiary     #6B7280

Success           #10B981
Error             #EF4444
Pending           #F59E0B
Accent (blue)     #3B82F6 / #60A5FA

Font              Inter, or SF Pro on iOS. Tight tracking, semibold headings.
Easing spring     cubic-bezier(0.175, 0.885, 0.32, 1.275)
Easing out-expo   cubic-bezier(0.16, 1, 0.3, 1)
```

Also inherited: a global **noise overlay at ~0.03 opacity** for a tactile, non-flat feel, and metallic text gradients (`white → white/40`) for headings.

**Motion vocabulary already established on desktop** — reuse it so the two halves feel like one product:
- *Crystal Reveal* — elements arrive from `blur(12px)` + `scale(1.05)` into focus.
- *Flux sweep* — a directional gradient sweep during an active transfer (the desktop sweeps left→right for one direction, right→left for the other; the phone should mirror it coherently).
- *Success pulse* — a short expanding ring in emerald, once, on completion.
- *Staggered entrance* for lists.

### Mobile-specific requirements
- **Thumb zone.** Primary actions live in the bottom half. Nothing critical in the top corners.
- **Haptics are part of the design**, not an afterthought: light on selection, success notification on completed transfer, error notification on failure. Use `expo-haptics`.
- **Safe areas and Dynamic Island** respected on every screen, including the share extension.
- **Dark-first.** The brand is near-black. Shipping dark-only is defensible and on-brand; if light mode is added later it must be a real design pass, not an inverted palette.
- **Accessibility is not optional:** support Dynamic Type, honour `prefers-reduced-motion` (replace travel animations with fades), maintain contrast on glass surfaces (blurred backgrounds are a common contrast failure), and label every control for VoiceOver/TalkBack.
- **60fps minimum** on the transfer animation. Drive motion on the UI thread with Reanimated worklets; never animate through JS state on a per-frame basis.

---

## 3. Platform reality — verified constraints

These were researched and confirmed. Design **around** them; do not promise them.

| Constraint | Reality | Consequence for design |
|---|---|---|
| **Clipboard in background** | iOS restricts pasteboard reads to the foreground (since iOS 9). iOS 14 shows a "pasted from" banner; iOS 16 can prompt for permission. | No silent clipboard mirroring. Reading the phone clipboard must be an explicit user action, ideally via a system paste control. Design the send flow around a deliberate tap, and make that tap feel great. |
| **Spontaneous background receive** | The only mechanism is Local Push Connectivity, whose `NEAppPushProvider` entitlement is restricted, requires Apple's approval, and targets networks without APNs access (hospitals, ships, campuses). Not our case. | PC → phone delivery happens when the user opens the app or the share sheet. Do not design a "PC pushes to phone anytime" feature. |
| **Local network access** | Since iOS 14, any Bonjour/mDNS discovery or local connection needs the local-network permission, declared via `NSLocalNetworkUsageDescription` + `NSBonjourServices`. | The permission prompt must be *primed* — explain why before triggering it, and design a recovery screen for when it is denied (deep-link to Settings). A denied prompt is the single most likely cause of "the app doesn't work". |
| **Cleartext HTTP** | The desktop server is plain HTTP on a LAN IP. iOS App Transport Security blocks arbitrary cleartext. | Set the ATS exception `NSAllowsLocalNetworking` (this is exactly its purpose — do **not** disable ATS wholesale). Android needs cleartext permitted for local traffic too (§9). |
| **mDNS discovery libraries** | Some RN zeroconf libraries require Apple's **Multicast Networking Entitlement**, which must be requested from Apple. Apple's own Bonjour APIs with `NSBonjourServices` declared normally do **not**. | **Phase 1 avoids this entirely** — the QR carries the address. Only revisit for the convenience "find PCs on this network" feature (§8, Phase 3). Prefer a library backed by native `NSNetServiceBrowser`/`NWBrowser` to dodge the entitlement. |
| **Build chain** | iOS builds require Xcode/macOS. The owner develops on **Windows**. | **EAS Build** (cloud macOS workers) is the build path. Tauri was rejected for mobile precisely because it has no equivalent and its iOS app-extension support is broken. |

**Owner already has an Apple Developer account** ($99/yr) — so TestFlight, App Groups (needed for the share extension), and entitlement requests are all available. The owner performs `eas login`, Apple credential, and signing steps; they cannot be automated from the agent side.

---

## 4. Stack

- **Expo** (SDK current) + **expo-router** for navigation.
- **EAS Build** — development builds for iterating, TestFlight for real-device testing.
- **TypeScript**, strict.
- **react-native-reanimated** for all motion; **expo-blur** for glass surfaces; **expo-haptics**.
- **expo-secure-store** for the pairing token — it is a secret, it goes in Keychain/Keystore, **never** AsyncStorage or plain JSON.
- **expo-camera** for QR scanning (the old `expo-barcode-scanner` is superseded).
- **expo-clipboard**, **expo-image-picker**, **expo-document-picker**, **expo-file-system**.
- **Share extension:** via a config plugin (`expo-share-intent`, `expo-share-extension`, or Expo Apple Targets). Requires an **App Group**.
- Suggested location: `passer-mobile/` in this repo, so the `passer://pair` contract stays in sync with the desktop. Suggested bundle id: `com.walson.passer.mobile` (desktop uses `com.walson.passer`). Both are defaults — confirm with the owner.

A config plugin will be needed for the Info.plist keys (`NSLocalNetworkUsageDescription`, `NSBonjourServices`, ATS `NSAllowsLocalNetworking`, camera usage string). This means **development builds, not Expo Go.**

---

## 5. The contract with the desktop

This is the integration spec. Source of truth: `docs/desktop/api.md` and `passer-app/src-tauri/src/`.

### Base URL
`http://<host>:8000` — try `host` (the machine's mDNS name, e.g. `walson-laptop.local`) first, fall back to `ip`. Both come from the pairing payload. Each PC advertises its own name, so never assume a fixed hostname.

### Authentication
Every route except `/ping` requires the pairing token:

```
X-Passer-Token: <token>
```
A `?token=<token>` query parameter is accepted as a fallback. **Prefer the header.**

On failure the server returns **401** with:
```json
{ "status": "error", "message": "Missing or invalid pairing token. ..." }
```
Treat 401 as "this pairing is no longer valid" — the PC may have regenerated its token. Surface a clear re-pair path, never a raw error.

### Endpoints

| Method & path | Body | Response |
|---|---|---|
| `GET /ping` | — (no auth) | `{"app":"passer","version":"1.0.0","host":"WALSON-LAPTOP"}` |
| `GET /pull` | — | **Content-type varies with the PC clipboard:** `application/zip` (files were copied), `image/png` (an image), otherwise `application/json` → `{"text":"..."}` |
| `POST /push` | JSON `{"text":"..."}` | `{"status":"success"}` |
| `POST /push/image` | `multipart/form-data`, a part whose Content-Type starts with `image/` | `{"status":"success"}` |
| `POST /push/file` | `multipart/form-data`, one or more file parts | `{"status":"success","count":N}` |

Notes:
- `/pull` sets **no `Content-Disposition`** — the app must derive its own filename (e.g. `Passer <timestamp>.zip`).
- The upload body limit is disabled server-side; large files are fine, so **the app owns progress reporting and cancellation**.
- The server reduces uploaded filenames to their base name (path-traversal protection), so do not rely on sending directory structure.
- CORS is deliberately disabled — irrelevant for a native client, but do not try to reach this API from a webview.

### Pairing payload (QR)
The desktop screen is **Settings → Pair a device**. The QR encodes exactly:

```
passer://pair?v=1&name=WALSON-LAPTOP&host=walson-laptop.local&ip=<LAN IP>&port=8000&token=<token>&id=<id>
```

| Field | Use |
|---|---|
| `v` | Payload version — reject unknown majors with a friendly "update your apps" message. |
| `name` | Human name of the PC (`COMPUTERNAME`), shown in the device picker. |
| `host` | Preferred address (mDNS), survives IP changes. |
| `ip` | Fallback for networks where `.local` resolution fails. |
| `port` | API port. |
| `token` | The secret. → SecureStore. |

**Connection strategy:** on each use, race/try `host` then `ip`; persist whichever answered `/ping` last as the fast path. IPs change on DHCP — `host` is what makes pairing durable, so never store only the IP.

### Discovery (later phases)
mDNS service type `_passer._tcp.local.`, instance and host derived per machine (`walson-laptop` / `walson-laptop.local`), port 8000. TXT properties carry `id`, `name` and `version`, so a browse result identifies a specific PC without connecting.

---

## 6. Screens & features

### 6.1 Onboarding / pairing
- Short value-first intro. **Prime the local-network permission** with an explanation before the system prompt fires.
- **Scan the QR** from the desktop's pairing screen. Camera view must be beautiful — this is the user's first impression and the moment the product proves it is not a Shortcut.
- On success: verify with `GET /ping`, show the PC name landing into a paired state with real motion and a success haptic. Store the token in SecureStore.
- **Manual fallback** for a broken camera: paste the pairing link or enter host + token.
- **Failure states to design:** camera denied, invalid/expired QR, wrong `v`, PC unreachable, local-network permission denied.

### 6.2 Home
The core surface. Must answer instantly: *which PC am I connected to, and is it reachable?*

- Connected PC + live reachability (poll `/ping` cheaply; do not hammer it).
- **Send** — clipboard text, photo, file. The hero action.
- **Get from PC** (`/pull`) — pulls the PC clipboard; if it is a zip or image, save/share it appropriately.
- Recent transfers with previews, status, and retry.

### 6.3 Send flow
- Text/clipboard → `POST /push`. Remember the iOS paste constraints (§3): use an explicit paste action.
- Photos → `POST /push/image` (clipboard image) or `/push/file` (saved to Passboard). **The distinction between "lands on the PC clipboard" and "lands in a folder" must be obvious in the UI** — it is the single most confusing thing about Passer and good design here is a real differentiator.
- Files/multiple items → `POST /push/file`, with progress and cancel.

### 6.4 Share extension ("Pass")
Parity with the existing Pass Shortcut, and the feature most likely to make the app a daily habit. Share from any app → pick the target PC → send. Must be **fast and minimal** — an extension is not a place for a multi-step flow. Needs an App Group.

### 6.5 Multiple PCs
Pair several machines, name them, pick a default, switch quickly, remove a pairing (and wipe its token from SecureStore).

### 6.6 Settings
Paired devices, per-device token management, re-pair, default target, haptics toggle, about/version.

---

## 7. Security requirements

- Token in **SecureStore** only. Never logged, never in analytics, never in a crash report.
- The QR contains the secret; the desktop already warns about screenshotting it. If the app ever displays a pairing payload, carry the same warning.
- All traffic is cleartext on the LAN by design. Do not add an ATS blanket exception — scope it to `NSAllowsLocalNetworking`.
- Removing a pairing must delete its token.
- Do not build a "remember on the clipboard" or telemetry feature that could exfiltrate transferred content. Passer's promise is that nothing leaves the local network — that promise is the product.

---

## 8. Milestones

**Phase 1 — Prove the loop.** Pair by QR, persist it, show connection status, push text and pull the PC clipboard. Ship to TestFlight. *This validates the whole chain — EAS build, local networking, permissions, the token — before investing in polish.*

**Phase 2 — Real product.** Files and photos with progress, transfer history, share extension, multiple PCs, full design pass on every state.

**Phase 3 — Convenience discovery.** Browse `_passer._tcp` to find PCs without a QR (see the entitlement note in §3). Pure convenience — the QR path must keep working.

**Phase 4 — Android parity.** §9.

---

## 9. Android

iOS is the focus, but **do not paint Android into a corner**:

- Keep all networking, pairing, and state logic **platform-agnostic**. No iOS-only assumptions in the core.
- Isolate platform-specific pieces (share extension vs. Android share intent, Keychain vs. Keystore) behind a thin interface from the start. Retrofitting this is expensive.
- Android needs cleartext traffic permitted for local addresses (`usesCleartextTraffic` / a network security config).
- Android's share target is an intent filter, not an app extension — different mechanism, same UX goal.
- Android has **no equivalent restriction on background clipboard access to design around**, so the Android version could eventually do more. Do not let that shape the iOS design, but do not architect it out either.
- The desktop server's clipboard integration is currently Windows-only; that is a desktop concern, not a mobile one.

---

## 10. Definition of done

A phase is complete when:
- Every state listed in §2.3 is designed and implemented — including offline and permission-denied.
- The primary send flow is verifiably under two seconds, thumb-reachable, one tap.
- Motion holds 60fps on a real device, and degrades correctly under reduce-motion.
- VoiceOver can complete the full send flow.
- The token never appears in any log.
- It runs from a real TestFlight build on a real iPhone, against the real desktop app — not just a simulator.

---

## 11. Open questions for the owner

1. Confirm location (`passer-mobile/` in this repo) and bundle id (`com.walson.passer.mobile`).
2. App name on the Home Screen — "Passer"?
3. Dark-only at launch, or is light mode in scope?
4. Is the existing Passer logo available as a high-resolution asset for the app icon and splash, or does it need redrawing for mobile?
5. Distribution intent — personal/TestFlight only, or public App Store listing (which adds review, a privacy nutrition label, and a support URL)?

---

## 12. Reference map

| What | Where |
|---|---|
| REST API, token, pairing payload | `docs/desktop/api.md` |
| Desktop backend (Rust) | `passer-app/src-tauri/src/` — `server.rs`, `auth.rs`, `clipboard.rs`, `files.rs` |
| Desktop pairing screen | `passer-app/src/components/PairDevice.tsx` |
| Visual identity | `docs/design_concept.md` |
| Design tokens | `passer-app/src/App.css` |
| Overall architecture | `docs/architecture.md` |
