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
| `file.list` | *What DESKTOP-… shares*, on the device's page: the files of its shared folder (Passer Space on the desktop) | none |
| `file.get` (stream) | *Get* on one of them: the file lands in Documents › Passer and the share sheet opens (`fetchFile`) | none |
| `screen.view`, `screen.control` (stream) | *See its screen*, *Take control*, on the device's page: the PC's screen, live (Vasistas). Face ID or the phone's code first, then the PC's user accepts, unless its owner switched that off. See below | the core's stream export for mobile, not yet published (below) |
| `device.info` | Whether a device answers (no live presence in the core), every 30 s for the Send destination while the app is open | none |

There is no shared folder for the whole group: each device shares its own files, reached
through that device (owner's decision, 2026-11-24, same as the desktop's device page). The
screens only show the commands a member offers (`memberCapabilities`), with the lock when
it `needsApproval`; a member on an older core lists nothing, and then every command shows and
the member decides.

Refusals arrive as text; `classifyCallError` reads the core's stable codes in it (`denied`,
`approval_timeout`, `too_large`, `not_member`, `unknown_capability`, network errors) and the
screens say each in a sentence. How the native bridge words them is not yet checked on a phone.

## Seeing and controlling a screen

The desktop shares its screen through Vasistas (`screen.view`, `screen.control`, both
sensitive, the indicator on while it lasts). The phone's side:

1. **It's you.** Face ID, or the phone's code (`expo-local-authentication`,
   `src/platform/biometrics.ts`), so a phone in someone else's hands can't open a screen. A phone
   without a code is told to set one.
2. **The PC's user accepts.** *Waiting for an answer on DESKTOP-…*, a ring counting the 60 s the
   core waits; no answer is no. The PC's owner can switch the question off for this phone.
3. **The picture.** The stream carries Vasistas's frames (`docs/share.md` in the Vasistas
   repository): JSON events, H.264 video and the pointer's shape one way, the viewer's JSON the
   other. `src/core/screen-protocol.ts` reads and writes the framing, the events and the input.
   On iOS the video never reaches JavaScript: `ScreenSession.swift` reassembles the frames and
   hands H.264 to an `AVSampleBufferDisplayLayer` (the system's hardware decoder), shown by
   `PasserScreenView`. A decoding failure asks the PC for a keyframe.
4. **Control.** A tap clicks where the finger is, holding right-clicks, a drag drags, two fingers
   scroll; the keyboard types text, and a row adds Esc, Tab, Ctrl and Alt (held for the next key),
   the arrows and Del. Positions go as fractions of the PC's display; the pointer moves at most
   30 times a second. Leaving by any way releases every key and button, then closes the stream.
5. **What the PC says.** *Paused* while it shows its lock screen or an administrator prompt,
   *Someone is using DESKTOP-…* when its own mouse or keyboard moves (the phone's input waits),
   *You can only watch* when control wasn't allowed, and why it ended (Escape on the PC, stopped
   there, time limit).

The picture can be turned a quarter to use the phone's height (the app stays portrait). Touches
are read in window coordinates and turned back (`windowToStage`), so they land right whatever a
platform reports for a rotated view.

**The stream** is passer-core's `PasserDevice.connectStream(device, capability, inputJson, sink)`
(mobile-v0.4.0, pinned in `passer-core.json`). It returns once the PC has accepted, or
throws its refusal (`denied`, `approval_timeout`, `no_indicator`, `not_member`). What arrives goes
to `ScreenSink` (`onData`, in pieces that don't line up with Vasistas's frames, then
`onClosed`); the viewer's input goes through `StreamHandle.send`, one message after the other.
Leaving ends this side (`close`), then everything 3 s later (`cancel`). When the stream closes,
`result()` says why: `interrupted` when the PC's user stopped it or the session reached the core's
15-minute limit for sensitive capabilities; the viewer then says to open it again.

Against v0.3.0, mobile-v0.4.0 only adds `connectStream`, `StreamSink`, `StreamHandle` and
`reloadPolicy`; everything else the module uses is unchanged. None of it has been compiled yet:
the next iOS build is the check. On Android `screenAvailable()` is false: the MediaCodec decoder
isn't written, so the commands don't show.

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
- Seeing a screen needs an iOS build with mobile-v0.4.0 (pinned); Android has no decoder yet.
- Streams to the PC need a desktop offering `file.drop` (on `dev`, not yet released); against
  an older one the app falls back to one call per file, 700 KB at most.
- The module compiled in the iOS preview builds of 2026-11-24 (`ef8af9d` with mobile-v0.1.0,
  `68a3cce` with mobile-v0.2.0); see Builds in [README.md](README.md). Streams (mobile-v0.3.0) and
  the phone's capabilities came after and haven't been compiled yet, and no Android build has
  ever been made.
