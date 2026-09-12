import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Reverse of the domain the product will live on. It becomes permanent with
 * the first TestFlight build, because App Store Connect ties the app record to
 * it. Pending the owner's choice between passer.direct and passer.sh.
 */
const BUNDLE_ID = 'direct.passer.app';

/** EAS project `@walsondev/passer`, created with `eas init`. */
const EAS_PROJECT_ID = '24bd9306-2019-4dbf-808d-bd058478c748';

const LOCAL_NETWORK_REASON =
  'Passer connects to your PC over Wi-Fi to send and receive your clipboard, photos and files. Nothing leaves your local network.';
const CAMERA_REASON = 'Passer uses the camera to scan the pairing code shown on your PC.';
const SAVE_PHOTOS_REASON = 'Passer saves the images you receive from your PC to your photo library.';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Passer',
  slug: 'passer',
  owner: 'walsondev',
  scheme: 'passer',
  version: '1.0.0',
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
      // The system photo picker needs no library permission. The camera string
      // repeats expo-camera's, because `false` here would delete it.
      { photosPermission: false, cameraPermission: CAMERA_REASON, microphonePermission: false },
    ],
    [
      'expo-media-library',
      { photosPermission: false, savePhotosPermission: SAVE_PHOTOS_REASON, isAccessMediaLocationEnabled: false },
    ],
    // Tokens are stored without biometrics, so no Face ID permission string.
    ['expo-secure-store', { faceIDPermission: false }],
    'expo-localization',
    'expo-sharing',
    // Android blocks cleartext HTTP by default; the PC API is plain HTTP on the LAN.
    ['expo-build-properties', { android: { usesCleartextTraffic: true } }],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    ...(EAS_PROJECT_ID ? { eas: { projectId: EAS_PROJECT_ID } } : {}),
  },
});
