# Passer for iPhone

The mobile half of Passer. It sends your clipboard, photos and files from an iPhone to a paired Windows PC over the local network, and pulls the PC clipboard back. No account, no cloud.

Built with Expo SDK 57 (React Native 0.86), expo-router, Reanimated 4 and strict TypeScript. iOS comes first; Android stays buildable.

- Product brief: [`docs/mobile/SPEC.md`](../docs/mobile/SPEC.md)
- How the app is built, and why: [`docs/mobile/README.md`](../docs/mobile/README.md)
- The desktop contract it talks to: [`docs/desktop/api.md`](../docs/desktop/api.md)

## Commands

| Command | What it does |
|---|---|
| `npm install` | Installs dependencies |
| `npm test` | Unit tests: pairing link parsing and desktop response handling |
| `npm run typecheck` | TypeScript, strict |
| `npx expo-doctor` | Checks dependency versions and config |
| `npx expo export --platform ios` | Bundles the app, which catches import and syntax errors without a Mac |

The app uses native modules and config plugins, so it does not run in Expo Go. It runs as an EAS build.

## Getting it on an iPhone

Builds run on EAS (cloud macOS), so no Mac is needed. The EAS project is `@walsondev/passer`.

1. **Register the iPhone once:** run `eas device:create`, open the link on the iPhone and install the profile. Developer Mode must be on (Settings › Privacy & Security).
2. **Build:** run `eas build --platform ios --profile preview`. The first build asks for your Apple ID to create the certificate and provisioning profile; later builds reuse them.
3. **Install:** open the link EAS prints, or scan its QR code, on the iPhone.
4. **Ship JavaScript changes without rebuilding:** run `eas update --channel preview --environment preview --platform ios --message "…"` (`--environment` is required with `--non-interactive`). The app downloads the update when it starts and runs it from the following launch. Changes to native modules or `app.config.ts` need a new build. The App Store build listens on the `production` channel instead.

A new iPhone needs `eas device:create` and a new build, because internal builds carry their device list.

## See the screens: the bench

Run `npx expo start --web --port 8090` with `EXPO_UNSTABLE_WEB_MODAL=1` set, so sheets render as sheets. Then open <http://localhost:8090>. You get the real screens in an iPhone frame, a fake PC, and switches for regime, appearance, language and device. Look at every screen you change there before building. Details and rules: [docs/mobile/bench.md](../docs/mobile/bench.md).

## Bundle id

`BUNDLE_ID` in `app.config.ts` is `direct.passer.app`, the reverse of the product domain `passer.direct`. Don't change it: App Store Connect ties the app record to it, and a new id installs as a different app that has to be paired again.
