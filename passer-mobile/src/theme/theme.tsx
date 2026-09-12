import { createContext, useContext, type ReactNode } from 'react';

import { useSystemScheme } from './system-scheme';
import { palettes, type Palette, type SchemeName } from './tokens';

type Theme = { scheme: SchemeName; colors: Palette };

const ThemeContext = createContext<Theme>({ scheme: 'dark', colors: palettes.dark });

/** Follows the system appearance. Passer is dark-first, so an unknown scheme renders dark. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme: SchemeName = useSystemScheme() === 'light' ? 'light' : 'dark';
  return (
    <ThemeContext.Provider value={{ scheme, colors: palettes[scheme] }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
