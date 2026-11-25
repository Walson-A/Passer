import * as SecureStore from 'expo-secure-store';

import { APP_GROUP } from './app-group';

/**
 * Pairing tokens live in the Keychain (Keystore on Android) and nowhere else:
 * never in AsyncStorage, never in logs, never in error messages.
 */
const OPTIONS: SecureStore.SecureStoreOptions = {
  // Stays on this device (no backup or device-to-device transfer) and is
  // readable after the first unlock, which the share extension needs.
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

/**
 * The App Group's keychain group, which the share extension and the Shortcuts
 * actions can read. Android ignores the group.
 */
const SHARED: SecureStore.SecureStoreOptions = { ...OPTIONS, accessGroup: APP_GROUP };

/** SecureStore keys only accept letters, digits, ".", "-" and "_". */
function tokenKey(pcKey: string): string {
  return `passer.token.${pcKey.replace(/[^A-Za-z0-9._-]/g, '_')}`;
}

export async function saveToken(pcKey: string, token: string): Promise<void> {
  await SecureStore.setItemAsync(tokenKey(pcKey), token, SHARED);
}

export async function readToken(pcKey: string): Promise<string | null> {
  const key = tokenKey(pcKey);
  const shared = await SecureStore.getItemAsync(key, SHARED);
  if (shared !== null) return shared;

  // Passer 1.0 kept tokens in the app's own keychain group, out of the extensions' reach: move them.
  const legacy = await SecureStore.getItemAsync(key, OPTIONS);
  if (legacy === null) return null;
  // A delete without a group removes the item from every group, so it must run before the shared copy exists.
  await SecureStore.deleteItemAsync(key, OPTIONS);
  await SecureStore.setItemAsync(key, legacy, SHARED);
  return legacy;
}

export async function deleteToken(pcKey: string): Promise<void> {
  // Without a group, this removes the token from every keychain group, a 1.0 copy included.
  await SecureStore.deleteItemAsync(tokenKey(pcKey), OPTIONS);
}
