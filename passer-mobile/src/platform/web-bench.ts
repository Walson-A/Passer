import type { EdgeInsets } from 'react-native-safe-area-context';

import type { FileTransport, UploadFile } from '@/core/client';

import type { PickedPhoto } from './media-types';

/**
 * The web build exists only for the bench (`bench/`, see `docs/mobile/bench.md`),
 * which renders the real screens in a browser. A browser has no Keychain, no
 * UIPasteControl, no Photos library and no Passer PC, so each `*.web.ts` file in
 * this folder asks the bench for its stand-in through this registry. Nothing in
 * the native build imports it.
 */

export const BENCH_STORAGE_KEY = 'passer.bench.v1';

export type BenchLogKind = 'haptic' | 'voiceover' | 'clipboard' | 'pc' | 'photos' | 'share';

export type IphoneClipboard =
  | { kind: 'empty' }
  | { kind: 'text'; text: string }
  | { kind: 'image'; dataUri: string; width: number; height: number };

export type BenchHost = {
  log: (kind: BenchLogKind, message: string) => void;
  clipboard: {
    read: () => IphoneClipboard;
    write: (value: IphoneClipboard) => void;
    subscribe: (listener: () => void) => () => void;
  };
  transport: FileTransport;
  pickPhotos: () => Promise<PickedPhoto[]>;
  pickFiles: () => Promise<UploadFile[]>;
  insets: EdgeInsets;
};

let host: BenchHost | null = null;

export function installBenchHost(next: BenchHost): void {
  host = next;
}

export function benchHost(): BenchHost {
  if (!host) throw new Error('The web build only runs inside the bench. See docs/mobile/bench.md.');
  return host;
}

/** A bench choice the app reads as it starts (language) or live (appearance). */
export function benchPreference(name: 'scheme' | 'language'): string | null {
  try {
    const raw = window.localStorage.getItem(BENCH_STORAGE_KEY);
    const value: unknown = raw ? (JSON.parse(raw) as Record<string, unknown>)[name] : null;
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}

/** Fires when the bench's controls, in the parent page, change a preference. */
export function subscribeBenchPreferences(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === BENCH_STORAGE_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}
