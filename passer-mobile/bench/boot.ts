import { loadState, sanitizeState, saveState, type BenchState } from './state';

/**
 * Runs first in the web build (see `index.web.ts`). The app reads its language
 * as it loads, so choices passed in the URL must reach storage before it does.
 *
 * `?bench=phone` (or a page embedded in the desk, or a window as narrow as a
 * phone) renders the phone alone; anything else renders the desk around it.
 */

const params = new URLSearchParams(window.location.search);
const forced = params.get('bench');

export const benchMode: 'desk' | 'phone' =
  forced === 'phone' || (forced !== 'desk' && (window.self !== window.top || window.innerWidth <= 520)) ? 'phone' : 'desk';

const OVERRIDABLE: (keyof BenchState)[] = ['regime', 'device', 'scheme', 'language', 'iphoneClipboard', 'pcClipboard'];

const overrides: Partial<Record<keyof BenchState, string>> = {};
for (const key of OVERRIDABLE) {
  const value = params.get(key);
  if (value !== null) overrides[key] = value;
}
if (Object.keys(overrides).length > 0) saveState(sanitizeState({ ...loadState(), ...overrides }));

/** A modal route to present once the app is mounted: its stack needs Home underneath. */
export const openOnMount = params.get('open');

if (benchMode === 'phone') {
  // The router reads the URL: it must only see the app's own route and parameters.
  for (const key of [...OVERRIDABLE, 'bench', 'open']) params.delete(key);
  const query = params.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
}
