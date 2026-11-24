/**
 * How a device of the group is drawn and named, shared with the desktop
 * (`passer-app/src/components/deviceUi.tsx`) so a device looks the same on both.
 * No React Native import: unit-tested.
 */

export type DeviceKind = 'phone' | 'tablet' | 'laptop' | 'desktop';

/**
 * passer-core does not send a device's kind yet, so it is guessed from the name, as on the
 * desktop. The name is always shown next to the drawing, so a wrong guess costs nothing.
 */
export function kindOf(name: string, os?: string): DeviceKind {
  const n = name.toLowerCase();
  if (os === 'ios') return /ipad/.test(n) ? 'tablet' : 'phone';
  if (os === 'android') return /tab/.test(n) ? 'tablet' : 'phone';
  if (!os) {
    if (/iphone|android|phone|pixel|galaxy|téléphone|mobile/.test(n)) return 'phone';
    if (/ipad|tablet|tablette/.test(n)) return 'tablet';
  }
  return /macbook|book|laptop|portable|surface|-hp|thinkpad|xps/.test(n) ? 'laptop' : 'desktop';
}

/** The desktop's six wallpapers, in the same order. */
export const SCREENS: readonly (readonly [string, string])[] = [
  ['#3b82f6', '#a855f7'],
  ['#0ea5e9', '#1e3a8a'],
  ['#f97316', '#db2777'],
  ['#10b981', '#0f766e'],
  ['#eab308', '#dc2626'],
  ['#6366f1', '#06b6d4'],
];

/** A wallpaper per device, derived from its id exactly as the desktop does, so both apps agree. */
export function screenFor(id: string): readonly [string, string] {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return SCREENS[h % SCREENS.length];
}

/** The six digits to compare, as two groups of three, the way people read them aloud. */
export function sasGroups(sas: string): [string, string] {
  const digits = sas.replace(/\D/g, '').slice(0, 6);
  return [digits.slice(0, 3), digits.slice(3)];
}

/** `0:42` for a countdown. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * What a member is: what it said itself (passer-core `members()`, from mobile-v0.2.0), or a
 * guess from its name for a member on an older core.
 */
export function memberKind(member: { name: string; kind?: string | null; os?: string | null }): DeviceKind {
  const said = member.kind;
  if (said === 'phone' || said === 'tablet' || said === 'laptop' || said === 'desktop') return said;
  return kindOf(member.name, member.os ?? undefined);
}

/** Minutes since a member last answered, from passer-core's `answeredAt` (Unix seconds). */
export function minutesSince(answeredAt: number | null | undefined, now: number = Date.now()): number | null {
  if (answeredAt === null || answeredAt === undefined) return null;
  return Math.max(0, Math.floor((now / 1000 - answeredAt) / 60));
}
