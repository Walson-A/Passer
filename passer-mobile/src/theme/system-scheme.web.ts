import { useSyncExternalStore } from 'react';
import { useColorScheme, type ColorSchemeName } from 'react-native';

import { benchPreference, subscribeBenchPreferences } from '@/platform/web-bench';

const readScheme = () => benchPreference('scheme');

/** Bench stand-in (see `platform/web-bench.ts`): the bench's appearance switch wins over the browser's. */
export function useSystemScheme(): ColorSchemeName {
  const browser = useColorScheme();
  const chosen = useSyncExternalStore(subscribeBenchPreferences, readScheme, readScheme);
  return chosen === 'light' || chosen === 'dark' ? chosen : browser;
}
