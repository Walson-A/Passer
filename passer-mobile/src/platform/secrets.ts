import * as SecureStore from 'expo-secure-store';

/**
 * Pairing tokens live in the Keychain (Keystore on Android) and nowhere else:
 * never in AsyncStorage, never in logs, never in error messages.
 */
const OPTIONS: SecureStore.SecureStoreOptions = {
  // Stays on this device (no backup or device-to-device transfer) and is
  // readable after the first unlock, which a future share extension needs.
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

/** SecureStore keys only accept letters, digits, ".", "-" and "_". */
function tokenKey(pcKey: string): string {
  return `passer.token.${pcKey.replace(/[^A-Za-z0-9._-]/g, '_')}`;
}

export async function saveToken(pcKey: string, token: string): Promise<void> {
  await SecureStore.setItemAsync(tokenKey(pcKey), token, OPTIONS);
}

export function readToken(pcKey: string): Promise<string | null> {
  return SecureStore.getItemAsync(tokenKey(pcKey), OPTIONS);
}

export async function deleteToken(pcKey: string): Promise<void> {
  await SecureStore.deleteItemAsync(tokenKey(pcKey), OPTIONS);
}
