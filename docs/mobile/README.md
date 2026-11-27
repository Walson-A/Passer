# Passer Mobile — Architecture

What is built in `passer-mobile/`, and the decisions behind it. The brief it answers is [`SPEC.md`](SPEC.md).

## Status

The app was redesigned on 2026-11-24 (branch `feat/mobile-redesign`): native iOS structure with Passer's identity, built on the device network. Every screen and state is checked in the bench, with captures in [screens.md](screens.md). The redesign itself has not been built yet: the owner's iPhone runs the previous screens, from the builds below.

## Builds

Read from EAS (`eas build:list`) on 2026-11-24. Every build so far is iOS, internal distribution (`preview`) or simulator; there has never been an Android build, a TestFlight build or an App Store build.

| Date (UTC) | Profile | App version | Commit | What it carried |
|---|---|---|---|---|
| 2026-09-12 13:36 | preview | 1.0.0 | `ae81ce8` | Phase 1: pairing, sending, pulling, history |
| 2026-09-12 19:25 | preview | 1.1.0 | `fd9fd1d` | + share extension and Shortcuts actions |
| 2026-10-02 10:44 | preview | 1.1.0 | `0894ad5` | + widgets and Control Center controls |
| 2026-11-24 14:07 | preview | 1.1.0 | `ef8af9d` | + the device network (passer-core mobile-v0.1.0) |
| 2026-11-24 17:45 | preview | 1.1.0 | `68a3cce` | passer-core mobile-v0.2.0, what members are and offer |

Simulator builds on 2026-09-12 checked the Swift of the extensions (three failed before `baebc93`). OTA updates published on the `preview` channel reach these builds while the app version stays 1.1.0; JavaScript that needs native code a build lacks must wait for the next build.

What it does:
- Join your devices with one code: scan the PC's *Add a device* QR (or paste its link), then compare the six digits on both screens
- Send to the device of your choice: what you copied (Apple's paste control), photos, files
- Fetch another device's clipboard, which its user approves each time ("It asks first"), and the files it shares (on its page, *Get*)
- Receive text and files of any size from the PC (the phone offers `clipboard.write`, `file.receive` and `file.drop`)
- See what each device is, its system, when it last answered, the commands it offers and the recent exchanges with it
- Answer permission requests, see every device and whether it answers, add one (from a phone that manages devices), remove one, stop remote activity
- Activity, settings, the direct connection kept for Shortcuts and large files, updates
- iPhone and Android conventions, dark and light, English and French, Dynamic Type, VoiceOver

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
  modules/passer-core/  the device network (Rust passer-core), see device-network.md
  src/
    app/            routes (expo-router): (tabs)/ Send, Devices, Activity; sheets and flows beside
    core/           contracts with the PC and the device network; no React Native imports, unit-tested
    platform/       thin wrappers over native modules, and the platform look (iOS or Android)
    state/          providers: devices, approvals, transfers, history, settings, and the direct pairing
    components/     screen pieces (device drawing, code digits, approval prompt) and ui primitives
    theme/          tokens: the desktop's palette, iOS and Material type scales
    i18n/           strings, EN and FR, in the desktop's words
```

`core/` is platform-agnostic on purpose (spec §9). It holds pairing link parsing, response interpretation, the connection strategy and the API client. Everything native sits behind `platform/`: Keychain, file transfers, pickers, clipboard, haptics. An Android-specific implementation replaces files there, not logic.

## Two ways to the PC

Since the redesign, everything goes through the **device network** (passer-core, [device-network.md](device-network.md)): one pairing, the other device's rules and approvals, end-to-end encryption. `src/core/device-calls.ts` calls the PC's capabilities and turns the core's refusals into the screens' words (denied, no answer, too large, unreachable).

Photos and files go to the PC as streams (`file.drop`, passer-core mobile-v0.3.0): originals, any size, with progress. An image copied on the iPhone (or a screenshot sent to the clipboard) goes onto the PC's clipboard through `clipboard.image`, streamed too, when the PC offers it (desktop 1.1.0-beta.3 and later); against an older PC it lands in its Passer folder instead. The **direct connection**, the HTTP pairing below, when the user set one up in Settings › Direct connection, is still used for files over 700 KB to a PC whose desktop doesn't offer `file.drop` yet.

Without it, against such a PC, photos are shrunk to fit one call and said so; larger files are refused with an explanation ("Too large for now"). The direct pairing's `passer://pair` link carries a permanent token, so it is never handed to other devices of the group (decision with the desktop session, 2026-11-24). Shortcuts, widgets and the share extension keep using it.

## The direct connection (HTTP)

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
| Reading the clipboard shows an alert | The send button is Apple's `UIPasteControl` (`ClipboardPasteButton`). Its label ("Paste") and icon are Apple's; only its colours, shape and size are ours, so the title above it, *What you copied*, and the line saying what is copied carry the meaning. The kind of content is detected without reading it. Android has no such alert: its button says *Send what I copied*. |
| No background receive | Fetching is explicit (the *Its clipboard* disc). The node runs only while the app is open, so the PC can send to the phone only then; the desktop shows the phone as not reachable otherwise. |
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

Direction **native iOS with Passer's identity**, chosen by the owner on 2026-11-24 after the desktop became a full window with a Showroom (mockups: https://claude.ai/artifact/UhwZgK5xtLLmt9Zobju2hd, page *Natif + ADN Passer*). The Showroom itself was set aside on the phone.

- **Structure from the platform.** Three tabs (Send, Devices, Activity), drawn by the system through expo-router's native tabs: UITabBar on iOS, Material 3's navigation bar on Android (`src/platform/tabs-layout.tsx`). Large titles, grouped lists and sheets on iOS; headlines, plain lists and dialogs on Android (`src/platform/look.ts` decides; `components/ui/list.tsx`, `header.tsx` and `approval-prompt.tsx` follow it). Back is the system's: the chevron and swipe on iOS, the arrow and back gesture on Android.
- **Identity from Passer.** Near-black ground, the paste control as the one white action, commands as round discs with the amber lock *It asks first* (the desktop Showroom's grammar), the desktop's navy for confirming (*Add a device*, *Allow once*), each device drawn with the wallpaper the desktop derives from its id (`core/devices.ts`, same formula), the code as two groups of three digits in cells.
- **Words from the desktop.** Reachable / Not reachable, Manages devices, It asks first, This request only, Allow once, Stop remote activity.
- **States.** Loading draws the screen's shape; a failure says what happened in a sentence, the raw detail underneath, and *Try again*; an unreachable device says why it might be and pauses the commands; empty screens say what will appear and how.
- **Accessibility.** Text follows Dynamic Type and Android's font size and nothing has a fixed height; long device names wrap rather than cut; every control has a label, the countdown is a timer VoiceOver reads, outcomes are announced. With Reduce Motion, entrances don't move.

Every screen and state, with captures: [screens.md](screens.md).

## The bench

`npx expo start --web` renders the real screens in a browser, inside an iPhone frame, facing a fake group of devices and a fake PC that answer exactly like the desktop. It has regimes for first launch, a phone alone in its group, a sleeping PC, a PC that refuses, a load failure and the direct connection's cases; it plays another device's actions (a request, a text or file sent, a device joining), and switches platform look, text size, appearance, language and device. The web build exists only for the bench; the app never runs in a browser. See [bench.md](bench.md).

## Not done yet

- **A build of the redesign.** The passer-core module has been compiled by the two iOS builds of 2026-11-24; the redesign and the phone's capabilities (`PhoneCapabilities` in Swift and Kotlin, written against the UniFFI bindings without a compiler here) have not. The next build is the check; Kotlin has never been compiled, since there has been no Android build.
- **Checks on the phone,** not recorded anywhere yet: how native errors read on the JavaScript side (the classification looks for the core's codes in the text), the Local Network prompt with iroh, the native tab bar's look, the paste control at large text sizes, VoiceOver, Android's back gesture.
- **Live presence** isn't in passer-core: reachability is probed with `device.info`, and *seen N min ago* comes from the last answer.
- **Streams to the PC** need the desktop's `file.drop`, on `dev` and not yet released.
- **Share extension, Shortcuts and widgets** still use the direct connection; moving them to the device network needs the core in the extensions.
