import { describe, expect, it } from '@jest/globals';

import { clock, kindOf, sasGroups, screenFor, SCREENS } from '../devices';

describe('kindOf', () => {
  it.each([
    ['iPhone de Walson', undefined, 'phone'],
    ['Pixel 9', undefined, 'phone'],
    ['iPad de Walson', undefined, 'tablet'],
    ['WALSON-HP', undefined, 'laptop'],
    ['MacBook Air', undefined, 'laptop'],
    ['PC du salon', undefined, 'desktop'],
    ['Walson', 'ios', 'phone'],
    ['iPad', 'ios', 'tablet'],
  ])('%s (%s) → %s', (name, os, kind) => {
    expect(kindOf(name, os)).toBe(kind);
  });
});

describe('screenFor', () => {
  it('is stable and picks one of the desktop wallpapers', () => {
    const id = '9cfff8cf59'.padEnd(64, '0');
    expect(screenFor(id)).toBe(screenFor(id));
    expect(SCREENS).toContain(screenFor(id));
  });

  it('matches the desktop formula', () => {
    // passer-app/src/components/deviceUi.tsx, written out.
    const desktop = (id: string) => {
      let h = 0;
      for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
      return h % 6;
    };
    for (const id of ['a', 'abcdef0123456789'.repeat(4), '842ffab39e'.padEnd(64, '7')]) {
      expect(screenFor(id)).toBe(SCREENS[desktop(id)]);
    }
  });
});

describe('sasGroups', () => {
  it('splits six digits in two groups of three', () => {
    expect(sasGroups('696842')).toEqual(['696', '842']);
    expect(sasGroups('696 842')).toEqual(['696', '842']);
  });
});

describe('clock', () => {
  it('formats a countdown', () => {
    expect(clock(600)).toBe('10:00');
    expect(clock(42.2)).toBe('0:43');
    expect(clock(-3)).toBe('0:00');
  });
});
