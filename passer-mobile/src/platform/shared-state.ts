import { File, Paths } from 'expo-file-system';

import type { AddressKind, PairedPc } from '@/core/types';
import { language } from '@/i18n';
import type { Destination, Direction, HistoryKind } from '@/state/history';

import { APP_GROUP } from './app-group';
import type { PhotoDestination } from './storage';

/**
 * What the parts of Passer that run outside the app need: the share extension
 * and the Shortcuts actions. They are Swift and cannot read AsyncStorage, so
 * the app mirrors the paired PCs into the App Group container, and reads back
 * the transfers they made. The contract is in `docs/mobile/extensions.md`.
 *
 * Tokens are not here: they are in the App Group's keychain group (`secrets.ts`).
 */

const STATE_FILE = 'passer-state.json';
const OUTBOX_FILE = 'passer-outbox.json';

type SharedPc = {
  key: string;
  id: string | null;
  name: string;
  host: string | null;
  ip: string | null;
  port: number;
  preferredAddress: AddressKind;
};

let pcs: SharedPc[] = [];
let photoDestination: PhotoDestination | null = null;

/** Missing on Android, and in a build without the App Group entitlement. */
function container() {
  return Paths.appleSharedContainers[APP_GROUP] ?? null;
}

export function shareWithExtensions(patch: { pcs?: PairedPc[]; photoDestination?: PhotoDestination | null }): void {
  if (patch.pcs) {
    pcs = patch.pcs.map(({ key, id, name, host, ip, port, preferredAddress }) => ({
      key,
      id,
      name,
      host,
      ip,
      port,
      preferredAddress,
    }));
  }
  if (patch.photoDestination !== undefined) photoDestination = patch.photoDestination;

  const folder = container();
  if (!folder) return;
  try {
    const file = new File(folder, STATE_FILE);
    if (!file.exists) file.create();
    file.write(JSON.stringify({ version: 1, language, photoDestination, pcs }));
  } catch {
    // The extensions keep the previous copy; the next change writes it again.
  }
}

export type OutboxEntry = {
  pcKey: string;
  direction: Direction;
  kind: HistoryKind;
  destination: Destination;
  title: string;
  size: number | null;
  at: number;
};

const DIRECTIONS: readonly string[] = ['sent', 'received'];
const KINDS: readonly string[] = ['text', 'image', 'file', 'files'];
const DESTINATIONS: readonly string[] = ['pc-clipboard', 'passboard', 'iphone-clipboard', 'photos', 'files'];

function isOutboxEntry(value: unknown): value is OutboxEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.pcKey === 'string' &&
    DIRECTIONS.includes(entry.direction as string) &&
    KINDS.includes(entry.kind as string) &&
    DESTINATIONS.includes(entry.destination as string) &&
    typeof entry.title === 'string' &&
    // Swift's JSONEncoder leaves out a nil size rather than writing null.
    (entry.size == null || typeof entry.size === 'number') &&
    typeof entry.at === 'number'
  );
}

/** Transfers made by the share extension and the Shortcuts actions since the app last looked. */
export function takeOutbox(): OutboxEntry[] {
  const folder = container();
  if (!folder) return [];
  try {
    const file = new File(folder, OUTBOX_FILE);
    if (!file.exists) return [];
    const parsed: unknown = JSON.parse(file.textSync());
    file.delete();
    return Array.isArray(parsed)
      ? parsed.filter(isOutboxEntry).map((entry) => ({ ...entry, size: entry.size ?? null }))
      : [];
  } catch {
    return [];
  }
}
