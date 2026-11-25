import { getLocales } from 'expo-localization';

/** The device language code, such as `fr`. The bench picks it from its controls (`device-language.web.ts`). */
export function deviceLanguageCode(): string | null {
  return getLocales()[0]?.languageCode ?? null;
}
