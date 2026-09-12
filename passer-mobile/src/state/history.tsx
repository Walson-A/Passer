import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { takeOutbox } from '@/platform/shared-state';
import { storage } from '@/platform/storage';

export type Direction = 'sent' | 'received';

export type HistoryKind = 'text' | 'image' | 'file' | 'files';

/** Where a transfer ended up. The two PC destinations are the home screen's two sockets. */
export type Destination = 'pc-clipboard' | 'passboard' | 'iphone-clipboard' | 'photos' | 'files';

export type HistoryItem = {
  id: string;
  pcKey: string;
  direction: Direction;
  kind: HistoryKind;
  destination: Destination;
  /** Text preview or file name. Stays on this iPhone; never leaves the device. */
  title: string;
  size: number | null;
  at: number;
};

const MAX_ITEMS = 50;
const PREVIEW_LENGTH = 160;

type HistoryValue = {
  items: HistoryItem[];
  record: (entry: Omit<HistoryItem, 'id' | 'at'>) => HistoryItem;
  clear: () => void;
};

const HistoryContext = createContext<HistoryValue | null>(null);

export function HistoryProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void storage.loadHistory<HistoryItem>().then((stored) => {
      if (!active) return;
      setItems(stored);
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (ready) void storage.saveHistory(items);
  }, [items, ready]);

  // Transfers made from the share sheet or a Shortcut join the history when the app comes to the front.
  useEffect(() => {
    if (!ready) return;
    const merge = () => {
      const entries = takeOutbox();
      if (entries.length === 0) return;
      setItems((current) =>
        [
          ...entries.map((entry) => ({
            ...entry,
            title: entry.title.slice(0, PREVIEW_LENGTH),
            id: `${entry.at.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          })),
          ...current,
        ]
          .sort((a, b) => b.at - a.at)
          .slice(0, MAX_ITEMS),
      );
    };
    merge();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') merge();
    });
    return () => subscription.remove();
  }, [ready]);

  const record = (entry: Omit<HistoryItem, 'id' | 'at'>): HistoryItem => {
    const at = Date.now();
    const item: HistoryItem = {
      ...entry,
      title: entry.title.slice(0, PREVIEW_LENGTH),
      id: `${at.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      at,
    };
    setItems((current) => [item, ...current].slice(0, MAX_ITEMS));
    return item;
  };

  const clear = () => setItems([]);

  return <HistoryContext.Provider value={{ items, record, clear }}>{children}</HistoryContext.Provider>;
}

export function useHistory(): HistoryValue {
  const value = useContext(HistoryContext);
  if (!value) throw new Error('useHistory must be used inside HistoryProvider');
  return value;
}

/** The latest item for one PC and destination, as shown in the home screen sockets. */
export function latest(items: HistoryItem[], pcKey: string, destination: Destination): HistoryItem | null {
  return items.find((item) => item.pcKey === pcKey && item.destination === destination) ?? null;
}
