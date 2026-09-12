import * as Clipboard from 'expo-clipboard';
import { readAsStringAsync } from 'expo-file-system/legacy';

export type ClipboardContent = 'text' | 'image' | 'empty';

/**
 * What the iPhone clipboard holds, without reading it: these checks don't
 * trigger the iOS paste alert. Reading happens only through the native paste
 * button, on the user's tap.
 */
export async function detectClipboard(): Promise<ClipboardContent> {
  const [hasImage, hasText] = await Promise.all([Clipboard.hasImageAsync(), Clipboard.hasStringAsync()]);
  if (hasImage) return 'image';
  return hasText ? 'text' : 'empty';
}

export function onClipboardChange(listener: () => void): { remove: () => void } {
  return Clipboard.addClipboardListener(listener);
}

export async function copyText(text: string): Promise<void> {
  await Clipboard.setStringAsync(text);
}

export async function copyImageFile(fileUri: string): Promise<void> {
  const base64 = await readAsStringAsync(fileUri, { encoding: 'base64' });
  await Clipboard.setImageAsync(base64);
}
