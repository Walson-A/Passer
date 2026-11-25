import { authenticateAsync } from 'expo-local-authentication';

/**
 * - `ok`: it is the phone's owner.
 * - `cancelled`: they stepped back.
 * - `no-code`: the phone has no code at all, so nothing can prove who holds it.
 * - `failed`: anything else (locked out, not recognised).
 */
export type Proof = 'ok' | 'cancelled' | 'no-code' | 'failed';

/**
 * Face ID, Touch ID or the phone's code, before seeing or controlling another device's
 * screen: a stolen but unlocked phone must not be enough. Without biometrics set up, the
 * system asks for the phone's code instead (`disableDeviceFallback` stays off).
 */
export async function provePresence(reason: string): Promise<Proof> {
  try {
    const result = await authenticateAsync({ promptMessage: reason, disableDeviceFallback: false });
    if (result.success) return 'ok';
    if (result.error === 'passcode_not_set') return 'no-code';
    return result.error === 'user_cancel' || result.error === 'system_cancel' || result.error === 'app_cancel'
      ? 'cancelled'
      : 'failed';
  } catch {
    return 'failed';
  }
}
