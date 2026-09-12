# Passer Mobile — Architecture

What is built in `passer-mobile/`, and the decisions behind it. The brief it answers is [`SPEC.md`](SPEC.md).

## Status

Phase 1 is implemented and verified locally with the typecheck, unit tests, `expo-doctor` and an iOS bundle export. It has not run on a real iPhone yet; that needs the first EAS build.

The owner widened Phase 1 beyond the spec's original scope. It includes:
- QR pairing with an identity check, and a manual link fallback
- Live connection status
- Sending the clipboard through the native iOS paste button
- Pulling the PC clipboard (text, image or ZIP)
- Photos, with an explicit Clipboard or Passboard destination
- Files, with progress and cancel
- History, settings, dark and light themes, English and French

## Decisions (spec §11)

| Question | Decision |
|---|---|
| Location | `passer-mobile/` in this repo |
| Bundle id | `direct.passer.app`, the reverse of the product domain `passer.direct`, also used as the Android package. Never the owner's name. It becomes permanent once the App Store Connect record exists. |
| Home-screen name | Passer, with the desktop icon redrawn as a vector (`passer-mobile/assets/brand/passer-icon.svg`) |
| Themes | Dark and light from launch. Light is its own design pass, where the dark theme's light becomes ink. |
| Languages | English and French, following the device language |
| Distribution | TestFlight first, public App Store listing from Phase 2 |
| Testing | EAS preview builds (internal distribution) plus EAS Update |
| OTA updates | Kept in the App Store build, checked automatically at launch on the `production` channel. An app that can't be updated quickly is a dead app. iOS keeps an app suspended for days, so an update downloaded at launch can wait long for the next cold start: Settings › Updates checks on demand, downloads the update and offers a restart onto it (`src/platform/updates.ts`). |

## Layout

```
passer-mobile/
  app.config.ts     identity, Info.plist keys, plugins, EAS Update
  eas.json          preview (internal) and production profiles
  locales/          Info.plist permission strings, EN and FR
  assets/brand/     vector icon source
  src/
    app/            routes (expo-router)
    core/           the desktop contract; no React Native imports, unit-tested
    platform/       thin wrappers over native modules
    state/          providers: pairings, connection, history, transfers, settings
    components/     conduit (home screen pieces) and ui primitives
    theme/          tokens from the approved mockups
    i18n/           strings, EN and FR
```

`core/` is platform-agnostic on purpose (spec §9). It holds pairing link parsing, response interpretation, the connection strategy and the API client. Everything native sits behind `platform/`: Keychain, file transfers, pickers, clipboard, haptics. An Android-specific implementation replaces files there, not logic.

## Talking to the PC

- **Pairing.** `core/pairing.ts` parses `passer://pair?v=1&name=&host=&ip=&port=&token=&id=`. It ignores unknown parameters, and rejects newer versions with an "update the app" message. The link opens the `pair` route whether it comes from the in-app scanner, the manual field or the iOS Camera app, through the `passer` URL scheme. The scanner and the manual field hand it over in memory, so the token never sits in navigation state. The pairing screen waits for stored pairings to load before saving, and clears the onboarding screens underneath once paired.
- **Identity before secrets.** `core/endpoint.ts` tries the preferred address first and starts the others 350 ms apart. Besides the `.local` host and the IP from the QR code, it tries the bare machine name (`desktop-4f7kq2m`): away from home, Tailscale's MagicDNS resolves it, because Tailscale names a machine after its OS hostname the way the desktop derives its mDNS label. It accepts the first `/ping` whose `id` matches the pairing, or whose `name` matches for older desktops without an id. The token is never sent to a PC that fails this check, which matters on networks with several Passer PCs.
- **Errors.** `core/http.ts` maps 400, 401 and 5xx to typed errors, and still recognises the HTTP 200 error bodies of older desktops. A `/push/file` response with `clipboard_error` counts as a success.
- **Status.** `state/connection.tsx`:
  - pings every 10 s while the app is in front;
  - backs off from 2 s to 30 s while the PC is unreachable;
  - pauses in the background;
  - stops retrying after a 401 until the PC is paired again.
- **Transfers.**
  - One transfer runs at a time. A tap during a transfer is refused with a warning haptic and a VoiceOver announcement; the running capsule keeps its cancel button.
  - Uploads and pulls start with a 2.5 s `/ping`, so a PC that fell asleep fails in seconds rather than after a network timeout.
  - Text goes through `fetch`.
  - Uploads use `expo-file-system` upload tasks, the only API with progress and cancellation. Each file is staged, in its own cache folder, under the name the PC should show; the staged copies are deleted when the transfer ends.
  - `/pull` streams to disk with the legacy resumable download, because it reports the Content-Type that tells text, PNG and ZIP apart. It runs in a foreground session, since the default background session never gives up. iOS abandons it after 60 s without an answer, which leaves the PC time to zip a large Passboard; once data flows, a watchdog cancels a pull that stalls for 15 s.
  - Outcomes (sent, received, failed, notices) are announced to VoiceOver.

## iOS constraints designed around

| Constraint | Handling |
|---|---|
| Reading the clipboard shows an alert | The send button is Apple's `UIPasteControl` (`ClipboardPasteButton`). Its label and icon are Apple's; only its colours, shape and size are ours. The kind of content on the clipboard is detected without reading it. |
| No background receive | Pulling is explicit: the From PC button, or pulling the conduit down. |
| Local Network permission | Explained on the welcome screen before the first connection triggers the prompt. Requests fail until the alert is answered, so the first pairing try keeps retrying for 15 s, and at once when the app returns to the foreground. Unreachable states link to Settings. |
| Cleartext HTTP | `NSAllowsLocalNetworking` only; App Transport Security stays on everywhere else. Android enables cleartext through `expo-build-properties`. |
| HEIC | The PC cannot decode it, so photos sent to its clipboard are re-encoded as JPEG. Passboard sends keep the original file. |
| Haptics stop while the camera runs | The pairing success haptic fires on the pairing screen, after the scanner has closed. |

## Security and privacy

- **Token:** stored in the Keychain (`AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`) and nowhere else. Forgetting a PC deletes it. No error message contains it.
- **History:** text previews of up to 160 characters and file names, stored on the device only. It can be cleared from Settings.
- **Photo library:** access is add-only, and requested only when saving an image pulled from the PC.
- **Other permissions:** no microphone or Face ID permission is declared.
- **EAS Update:** the app contacts Expo's servers at launch, and when someone checks from Settings › Updates. Each request carries:
  - a random installation id (`EAS-Client-ID`);
  - the runtime version and channel;
  - after a crash, the previous fatal JavaScript error message.

  No transferred content is sent. OTA updates stay on in the App Store build (owner decision, 2026-09-12). Declare these requests when filling in the App Store privacy details in Phase 2.

## Design implementation

The home screen is direction **B · Conduit** from the approved mockups:
- **Top:** the PC, with two sockets (Clipboard, Passboard) showing the last item each one received.
- **Middle:** a line down to this iPhone. It carries the connection state (glowing, a searching pulse, dashed when unreachable), the progress of file transfers, and a comet for completed transfers.
- **Bottom:** the launch pad, with the native paste button, then Photo, From PC and File.

Known gap, noted by the owner: the middle of the conduit feels empty when idle.

`src/theme/tokens.ts` mirrors the mockups. Motion runs on the UI thread through Reanimated shared values, using `.get()`/`.set()` as the React Compiler requires. With Reduce Motion on, every travel animation becomes a fade.

## The bench

`npx expo start --web` renders the real screens in a browser, inside an iPhone frame, facing a fake PC that answers exactly like the desktop. It has regimes for first launch, a sleeping PC, a slow network and a rejected token, and it switches appearance, language and device. The web build exists only for the bench; the app never runs in a browser. See [bench.md](bench.md).

## Not done yet

- **Real-device checks:** the Local Network prompt, `.local` resolution on iOS, paste button sizing in French, upload progress.
- **Share extension and Shortcuts actions:** built and signed, not yet tried on a phone. See [extensions.md](extensions.md).
- **Widgets and Control Center controls:** written, not yet built. The first build needs the owner's Apple ID login for the new `direct.passer.app.widgets` identifier.
- **Later phases:** multiple PCs in the UI, and mDNS discovery (phases 2 and 3).
- **Device passes:** VoiceOver on a real iPhone, and 60 fps on the transfer animation.
