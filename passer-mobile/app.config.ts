import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Reverse of the product domain, passer.direct. Treat it as permanent: App
 * Store Connect ties the app record to it, and a new id means a new app.
 */
const BUNDLE_ID = 'direct.passer.app';

/** Also in `src/platform/app-group.ts` and `targets/share/_shared/PasserShared.swift`. */
const APP_GROUP = 'group.direct.passer.app';

/** EAS project `@walsondev/passer`, created with `eas init`. */
const EAS_PROJECT_ID = '24bd9306-2019-4dbf-808d-bd058478c748';

const LOCAL_NETWORK_REASON =
  'Passer connects to your PC over Wi-Fi to send and receive your clipboard, photos and files. Nothing leaves your local network.';
const CAMERA_REASON = 'Passer uses the camera to scan the pairing code shown on your PC.';
const SAVE_PHOTOS_REASON = 'Passer saves the images you receive from your PC to your photo library.';
const PHOTOS_REASON =
  'Passer reads your latest screenshots and photos when you run one of its Shortcuts actions, to send them to your PC.';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Passer',
  slug: 'passer',
  owner: 'walsondev',
  scheme: 'passer',
  // 1.1 adds the App Group. Its JavaScript stores tokens in the group's keychain,
  // which a 1.0 build can't open; the runtime version follows this number, so
  // updates for 1.1 never reach a 1.0 build.
  version: '1.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  runtimeVersion: { policy: 'appVersion' },
  ...(EAS_PROJECT_ID
    ? {
        updates: {
          url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
          checkAutomatically: 'ON_LOAD',
          fallbackToCacheTimeout: 0,
        },
      }
    : {}),
  ios: {
    bundleIdentifier: BUNDLE_ID,
    supportsTablet: false,
    icon: './assets/images/icon.png',
    config: { usesNonExemptEncryption: false },
    // Shared with the share extension and the Shortcuts actions: the paired PCs,
    // and the keychain group holding the tokens (docs/mobile/extensions.md).
    entitlements: { 'com.apple.security.application-groups': [APP_GROUP] },
    infoPlist: {
      NSLocalNetworkUsageDescription: LOCAL_NETWORK_REASON,
      // Declared now for the "find PCs on this network" discovery planned in phase 3.
      NSBonjourServices: ['_passer._tcp'],
      // The PC serves plain HTTP on the LAN. This is the scoped exception for
      // local addresses only; App Transport Security stays on for everything else.
      NSAppTransportSecurity: { NSAllowsLocalNetworking: true },
    },
  },
  android: {
    package: BUNDLE_ID,
    adaptiveIcon: {
      backgroundColor: '#0F0F0F',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    blockedPermissions: ['android.permission.RECORD_AUDIO'],
    predictiveBackGestureEnabled: false,
  },
  locales: {
    en: './locales/en.json',
    fr: './locales/fr.json',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 112,
        backgroundColor: '#F3F3F0',
        dark: { image: './assets/images/splash-icon.png', backgroundColor: '#0F0F0F' },
      },
    ],
    [
      'expo-camera',
      { cameraPermission: CAMERA_REASON, microphonePermission: false, recordAudioAndroid: false },
    ],
    [
      'expo-image-picker',
      // The system photo picker needs no library permission, but the Shortcuts
      // screenshot actions do, and `false` here would delete that string and the
      // camera one. Both repeat what the other plugins set.
      { photosPermission: PHOTOS_REASON, cameraPermission: CAMERA_REASON, microphonePermission: false },
    ],
    [
      'expo-media-library',
      { photosPermission: PHOTOS_REASON, savePhotosPermission: SAVE_PHOTOS_REASON, isAccessMediaLocationEnabled: false },
    ],
    // Tokens are stored without biometrics, so no Face ID permission string.
    ['expo-secure-store', { faceIDPermission: false }],
    'expo-localization',
    'expo-sharing',
    // Android blocks cleartext HTTP by default; the PC API is plain HTTP on the LAN.
    ['expo-build-properties', { android: { usesCleartextTraffic: true } }],
    // The share extension, from targets/share.
    '@bacons/apple-targets',
    // The Shortcuts actions, from native/shortcuts, compiled into the app.
    './plugins/with-shortcuts',
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    ...(EAS_PROJECT_ID ? { eas: { projectId: EAS_PROJECT_ID } } : {}),
  },
});
