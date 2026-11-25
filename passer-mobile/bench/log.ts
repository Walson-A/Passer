import type { BenchLogKind } from '@/platform/web-bench';

export type BenchLogEntry = { at: number; kind: BenchLogKind; message: string };

export const LOG_MESSAGE_SOURCE = 'passer-bench';

/** The phone runs in the desk's iframe, which shows its events. On its own, it logs to the console. */
export function postLog(kind: BenchLogKind, message: string): void {
  const entry: BenchLogEntry = { at: Date.now(), kind, message };
  if (window.parent !== window) {
    window.parent.postMessage({ source: LOG_MESSAGE_SOURCE, entry }, window.location.origin);
  } else {
    console.info(`[bench] ${kind}: ${message}`);
  }
}
