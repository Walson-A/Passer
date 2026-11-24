import type { ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';
import { SafeAreaFrameContext, SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { benchHost } from './web-bench';

/**
 * Bench stand-in (see `web-bench.ts`). The library's web provider measures the
 * browser's safe areas, which are zero, and would hide exactly the class of bug
 * the bench exists to catch: a title under the Dynamic Island, a button under
 * the home indicator. The phone's insets are provided directly instead.
 */
export function SafeAreaProvider({ children }: { children?: ReactNode }) {
  const { width, height } = useWindowDimensions();
  return (
    <SafeAreaFrameContext.Provider value={{ x: 0, y: 0, width, height }}>
      <SafeAreaInsetsContext.Provider value={benchHost().insets}>{children}</SafeAreaInsetsContext.Provider>
    </SafeAreaFrameContext.Provider>
  );
}
