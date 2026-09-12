# Share extension and Shortcuts actions

The share extension and the Shortcuts actions are Swift, and they run outside the React Native app. They reach the PC on their own, using the pairing the app made. This page is the contract between the two sides.

## What the app shares with them

Everything goes through the App Group `group.direct.passer.app`. The same identifier appears in `app.config.ts`, `src/platform/app-group.ts` and `targets/_shared/PasserShared.swift`.

### Paired PCs: `passer-state.json`

`src/platform/shared-state.ts` writes this file at the root of the App Group container whenever the pairings or the settings change:

```json
{
  "version": 1,
  "language": "fr",
  "photoDestination": null,
  "pcs": [
    {
      "key": "h3K9sQ2mX7pL4vRt",
      "id": "h3K9sQ2mX7pL4vRt",
      "name": "DESKTOP-4F7KQ2M",
      "host": "desktop-4f7kq2m.local",
      "ip": "192.168.1.42",
      "port": 8000,
      "preferredAddress": "host"
    }
  ]
}
```

- `pcs[0]` is the PC the app talks to.
- `photoDestination` is `"clipboard"`, `"passboard"`, or `null` when the app asks each time.
- `language` is the app's language, so messages outside the app match it.
- The token is never in this file.

### Tokens: the keychain

`src/platform/secrets.ts` stores each token with expo-secure-store in the App Group's keychain group. Swift reads it as a generic password with:
- service `app:no-auth`;
- account and generic attribute set to the UTF-8 bytes of `passer.token.<key>`, where any character of the PC key other than a letter, a digit, `.`, `-` or `_` becomes `_`;
- access group `group.direct.passer.app`.

Passer 1.0 kept tokens in the app's own keychain group, which extensions cannot read. The app moves each token to the shared group the first time it reads it.

Using the group needs the App Group entitlement, which a 1.0 build doesn't have. The app version therefore moves to 1.1.0 with this change, so its JavaScript never reaches a 1.0 build over the air (the runtime version follows the app version).

### Transfers made outside the app: `passer-outbox.json`

The extension and the actions append each transfer they make:

```json
[
  {
    "pcKey": "h3K9sQ2mX7pL4vRt",
    "direction": "sent",
    "kind": "file",
    "destination": "passboard",
    "title": "Facture octobre 2026.pdf",
    "size": 1284312,
    "at": 1757683200000
  }
]
```

The values are those of `HistoryItem` in `src/state/history.tsx`, and `size` may be missing. The app merges the file into its history when it comes to the front, then deletes it.

## Talking to the PC

`targets/share/_shared/PasserClient.swift` mirrors `src/core/endpoint.ts` and `src/core/client.ts`:
- it tries the preferred address first, and the other one 350 ms later;
- it checks the PC's identity before the token is sent;
- it reads status codes and error bodies the same way, including the HTTP 200 error bodies of older desktops.

Change both sides together. The bench's fake PC (`bench/fake-pc.ts`) describes the desktop's answers.

`targets/share/_shared/` holds everything the extension and the app share, and apple-targets compiles that folder into both:
- `PasserShared.swift`: the state file, the token and the outbox;
- `PasserClient.swift`: the PC;
- `PasserFiles.swift`: staged files and the image conversion;
- `PasserText.swift`: the messages.

## The share extension (`targets/share`)

`@bacons/apple-targets` generates the extension at prebuild from `targets/share/expo-target.config.js`. It has:
- the bundle id `direct.passer.app.share`, for iOS 17 and later, like the app;
- the App Group entitlement;
- our own `Info.plist`. It accepts text, one web link, up to 50 photos, 20 videos and 50 files. It also allows plain HTTP to local addresses: App Transport Security applies per bundle, and `.local` names need the key.

How it works:
- **Start.** `ShareModel.swift` reads the attachments and finds the PC at the same time.
- **Destination.**
  - Text and links go to the PC clipboard, and files to the Passboard.
  - Photos follow the destination the app remembers, or the sheet asks.
  - The PC clipboard takes one image. It is converted to an upright JPEG unless it is already PNG or JPEG.
- **Upload.** It runs while the sheet is open, with its progress on the line; the sheet then closes itself. A background upload for very large files is not done yet.
- **Look.** `ShareView.swift` uses the Conduit vocabulary, and `PasserTheme.swift` mirrors `src/theme/tokens.ts`.

The bench can't show the extension, since SwiftUI only runs on the iPhone.

## The Shortcuts actions (`native/shortcuts`)

`plugins/with-shortcuts.js` copies these files into the app target at prebuild. App Intents must be compiled into the app itself: Apple's metadata extraction skips static pods, and App Shortcut phrases are read only from an `AppShortcuts.xcstrings` in the app bundle.

| Action (French name) | What it does |
|---|---|
| Envoyer du texte au PC | Puts the text it receives on the PC clipboard |
| Envoyer des fichiers au PC | Sends one image to the PC clipboard and anything else to the Passboard; the destination can be forced |
| Envoyer le presse-papiers au PC | Reads the iPhone clipboard and sends it; iOS may ask to allow pasting |
| Envoyer la dernière capture au PC | Sends the newest screenshot, to the PC clipboard by default |
| Envoyer puis supprimer la dernière capture | Does the same, then deletes the screenshot; iOS asks to confirm |
| Envoyer les dernières photos au PC | Sends the N newest photos |
| Obtenir le texte du PC | Hands the PC clipboard's text to the next action |
| Obtenir les fichiers du PC | Hands the PC's image (PNG) or copied files (ZIP) to the next action |
| Copier le presse-papiers du PC | Pulls the PC clipboard onto the iPhone clipboard |
| PC joignable | Tells whether the PC answers, for automations |

Five of them work from Siri, Spotlight and the Action Button without building a shortcut:
- send the clipboard;
- copy the PC clipboard;
- send the latest screenshot;
- send and delete it;
- check the PC.

Localisation:
- **Titles, descriptions and parameters** are keys of `Localizable.xcstrings`.
- **Phrases** are keys of `AppShortcuts.xcstrings`, written with `${applicationName}`. Xcode only accepts that catalog for iOS 17 and later, which is why the app requires iOS 17 (`expo-build-properties` in `app.config.ts`).
- **Messages shown while an action runs** come from `IntentText.swift` and `PasserText.swift`, in the app's language.

To check on the iPhone:
- **Time.** An action gets 30 seconds.
- **Clipboard.** Reading or writing the iPhone clipboard from a background action is not documented. If it fails, the action says so. "Obtenir le presse-papiers" followed by "Envoyer du texte au PC" always works.
- **Photo access.** The photo actions need access granted in the app, under Réglages › Raccourcis, because an action in the background can't show the prompt. With limited access, the newest screenshot may not be visible.
- **Deleting.** Deleting a photo always asks for confirmation. On iOS 26 the request sometimes never answers, so the action gives up after 15 seconds and reports the screenshot as sent but not deleted.

## Building

- **Swift can't be compiled on Windows.** `eas build --platform ios --profile simulator` compiles the app, the extension and the actions without signing anything.
- **Signing the extension needs the App Group on its identifier.** EAS registers capabilities only when the build runs with an Apple ID login, not with an App Store Connect API key. If signing fails with "Provisioning profile doesn't support the group.direct.passer.app App Group":
  1. enable App Groups with `group.direct.passer.app` on `direct.passer.app.share` in the Apple Developer portal;
  2. delete that identifier's provisioning profile in `eas credentials`;
  3. build again.
- **Dependencies.** apple-targets 5.0.0 pulls in `@expo/require-utils` 55, whose TypeScript peer rejects TypeScript 6. `package.json` overrides it with the SDK 57 version, so `npm ci` on EAS accepts the lockfile.
