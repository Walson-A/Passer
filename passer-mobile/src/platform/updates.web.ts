import { useSyncExternalStore } from 'react';

import type { AppUpdates, UpdateOutcome, UpdateStatus } from './update-status';
import { benchHost } from './web-bench';

/**
 * Bench stand-in (see `web-bench.ts`): only a release build can reach EAS Update.
 * The desk chooses what the update server holds; checking and downloading take
 * as long as on a phone, and restarting relaunches the phone onto the update.
 * The status lives outside the screen, as expo-updates' does.
 */

const CHECK_MS = 1_100;
const DOWNLOAD_MS = 2_800;
const TICK_MS = 140;
const MINUTE = 60_000;

let status: UpdateStatus | null = null;
let publishedAt: Date | null | undefined;
const listeners = new Set<() => void>();

function read(): UpdateStatus {
  status ??= benchHost().updates.scenario === 'downloaded' ? { kind: 'ready' } : { kind: 'idle' };
  return status;
}

function write(next: UpdateStatus): void {
  status = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function check(): Promise<UpdateOutcome> {
  const { updates, log } = benchHost();
  write({ kind: 'checking' });
  await wait(CHECK_MS);
  if (updates.scenario === 'offline') {
    log('updates', 'Le serveur de mises à jour ne répond pas');
    write({ kind: 'failed' });
    return 'failed';
  }
  if (updates.scenario === 'none') {
    log('updates', 'Aucune mise à jour plus récente');
    write({ kind: 'up-to-date' });
    return 'up-to-date';
  }
  if (updates.scenario === 'available') {
    log('updates', 'Mise à jour trouvée, téléchargement');
    for (let elapsed = 0; elapsed < DOWNLOAD_MS; elapsed += TICK_MS) {
      write({ kind: 'downloading', progress: elapsed === 0 ? null : elapsed / DOWNLOAD_MS });
      await wait(TICK_MS);
    }
    log('updates', 'Mise à jour téléchargée');
  }
  write({ kind: 'ready' });
  return 'ready';
}

/** The running update: published 25 minutes ago after a restart onto it, two days ago when nothing newer exists. */
function runningSince(): Date | null {
  if (publishedAt === undefined) {
    const { scenario, applied } = benchHost().updates;
    publishedAt = applied
      ? new Date(Date.now() - 25 * MINUTE)
      : scenario === 'none'
        ? new Date(Date.now() - 2 * 24 * 60 * MINUTE)
        : null;
  }
  return publishedAt;
}

export function useAppUpdates(): AppUpdates {
  const current = useSyncExternalStore(subscribe, read);
  return {
    enabled: true,
    status: current,
    runningSince: runningSince(),
    check,
    restart: async () => {
      benchHost().log('updates', 'Redémarrage sur la mise à jour');
      benchHost().updates.restart();
    },
  };
}
