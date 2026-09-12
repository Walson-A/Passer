# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Look at what you change: the bench

The app is written without a simulator, so every screen you touch must be seen before it is called done.

1. Run `npx expo start --web --port 8090` in this folder with `EXPO_UNSTABLE_WEB_MODAL=1` set, so sheets render as sheets (the `bench` configuration in `.claude/launch.json` does both).
2. Open http://localhost:8090. For screenshots, use `?bench=phone&motion=off` with the viewport at the device size (393 × 852).
3. Check every regime, both appearances and both languages, and fix what the bench shows.

The bench fakes only what a browser cannot have, and its fake PC must answer exactly like `passer-app/src-tauri/src`. Rules and limits: `../docs/mobile/bench.md`.
