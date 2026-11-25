import type { EdgeInsets } from 'react-native-safe-area-context';

import { BENCH_STORAGE_KEY, type BenchUpdateScenario } from '@/platform/web-bench';

export type RegimeName =
  | 'paired'
  | 'manager'
  | 'direct'
  | 'first-launch'
  | 'alone'
  | 'asleep'
  | 'refuses'
  | 'old-pc'
  | 'broken'
  | 'slow'
  | 'no-mdns'
  | 'remote'
  | 'refused'
  | 'other-pc';
export type LookChoice = 'ios' | 'android';
export type FilesChoice = 'small' | 'large';
export type TextChoice = 'default' | 'large' | 'huge';
export type UpdateChoice = BenchUpdateScenario;
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
  /** What the update server holds, for Settings › Updates. */
  update: UpdateChoice;
  /** Which platform's conventions the screens follow. */
  look: LookChoice;
  /** What the document picker hands over: a file one call carries, or ones over 700 KB. */
  files: FilesChoice;
  /** Simulated Dynamic Type. */
  text: TextChoice;
  /** The route the phone opens on. */
  route: string;
};

export type Choice<T extends string> = { value: T; label: string; help?: string };

export const REGIMES: Choice<RegimeName>[] = [
  { value: 'paired', label: 'Groupe', help: 'le PC et un iPad ; le PC répond' },
  { value: 'manager', label: 'Gère les appareils', help: 'ce téléphone peut ajouter et retirer' },
  { value: 'direct', label: 'Connexion directe', help: 'groupe + appairage HTTP (Raccourcis, gros fichiers)' },
  { value: 'first-launch', label: 'Premier lancement', help: 'aucun groupe, aucun historique' },
  { value: 'alone', label: 'Seul', help: 'un groupe sans autre appareil' },
  { value: 'asleep', label: 'PC endormi', help: 'le PC ne répond plus' },
  { value: 'refuses', label: 'Le PC refuse', help: 'son utilisateur dit non aux lectures' },
  { value: 'old-pc', label: 'Ancien bureau', help: 'le PC n’offre pas file.drop : un appel par fichier, 700 Ko au plus' },
  { value: 'broken', label: 'Erreur au chargement', help: 'le noyau ne s’ouvre pas' },
  { value: 'slow', label: 'Lent', help: 'connexion directe lente, progression visible' },
  { value: 'no-mdns', label: 'Sans .local', help: 'connexion directe : seule l’adresse IP répond' },
  { value: 'remote', label: 'À distance', help: 'connexion directe via Tailscale' },
  { value: 'refused', label: 'Jeton refusé', help: 'connexion directe : le PC a changé de jeton' },
  { value: 'other-pc', label: 'Autre PC', help: 'connexion directe : un autre PC a pris son adresse' },
];

/** Regimes where the phone also has the direct (HTTP) pairing, for Shortcuts and files over 700 KB. */
export const DIRECT_REGIMES: RegimeName[] = ['direct', 'slow', 'no-mdns', 'remote', 'refused', 'other-pc'];

export const LOOKS: Choice<LookChoice>[] = [
  { value: 'ios', label: 'iPhone' },
  { value: 'android', label: 'Android' },
];

export const TEXT_SIZES: Choice<TextChoice>[] = [
  { value: 'default', label: 'Par défaut' },
  { value: 'large', label: 'Très grand' },
  { value: 'huge', label: 'Accessibilité' },
];

export const FILE_CHOICES: Choice<FilesChoice>[] = [
  { value: 'small', label: 'Petit (180 Ko)' },
  { value: 'large', label: 'Gros (> 700 Ko)' },
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

export const UPDATES: Choice<UpdateChoice>[] = [
  { value: 'none', label: 'Rien de neuf' },
  { value: 'available', label: 'Publiée' },
  { value: 'downloaded', label: 'Déjà téléchargée' },
  { value: 'offline', label: 'Serveur muet' },
];

export const DEFAULT_STATE: BenchState = {
  regime: 'paired',
  device: 'iphone-16',
  scheme: 'dark',
  language: 'fr',
  iphoneClipboard: 'link',
  pcClipboard: 'text',
  update: 'none',
  look: 'ios',
  files: 'small',
  text: 'default',
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
    update: pick(UPDATES, raw.update, DEFAULT_STATE.update),
    look: pick(LOOKS, raw.look, DEFAULT_STATE.look),
    files: pick(FILE_CHOICES, raw.files, DEFAULT_STATE.files),
    text: pick(TEXT_SIZES, raw.text, DEFAULT_STATE.text),
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
