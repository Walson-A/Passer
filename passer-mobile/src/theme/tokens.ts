/**
 * Design tokens for the Conduit home and every screen built on its vocabulary.
 * Values come from the approved mockups ("Passer Mobile Screens") and the
 * desktop app's palette. The light theme is its own pass, where the dark
 * theme's light becomes ink; it is not an inversion.
 */

export type SchemeName = 'dark' | 'light';

export type Palette = {
  ground: string;
  text: { primary: string; secondary: string; tertiary: string; label: string };
  surface: { card: string; raised: string; capsule: string; sheet: string; well: string };
  border: { subtle: string; raised: string; glass: string; dashed: string };
  icon: { normal: string; dim: string };
  accent: string;
  status: {
    ok: string;
    okWash: string;
    okWashSoft: string;
    okBorder: string;
    warn: string;
    warnWash: string;
    warnWashSoft: string;
    warnBorder: string;
    error: string;
    errorWash: string;
  };
  destination: { clipboard: string; folder: string; folderWash: string };
  /** Colours handed to the native iOS paste control; they must stay solid and high-contrast. */
  paste: { background: string; foreground: string };
  conduit: {
    line: readonly [string, string, string];
    lineIdle: string;
    lineGlow: string | null;
    branchActive: string;
    branchIdle: string;
    fill: readonly [string, string];
    fillGlow: string;
    band: string;
  };
  shadow: { capsule: string; tile: string; okGlow: string };
  scrim: string;
  grabber: string;
  toggleOff: string;
};

export const palettes: Record<SchemeName, Palette> = {
  dark: {
    ground: '#0F0F0F',
    text: {
      primary: 'rgba(255,255,255,0.92)',
      secondary: 'rgba(255,255,255,0.58)',
      tertiary: 'rgba(255,255,255,0.40)',
      label: 'rgba(255,255,255,0.40)',
    },
    surface: {
      card: 'rgba(255,255,255,0.035)',
      raised: 'rgba(255,255,255,0.06)',
      capsule: 'rgba(28,28,28,0.96)',
      sheet: '#171717',
      well: 'rgba(0,0,0,0.30)',
    },
    border: {
      subtle: 'rgba(255,255,255,0.07)',
      raised: 'rgba(255,255,255,0.10)',
      glass: 'rgba(255,255,255,0.08)',
      dashed: 'rgba(255,255,255,0.20)',
    },
    icon: { normal: 'rgba(255,255,255,0.74)', dim: 'rgba(255,255,255,0.40)' },
    accent: '#60A5FA',
    status: {
      ok: '#34D399',
      okWash: 'rgba(52,211,153,0.14)',
      okWashSoft: 'rgba(52,211,153,0.05)',
      okBorder: 'rgba(52,211,153,0.40)',
      warn: '#FBBF24',
      warnWash: 'rgba(251,191,36,0.14)',
      warnWashSoft: 'rgba(251,191,36,0.05)',
      warnBorder: 'rgba(251,191,36,0.45)',
      error: '#F87171',
      errorWash: 'rgba(248,113,113,0.14)',
    },
    destination: {
      clipboard: 'rgba(52,211,153,0.85)',
      folder: 'rgba(251,146,60,0.85)',
      folderWash: 'rgba(251,146,60,0.14)',
    },
    paste: { background: '#FFFFFF', foreground: '#0F0F0F' },
    conduit: {
      line: ['rgba(243,251,253,0.92)', 'rgba(243,251,253,0.38)', 'rgba(243,251,253,0.72)'],
      lineIdle: 'rgba(255,255,255,0.13)',
      lineGlow: '0 0 10px rgba(191,221,232,0.5)',
      branchActive: '#F3FBFD',
      branchIdle: 'rgba(255,255,255,0.16)',
      fill: ['#F3FBFD', 'rgba(243,251,253,0.7)'],
      fillGlow: '0 0 10px rgba(191,221,232,0.6)',
      band: 'rgba(211,228,234,0.07)',
    },
    shadow: {
      capsule: '0 12px 32px rgba(0,0,0,0.5)',
      tile: '0 12px 30px rgba(0,0,0,0.5)',
      okGlow: '0 0 8px rgba(52,211,153,0.6)',
    },
    scrim: 'rgba(0,0,0,0.55)',
    grabber: 'rgba(255,255,255,0.22)',
    toggleOff: 'rgba(255,255,255,0.16)',
  },
  light: {
    ground: '#F3F3F0',
    text: {
      primary: '#151514',
      secondary: 'rgba(21,21,20,0.62)',
      tertiary: 'rgba(21,21,20,0.46)',
      label: 'rgba(21,21,20,0.46)',
    },
    surface: {
      card: '#FFFFFF',
      raised: '#FFFFFF',
      capsule: '#FFFFFF',
      sheet: '#F7F7F5',
      well: 'rgba(21,21,20,0.045)',
    },
    border: {
      subtle: 'rgba(21,21,20,0.07)',
      raised: 'rgba(21,21,20,0.10)',
      glass: 'rgba(21,21,20,0.07)',
      dashed: 'rgba(21,21,20,0.20)',
    },
    icon: { normal: 'rgba(21,21,20,0.72)', dim: 'rgba(21,21,20,0.42)' },
    accent: '#2563EB',
    status: {
      ok: '#059669',
      okWash: 'rgba(5,150,105,0.10)',
      okWashSoft: 'rgba(5,150,105,0.05)',
      okBorder: 'rgba(5,150,105,0.38)',
      warn: '#B45309',
      warnWash: 'rgba(217,119,6,0.10)',
      warnWashSoft: 'rgba(217,119,6,0.05)',
      warnBorder: 'rgba(217,119,6,0.42)',
      error: '#DC2626',
      errorWash: 'rgba(220,38,38,0.08)',
    },
    destination: { clipboard: '#059669', folder: '#EA580C', folderWash: 'rgba(234,88,12,0.10)' },
    paste: { background: '#151514', foreground: '#FFFFFF' },
    conduit: {
      line: ['rgba(21,21,20,0.80)', 'rgba(21,21,20,0.26)', 'rgba(21,21,20,0.55)'],
      lineIdle: 'rgba(21,21,20,0.13)',
      lineGlow: null,
      branchActive: 'rgba(21,21,20,0.78)',
      branchIdle: 'rgba(21,21,20,0.16)',
      fill: ['#2563EB', 'rgba(37,99,235,0.65)'],
      fillGlow: '0 0 8px rgba(37,99,235,0.28)',
      band: 'rgba(37,99,235,0.05)',
    },
    shadow: {
      capsule: '0 10px 28px rgba(21,21,20,0.10)',
      tile: '0 10px 24px rgba(21,21,20,0.10)',
      okGlow: '0 0 0 3px rgba(5,150,105,0.16)',
    },
    scrim: 'rgba(21,21,20,0.28)',
    grabber: 'rgba(21,21,20,0.18)',
    toggleOff: 'rgba(21,21,20,0.14)',
  },
};

export const radius = {
  chip: 8,
  button: 16,
  socket: 18,
  capsule: 20,
  card: 22,
  sheet: 32,
  pill: 999,
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 } as const;

/** Letter-spacing in points, converted from the mockups' em values. */
export const type = {
  pcName: { fontSize: 22, lineHeight: 28, fontWeight: '600', letterSpacing: -0.44 },
  title: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.17 },
  body: { fontSize: 14, lineHeight: 19, fontWeight: '500', letterSpacing: 0 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400', letterSpacing: 0 },
  meta: { fontSize: 11, lineHeight: 14, fontWeight: '400', letterSpacing: 0 },
  label: { fontSize: 10, lineHeight: 13, fontWeight: '900', letterSpacing: 2.2 },
} as const;

/**
 * Motion vocabulary shared with the desktop. The travel curve carries weight;
 * out-expo settles arrivals. With Reduce Motion on, travel becomes a fade.
 */
export const motion = {
  easing: {
    spring: [0.175, 0.885, 0.32, 1.275],
    outExpo: [0.16, 1, 0.3, 1],
    travel: [0.65, 0, 0.35, 1],
  },
  duration: { reveal: 220, travel: 720, land: 420, fade: 180 },
} as const;
