import { benchPreference } from '@/platform/web-bench';

/** Bench stand-in (see `platform/web-bench.ts`): the bench's language switch, else the browser's. */
export function deviceLanguageCode(): string | null {
  return benchPreference('language') ?? navigator.language.slice(0, 2);
}
