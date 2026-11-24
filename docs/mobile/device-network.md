# Device network on the phone (passer-core)

The phone joins the same device network as the desktop: a group of the owner's devices that
call each other's capabilities (clipboard, files, device info) over iroh, with approvals for
anything sensitive. All of it lives in the Rust library
[passer-core](https://github.com/Walson-A/passer-core); the app only hosts it.

## Pieces

| Piece | Role |
|---|---|
| `modules/passer-core/` | Expo local module. Swift (`ios/`) and Kotlin (`android/`) wrap the UniFFI bindings of `passer-ffi`. |
| `modules/passer-core/passer-core.json` | The passer-core release the app uses (`mobile-v*` tag), and the SHA-256 of its assets once pinned. |
| `scripts/fetch-passer-core.mjs` | Runs after `npm install`. Downloads the release assets into `ios/vendor/` and `android/vendor/` (ignored by git), checks their hash. Fails the install on CI and EAS, only warns elsewhere. `PASSER_CORE_SKIP=1` turns it off. |
| `src/state/devices.tsx` | Opens the device, keeps its node running while the app is open, and shows approval requests over any screen. |
| `src/app/devices.tsx` | The Devices sheet (Settings › Your devices): group, members, removal, stopping every session. |
| `src/components/approval-prompt.tsx` | Allow or deny what another device asks. |

The libraries come from passer-core's `Mobile libraries` workflow: an XCFramework with the
Swift bindings for iOS, `jniLibs` with the Kotlin bindings for Android.

## Joining

1. The PC (Passer › Devices › Add a device) shows a `passer-core://join?…` QR code.
2. The phone's scanner recognises it and hands it to the Devices sheet, out of the route.
3. The core joins the group; both screens show the same six-digit code, to compare.

A phone can also start its own group, then other devices join it.

## Keys and storage

- **iOS:** the device key is in the Keychain, `AfterFirstUnlockThisDeviceOnly` (never synced,
  never in a backup). The group's state is in Application Support › `passer-core`.
- **Android:** the key is sealed with an AES-GCM key that stays in the Android Keystore, and
  stored in the app's private preferences. State is in the app's files folder.

## Approvals

The core asks before anything sensitive. The module sends `onApprovalRequest` to JavaScript,
which shows the prompt; no answer within 55 s is a no (the core's own limit is 60 s). The core
decides; the UI only relays the answer.

## Limits for now

- The node runs only while the app is open; iOS suspends it in the background.
- It uses n0's development relays (`N0Dev`), not Passer's own.
- A JavaScript update reaching a binary built before this module sees `available: false`, and
  the sheet asks for an app update instead of crashing.
- No native build has compiled the module yet. The first EAS build is the check.
