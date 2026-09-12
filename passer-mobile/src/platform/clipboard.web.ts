import { benchHost } from './web-bench';

export type ClipboardContent = 'text' | 'image' | 'empty';

/** Bench stand-in for the iPhone clipboard (see `web-bench.ts`), set from the bench's controls. */
export async function detectClipboard(): Promise<ClipboardContent> {
  return benchHost().clipboard.read().kind;
}

export function onClipboardChange(listener: () => void): { remove: () => void } {
  return { remove: benchHost().clipboard.subscribe(listener) };
}

export async function copyText(text: string): Promise<void> {
  const host = benchHost();
  host.clipboard.write({ kind: 'text', text });
  host.log('clipboard', `Texte copié sur l’iPhone : ${text.slice(0, 80)}`);
}

export async function copyImageFile(fileUri: string): Promise<void> {
  const host = benchHost();
  host.clipboard.write({ kind: 'image', dataUri: fileUri, width: 0, height: 0 });
  host.log('clipboard', 'Image copiée sur l’iPhone');
}
