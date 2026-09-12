import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { ACTION_LIFETIME_MS, parseAppAction, type AppAction } from '@/core/app-actions';
import { takeInboxAction } from '@/platform/action-inbox';

/**
 * The action a widget or a control asked for, until Home runs it. Widgets open
 * `passer://action/<name>` (`src/app/action/[name].tsx`); controls leave the
 * action in the App Group as they bring the app forward (`action-inbox.ts`).
 */

export type PendingAction = { action: AppAction; key: number; at: number };

let pending: PendingAction | null = null;
let lastKey = 0;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function requestAction(action: AppAction, at: number = Date.now()): void {
  if (Date.now() - at > ACTION_LIFETIME_MS) return;
  lastKey += 1;
  pending = { action, key: lastKey, at };
  emit();
}

/** Called by the screen that runs the action, so it runs once. */
export function takeAction(key: number): void {
  if (pending?.key !== key) return;
  pending = null;
  emit();
}

/** After the app comes forward, a control's intent may write its action a moment later. */
const INBOX_CHECKS_MS = [0, 300, 800, 1_600, 3_000];

/** The waiting action; also watches the App Group for controls while the screen is mounted. */
export function usePendingAction(): PendingAction | null {
  const current = useSyncExternalStore(subscribe, () => pending);

  useEffect(() => {
    let timers: ReturnType<typeof setTimeout>[] = [];
    const check = () => {
      const found = takeInboxAction();
      const action = found ? parseAppAction(found.action) : null;
      if (found && action) requestAction(action, found.at);
    };
    const checkForAWhile = () => {
      timers.forEach(clearTimeout);
      timers = INBOX_CHECKS_MS.map((delay) => setTimeout(check, delay));
    };
    checkForAWhile();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkForAWhile();
    });
    return () => {
      subscription.remove();
      timers.forEach(clearTimeout);
    };
  }, []);

  return current;
}
