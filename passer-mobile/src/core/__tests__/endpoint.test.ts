import { describe, expect, it } from '@jest/globals';

import { isSamePc, machineName } from '../endpoint';

describe('machineName', () => {
  it('drops .local from the advertised host', () => {
    expect(machineName({ host: 'desktop-4f7kq2m.local' })).toBe('desktop-4f7kq2m');
  });

  it('ignores the case and a trailing dot', () => {
    expect(machineName({ host: 'bureau-salon.LOCAL.' })).toBe('bureau-salon');
  });

  it('has nothing to offer without a .local host', () => {
    expect(machineName({ host: null })).toBeNull();
    expect(machineName({ host: '192.168.1.42' })).toBeNull();
  });
});

describe('isSamePc', () => {
  const pc = { id: 'h3K9sQ2mX7pL4vRt', name: 'DESKTOP-4F7KQ2M' };

  it('trusts the stable id when both sides have one', () => {
    expect(isSamePc(pc, { app: 'passer', version: '1.0.0', host: 'DESKTOP-4F7KQ2M', id: 'h3K9sQ2mX7pL4vRt' })).toBe(true);
    expect(isSamePc(pc, { app: 'passer', version: '1.0.0', host: 'DESKTOP-4F7KQ2M', id: 'Zp8Lw2Qe5Rt7Yu1B' })).toBe(false);
  });

  it('falls back to the machine name for desktops without an id', () => {
    expect(isSamePc(pc, { app: 'passer', version: '0.9.0', host: 'desktop-4f7kq2m' })).toBe(true);
  });
});
