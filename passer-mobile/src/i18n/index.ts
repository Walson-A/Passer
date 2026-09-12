import { getLocales } from 'expo-localization';

import { en, fr } from './strings';

export type Language = 'en' | 'fr';

function detectLanguage(): Language {
  const code = getLocales()[0]?.languageCode ?? 'en';
  return code === 'fr' ? 'fr' : 'en';
}

/** iOS relaunches the app when the system language changes, so reading it once is enough. */
export const language: Language = detectLanguage();

export const t: typeof en = language === 'fr' ? (fr as typeof en) : en;

/** Fills `{placeholder}` markers. Unknown markers are left visible so they get noticed. */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (marker, key: string) =>
    key in values ? String(values[key]) : marker,
  );
}
