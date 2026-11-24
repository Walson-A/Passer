# Device network on the phone (passer-core)

The phone joins the same device network as the desktop: a group of the owner's devices that
call each other's capabilities (clipboard, files, device info) over iroh, with approvals for
anything sensitive. All of it lives in the Rust library
[passer-core](https://github.com/Walson-A/passer-core); the app only hosts it.

Since the redesign (2026-11-24) it is the app's main way to the PC: joining, sending, fetching
and receiving all go through it, files of any size included, as streams (passer-core
mobile-v0.3.0). The HTTP pairing only remains for an image on the PC clipboard and for a PC
whose desktop has no streams yet (see "Two ways to the PC" in [README.md](README.md)).

## Pieces

| Piece | Role |
|---|---|
| `modules/passer-core/` | Expo local module. Swift (`ios/`) and Kotlin (`android/`) wrap the UniFFI bindings of `passer-ffi`. |
| `modules/passer-core/passer-core.json` | The passer-core release the app uses (`mobile-v*` tag), and the SHA-256 of its assets once pinned. |
| `scripts/fetch-passer-core.mjs` | Runs after `npm install`. Downloads the release assets into `ios/vendor/` and `android/vendor/` (ignored by git), checks their hash. Fails the install on CI and EAS, only warns elsewhere. `PASSER_CORE_SKIP=1` turns it off. |
| `src/core/device-calls.ts` | Calls the PC's capabilities, checks its limits first, and classifies the core's refusals. Unit-tested. |
| `src/core/devices.ts` | A device's kind (what it said, or guessed from its name on an older core), its wallpaper (the desktop's formula), the code's two groups, minutes since it answered. Unit-tested. |
| `src/state/devices.tsx` | Opens the device, keeps its node running while the app is open, lists the members and what each offers, probes whether each answers, keeps the Send destination, streams files, records what other devices send here. |
| `src/state/approvals.tsx`, `src/components/approval-prompt.tsx` | Requests other devices send this phone's user, one at a time, each counting down from its arrival. |
| `src/state/transfers.tsx` | Send, fetch, and the fallback to the direct connection. |

The libraries come from passer-core's `Mobile libraries` workflow: an XCFramework with the
Swift bindings for iOS, `jniLibs` with the Kotlin bindings for Android.

## Joining

1. The PC (Passer › Devices › Add a device) shows a `passer-core://join?…` QR code.
2. The phone's scanner (or *Paste a link*) hands it to the Join screen, out of the route.
3. The core joins the group; both screens show the same six-digit code, in two groups of three.
   *It's different* stops the phone's node; the PC's *It's different* removes the phone.

A phone can also start its own group (*No PC yet?* on the welcome screen). A phone that manages
devices can invite others: it shows its own one-time code, valid 10 minutes like the desktop's,
and compares the code when a device joins through it.

## What the phone asks the PC

| Capability (the PC's, `devices.rs`) | On the phone | Limits checked before calling |
|---|---|---|
| `clipboard.write` | *What you copied* (text), the widget's send | 200 000 characters |
| `file.drop` (stream) | Photo, File: originals of any size, with progress across the batch (`sendFile`, `onTransferProgress`) | none on the phone; the PC takes up to 4 GB |
| `file.receive` | Photo and File for a PC without `file.drop`, a pasted image without the direct connection | 700 KB per file; photos are shrunk to JPEG to fit and the result says so |
| `clipboard.read` | *Its clipboard*, with the lock *It asks first*: the PC's user approves each read | text only |
| `device.info` | Whether a device answers (no live presence in the core), every 30 s for the Send destination while the app is open | none |

The screens only show the commands a member offers (`memberCapabilities`), with the lock when
it `needsApproval`; a member on an older core lists nothing, and then every command shows and
the member decides.

Refusals arrive as text; `classifyCallError` reads the core's stable codes in it (`denied`,
`approval_timeout`, `too_large`, `not_member`, `unknown_capability`, network errors) and the
screens say each in a sentence. How the native bridge words them is not yet checked on a phone.

## What the phone offers

So the desktop's *Send my clipboard* and *Send a file* work towards the phone, the module
declares the PC's own capabilities, same names, inputs and limits (`PhoneCapabilities` in
`PasserCoreModule.swift` and `.kt`, registered with `addCapabilities` before `start`; uploads
arrive through `receiveFile`):

| Capability | Effect | What the phone does |
|---|---|---|
| `clipboard.write` | write | Puts the text on the phone's clipboard |
| `file.receive` | write | Saves the file (< 700 KB, base name only) in Documents › Passer on iOS, which the Files app shows under On My iPhone › Passer (`UIFileSharingEnabled`); in the app's files on Android |
| `file.drop` | write, upload stream | Moves the received file (any size, base name only) to the same folder |

Each one sends `onReceived` to JavaScript, which tells the user on Send, records it in Activity
and offers *Share* for a file. The core's policy and approvals apply before anything runs. The
node runs only while the app is open, so the PC can send only then.

## What the other members are and offer

A device's page shows its kind, system and Passer version, as that device last said
(`members()` in the core). This phone declares its own at open: phone or tablet, the iOS or
Android version, the app version. The core asks the other members after `start`, and the
app asks again when it returns to the foreground and when a device joins
(`refreshMembers`). The core only calls `device.info` where it runs without approval, so a
refresh never makes another device ask its user anything. `memberCapabilities(id)` lists
what a member lets this phone ask for, and `journal(limit, id)` the calls made and received
with it, never their content: the page lists the last few as *Recent exchanges*. When a member
doesn't answer, the screens say when it last did (`answeredAt`). All of it is for display; the
target device decides every call.

## Keys and storage

- **iOS:** the device key is in the Keychain, `AfterFirstUnlockThisDeviceOnly` (never synced,
  never in a backup). The group's state is in Application Support › `passer-core`.
- **Android:** the key is sealed with an AES-GCM key that stays in the Android Keystore, and
  stored in the app's private preferences. State is in the app's files folder.

## Approvals

The core asks before anything sensitive. The module sends `onApprovalRequest` to JavaScript,
which shows the prompt; no answer within 55 s is a no (the core's own limit is 60 s). The prompt
counts down from the request's arrival, so one waiting behind another keeps its real time. The
core decides; the UI only relays the answer. A yes covers that request only: `minutes` is how
long that one call may run, not a window of access.

## Limits for now

- The node runs only while the app is open; iOS suspends it in the background.
- It uses n0's development relays (`N0Dev`), not Passer's own (Devices › *Preview network* says so).
- A JavaScript update reaching a binary built before this module sees `available: false`, and
  Send asks for an app update instead of crashing.
- Streams to the PC need a desktop offering `file.drop` (on `dev`, not yet released); against
  an older one the app falls back to one call per file, 700 KB at most.
- The module compiled in the iOS preview builds of 2026-11-24 (`ef8af9d` with mobile-v0.1.0,
  `68a3cce` with mobile-v0.2.0); see Builds in [README.md](README.md). Streams (mobile-v0.3.0) and
  the phone's capabilities came after and haven't been compiled yet, and no Android build has
  ever been made.
