# The bench: see the screens without a phone

> ```bash
> EXPO_UNSTABLE_WEB_MODAL=1 npx expo start --web --port 8090
> ```
> Run it in `passer-mobile/`, then open <http://localhost:8090>. In PowerShell, set the variable first: `$env:EXPO_UNSTABLE_WEB_MODAL = '1'`. In the desktop app's Browser pane, the `bench` configuration in `passer-mobile/.claude/launch.json` starts the same server.
>
> `EXPO_UNSTABLE_WEB_MODAL` makes expo-router draw sheets as sheets on the web, with detents, rounded corners and the screen behind them scaled back. Without it, every sheet opens full screen under the status bar, which is not what the phone shows.

The bench renders the app's real screens in a browser, inside an iPhone frame, facing a fake Passer PC. The code lives in `bench/` and `index.web.ts`, plus the `*.web.ts(x)` stand-ins in `src/`.

## Why it exists

Without the bench, the mobile app is written blind. There is no iOS simulator on Windows, and a build takes a quarter of an hour. So a screen gets written and believed correct, and then the owner finds on the phone that a label is cut or a button sits under the home indicator.

The bench mounts the app exactly as `expo-router/entry` does, with the real theme, components and state providers. What it shows is what the phone will show, except for iOS fonts and shadows.

## What it is not

- **It is not a copy of the screens.** It imports `src/app` as it is. A bench that redraws what it measures ends up judging its own copy.
- **It is not proof that the app works on the phone.** It says nothing about native behaviour:
  - the Local Network prompt;
  - `.local` resolution;
  - UIPasteControl sizing with SF Pro;
  - VoiceOver itself.

  It judges layout, states and flows.

## What is faked, and why

Only fake what a browser cannot have, never a piece of the app. Each stand-in sits in a `.web` platform file that the native build never bundles. The stand-ins get their implementation from the bench through `src/platform/web-bench.ts`.

| Surface | Stand-in | Why |
|---|---|---|
| The Passer PC | `bench/fake-pc.ts`, reached through `fetch` and `src/platform/file-transport.web.ts` | There is no PC here, and the bench needs states it can choose |
| Keychain | `src/platform/secrets.web.ts` | `expo-secure-store` has no web implementation |
| iPhone clipboard | `src/platform/clipboard.web.ts` | It is set from the bench's controls |
| UIPasteControl | `src/platform/paste-button.web.tsx` | It is a native view. The stand-in is drawn after Apple's control, and greyed out when the clipboard holds nothing it accepts |
| Photos, document picker, file system, share sheet | `src/platform/media.web.ts` | Picks come from fixtures; saving and sharing go to the log |
| Haptics, VoiceOver | `src/platform/haptics.web.ts`, `src/platform/accessibility.web.ts` | They are written to the log, where they can be checked |
| Safe areas | `src/platform/safe-area-provider.web.tsx` | The web provider measures zero insets, which would hide a title under the Dynamic Island |
| Appearance and language | `src/theme/system-scheme.web.ts`, `src/i18n/device-language.web.ts` | They are switched from the bench |

### The fake PC answers exactly like the desktop

`bench/fake-pc.ts` mirrors `passer-app/src-tauri/src/server.rs`, `auth.rs`, `clipboard.rs` and `files.rs`. That covers:
- status codes, content types and JSON bodies;
- the 401 message;
- axum's plain-text rejections;
- the HEIC decode failure.

The fixtures in `bench/fixtures.ts` have the desktop's shapes too: COMPUTERNAME, the derived `.local` name, a 16-character id and a 32-character token.

A fake that invents a field or a status makes a correct screen look broken, or a broken one look correct. When the desktop's API changes, change the fake in the same commit. Read the Rust to do it, not your memory of it.

## Regimes

| Regime | What it shows |
|---|---|
| Appairé (paired) | The PC answers; a week of history with long file names |
| Premier lancement (first launch) | No PC and no history: welcome and pairing |
| PC endormi (asleep) | Nothing answers; requests end when the app gives up |
| Lent (slow) | 0.9 s pings, 1.5 s requests, 450 KB/s: loading states and progress |
| Sans .local (no mDNS) | Only the IP address answers |
| À distance (remote) | Away from home over Tailscale: only the machine name answers, through a relay |
| Jeton refusé (refused) | The PC expects another token: every transfer gets a 401 |
| Autre PC (other PC) | Another Passer PC answers at the IP address |

The right rail also sets:
- the device (iPhone 16, 16 Pro Max, SE);
- the appearance;
- the iPhone's language;
- what the iPhone and PC clipboards hold.

Below it, the log lists haptics, VoiceOver announcements, what the PC received and every HTTP error.

Changing the regime, device or language relaunches the app, as iOS would. Appearance and clipboards change live.

## Two ways to look

- **Desk** (a wide window). The screens are on the left, the phone in the middle, and the controls and log on the right. The phone is an iframe the size of the device, so its window, sheets and safe areas are the phone's.
- **Phone** (`?bench=phone`, or a window as narrow as a phone). The phone alone, at 1:1. Agents screenshot this view, with the viewport set to the device size (393 × 852 for the iPhone 16).

Both views accept the controls as URL parameters, for example `?bench=phone&regime=slow&scheme=light&language=en&device=iphone-se`. `&open=/settings` opens a modal route over Home.

`&motion=off` makes every animation jump to its end state. Use it for screenshots when the Browser pane is hidden: a hidden pane renders about two frames a second, so an entrance animation caught on its first frame looks like a faded screen. Network timeouts still run in real time, so give a regime such as "PC endormi" a few seconds before judging it.

### Sheets

With `EXPO_UNSTABLE_WEB_MODAL`, expo-router draws sheets with vaul. `bench/phone.tsx` corrects what vaul doesn't know about iOS:
- it paints sheets in the app's sheet colour, not the navigation theme's grey;
- it keeps a large sheet below the status bar and draws the grabber;
- it lets a sheet's content take the sheet's width;
- it scales the screen behind, as iOS does.

expo-router doesn't mark full-screen modals on the web, so the bench recognises them by vaul's default 24 px corner radius. Every sheet in the app sets 32 px; keep it that way, or update the selector. Detents are approximate: a 0.6 detent is 60 % of the window.

## Limits

- **Fonts.** The browser has no SF Pro, and Windows falls back to Segoe UI. Widths differ slightly, so check a borderline label on the phone before rewording it.
- **Shadows and blur** are approximated.
- **The camera** is unavailable in the desktop app's browser, so the scanner only shows its permission state.
- **Native-only UI**, such as a SwiftUI share extension, cannot run here.

## Adding a screen, a call or a native module

1. **A new route.** It works on its own. To list it, add it to `ROUTE_GROUPS` in `bench/desk.tsx`.
2. **A new call to the PC.** Make `bench/fake-pc.ts` answer it, following the Rust.
3. **A new native module in `src/platform/`.** Give it a `.web.ts` stand-in that asks `web-bench.ts`, or the web build fails when it imports the module.
4. **Before calling a screen done,** look at it in every regime, in both appearances and in both languages.
