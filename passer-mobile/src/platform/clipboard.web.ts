import { benchHost } from './web-bench';

export type ClipboardContent = 'text' | 'image' | 'empty';

/** Bench stand-in for the iPhone clipboard (see `web-bench.ts`), set from the bench's controls. */
export async function detectClipboard(): Promise<ClipboardContent> {
  return benchHost().clipboard.read().kind;
}

export type ClipboardRead = { kind: 'text'; text: string } | { kind: 'image'; dataUri: string } | { kind: 'empty' };

export async function readClipboard(): Promise<ClipboardRead> {
  const host = benchHost();
  const value = host.clipboard.read();
  host.log('clipboard', 'iOS demande d’autoriser le collage, puis Passer lit le presse-papiers');
  return value.kind === 'image' ? { kind: 'image', dataUri: value.dataUri } : value;
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
