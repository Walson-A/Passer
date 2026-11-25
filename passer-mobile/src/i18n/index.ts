import { deviceLanguageCode } from './device-language';
import { en, fr } from './strings';

export type Language = 'en' | 'fr';

function detectLanguage(): Language {
  return deviceLanguageCode() === 'fr' ? 'fr' : 'en';
}

/** iOS relaunches the app when the system language changes, so reading it once is enough. */
export const language: Language = detectLanguage();

export const t: typeof en = language === 'fr' ? (fr as typeof en) : en;

/**
 * Fills `{placeholder}` markers. Unknown markers are left visible so they get noticed.
 *
 * A PC name never breaks across lines: a Windows name such as `DESKTOP-4F7KQ2M`
 * would otherwise split at its hyphen, so `{name}` gets non-breaking hyphens.
 */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (marker, key: string) => {
    if (!(key in values)) return marker;
    const value = String(values[key]);
    return key === 'name' ? value.replace(/-/g, '‑') : value;
  });
}
