import { File, Paths } from 'expo-file-system';

import { APP_GROUP } from './app-group';

/**
 * Where a Control Center control leaves its action. A control can't open a
 * custom URL scheme, so its intent brings the app forward and writes
 * `{ "action": "send-clipboard", "at": 1757683200000 }` to the App Group
 * (`PasserActionInbox` in `targets/widgets/_shared/PasserActions.swift`).
 */
const INBOX_FILE = 'passer-action.json';

/** Reads and removes the waiting action, unchecked: `src/state/actions.ts` validates it. */
export function takeInboxAction(): { action: string; at: number } | null {
  const folder = Paths.appleSharedContainers[APP_GROUP];
  if (!folder) return null;
  try {
    const file = new File(folder, INBOX_FILE);
    if (!file.exists) return null;
    const parsed: unknown = JSON.parse(file.textSync());
    file.delete();
    if (!parsed || typeof parsed !== 'object') return null;
    const { action, at } = parsed as Record<string, unknown>;
    return typeof action === 'string' && typeof at === 'number' ? { action, at } : null;
  } catch {
    return null;
  }
}
