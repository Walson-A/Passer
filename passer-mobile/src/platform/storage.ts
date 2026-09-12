import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PairedPc } from '@/core/types';

/** Non-secret app state. Tokens are stored separately, in `secrets.ts`. */
const KEYS = {
  pcs: 'passer.pcs.v1',
  settings: 'passer.settings.v1',
  history: 'passer.history.v1',
} as const;

export type PhotoDestination = 'clipboard' | 'passboard';

export type Settings = {
  haptics: boolean;
  /** `null` asks each time. */
  photoDestination: PhotoDestination | null;
};

export const DEFAULT_SETTINGS: Settings = { haptics: true, photoDestination: null };

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): Promise<void> {
  return AsyncStorage.setItem(key, JSON.stringify(value));
}

export const storage = {
  loadPcs: () => readJson<PairedPc[]>(KEYS.pcs, []),
  savePcs: (pcs: PairedPc[]) => writeJson(KEYS.pcs, pcs),

  loadSettings: async (): Promise<Settings> => ({
    ...DEFAULT_SETTINGS,
    ...(await readJson<Partial<Settings>>(KEYS.settings, {})),
  }),
  saveSettings: (settings: Settings) => writeJson(KEYS.settings, settings),

  loadHistory: <T>() => readJson<T[]>(KEYS.history, []),
  saveHistory: <T>(items: T[]) => writeJson(KEYS.history, items),
};
