import type { PairedPc } from '@/core/types';
import type { Destination, Direction, HistoryKind } from '@/state/history';

import type { PhotoDestination } from './storage';

/** Bench stand-in (see `web-bench.ts`): the browser has no App Group and no extensions to share with. */
export function shareWithExtensions(_patch: { pcs?: PairedPc[]; photoDestination?: PhotoDestination | null }): void {}

export type OutboxEntry = {
  pcKey: string;
  direction: Direction;
  kind: HistoryKind;
  destination: Destination;
  title: string;
  size: number | null;
  at: number;
};

export function takeOutbox(): OutboxEntry[] {
  return [];
}
