import { getPermissionsAsync, requestPermissionsAsync } from 'expo-media-library/legacy';

/**
 * What the Shortcuts screenshot and photo actions can read. They run in the
 * background, where iOS can't show the permission prompt, so the app asks for them.
 */
export type PhotoAccess = 'all' | 'limited' | 'denied' | 'undetermined';

function toAccess(response: { granted: boolean; canAskAgain: boolean; accessPrivileges?: 'all' | 'limited' | 'none' }): PhotoAccess {
  if (response.granted) return response.accessPrivileges === 'limited' ? 'limited' : 'all';
  return response.canAskAgain ? 'undetermined' : 'denied';
}

export async function readPhotoAccess(): Promise<PhotoAccess> {
  return toAccess(await getPermissionsAsync(false));
}

export async function requestPhotoAccess(): Promise<PhotoAccess> {
  return toAccess(await requestPermissionsAsync(false));
}
