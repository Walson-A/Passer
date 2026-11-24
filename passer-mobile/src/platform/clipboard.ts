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

export type ClipboardRead = { kind: 'text'; text: string } | { kind: 'image'; dataUri: string } | { kind: 'empty' };

/**
 * Reads the clipboard for a widget's send, where no paste button was tapped:
 * iOS shows its paste alert. A refused paste reads as an empty clipboard, and
 * iOS gives no way to tell the two apart.
 */
export async function readClipboard(): Promise<ClipboardRead> {
  const content = await detectClipboard();
  if (content === 'image') {
    const image = await Clipboard.getImageAsync({ format: 'png' });
    return image?.data ? { kind: 'image', dataUri: image.data } : { kind: 'empty' };
  }
  if (content === 'text') {
    const text = await Clipboard.getStringAsync();
    return text ? { kind: 'text', text } : { kind: 'empty' };
  }
  return { kind: 'empty' };
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
