import type { EdgeInsets } from 'react-native-safe-area-context';

import { BENCH_STORAGE_KEY } from '@/platform/web-bench';

export type RegimeName = 'paired' | 'first-launch' | 'asleep' | 'slow' | 'no-mdns' | 'remote' | 'refused' | 'other-pc';
export type DeviceName = 'iphone-16' | 'iphone-16-pro-max' | 'iphone-se';
export type SchemeChoice = 'dark' | 'light' | 'system';
export type LanguageChoice = 'fr' | 'en';
export type IphoneClipboardChoice = 'link' | 'text' | 'image' | 'empty';
export type PcClipboardChoice = 'text' | 'image' | 'files' | 'empty';

/** Everything the bench's controls set. Kept in localStorage, shared by the desk and the phone it frames. */
export type BenchState = {
  regime: RegimeName;
  device: DeviceName;
  scheme: SchemeChoice;
  language: LanguageChoice;
  iphoneClipboard: IphoneClipboardChoice;
  pcClipboard: PcClipboardChoice;
  /** The route the phone opens on. */
  route: string;
};

export type Choice<T extends string> = { value: T; label: string; help?: string };

export const REGIMES: Choice<RegimeName>[] = [
  { value: 'paired', label: 'Appairé', help: 'le PC répond, historique rempli' },
  { value: 'first-launch', label: 'Premier lancement', help: 'aucun PC, aucun historique' },
  { value: 'asleep', label: 'PC endormi', help: 'plus aucune réponse' },
  { value: 'slow', label: 'Lent', help: 'réponses lentes, progression visible' },
  { value: 'no-mdns', label: 'Sans .local', help: 'seule l’adresse IP répond' },
  { value: 'remote', label: 'À distance', help: 'via Tailscale, seul le nom du PC répond' },
  { value: 'refused', label: 'Jeton refusé', help: 'le PC a changé de jeton' },
  { value: 'other-pc', label: 'Autre PC', help: 'un autre PC a pris son adresse' },
];

export type Device = {
  label: string;
  width: number;
  height: number;
  insets: EdgeInsets;
  island: boolean;
  cornerRadius: number;
};

/** Sizes in points, safe areas as iOS reports them in portrait. */
export const DEVICES: Record<DeviceName, Device> = {
  'iphone-16': {
    label: 'iPhone 16',
    width: 393,
    height: 852,
    insets: { top: 59, right: 0, bottom: 34, left: 0 },
    island: true,
    cornerRadius: 55,
  },
  'iphone-16-pro-max': {
    label: 'iPhone 16 Pro Max',
    width: 440,
    height: 956,
    insets: { top: 62, right: 0, bottom: 34, left: 0 },
    island: true,
    cornerRadius: 62,
  },
  'iphone-se': {
    label: 'iPhone SE',
    width: 375,
    height: 667,
    insets: { top: 20, right: 0, bottom: 0, left: 0 },
    island: false,
    cornerRadius: 0,
  },
};

export const DEVICE_CHOICES: Choice<DeviceName>[] = (Object.keys(DEVICES) as DeviceName[]).map((value) => ({
  value,
  label: DEVICES[value].label,
}));

export const SCHEMES: Choice<SchemeChoice>[] = [
  { value: 'dark', label: 'Sombre' },
  { value: 'light', label: 'Clair' },
  { value: 'system', label: 'Navigateur' },
];

export const LANGUAGES: Choice<LanguageChoice>[] = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
];

export const IPHONE_CLIPBOARDS: Choice<IphoneClipboardChoice>[] = [
  { value: 'link', label: 'Lien' },
  { value: 'text', label: 'Texte' },
  { value: 'image', label: 'Image' },
  { value: 'empty', label: 'Vide' },
];

export const PC_CLIPBOARDS: Choice<PcClipboardChoice>[] = [
  { value: 'text', label: 'Texte' },
  { value: 'image', label: 'Image' },
  { value: 'files', label: 'Fichiers' },
  { value: 'empty', label: 'Vide' },
];

export const DEFAULT_STATE: BenchState = {
  regime: 'paired',
  device: 'iphone-16',
  scheme: 'dark',
  language: 'fr',
  iphoneClipboard: 'link',
  pcClipboard: 'text',
  route: '/',
};

function pick<T extends string>(choices: Choice<T>[], value: unknown, fallback: T): T {
  return choices.some((choice) => choice.value === value) ? (value as T) : fallback;
}

export function sanitizeState(raw: Partial<Record<keyof BenchState, unknown>>): BenchState {
  return {
    regime: pick(REGIMES, raw.regime, DEFAULT_STATE.regime),
    device: pick(DEVICE_CHOICES, raw.device, DEFAULT_STATE.device),
    scheme: pick(SCHEMES, raw.scheme, DEFAULT_STATE.scheme),
    language: pick(LANGUAGES, raw.language, DEFAULT_STATE.language),
    iphoneClipboard: pick(IPHONE_CLIPBOARDS, raw.iphoneClipboard, DEFAULT_STATE.iphoneClipboard),
    pcClipboard: pick(PC_CLIPBOARDS, raw.pcClipboard, DEFAULT_STATE.pcClipboard),
    route: typeof raw.route === 'string' && raw.route.startsWith('/') ? raw.route : DEFAULT_STATE.route,
  };
}

export function loadState(): BenchState {
  try {
    const raw = window.localStorage.getItem(BENCH_STORAGE_KEY);
    return sanitizeState(raw ? (JSON.parse(raw) as Partial<Record<keyof BenchState, unknown>>) : {});
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveState(state: BenchState): void {
  try {
    window.localStorage.setItem(BENCH_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // A private window can refuse storage; the bench then keeps its defaults.
  }
}
