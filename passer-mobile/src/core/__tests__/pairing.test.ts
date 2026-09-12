import { describe, expect, it } from '@jest/globals';

import { parsePairingLink } from '../pairing';

const TOKEN = 'aB3dE5fG7hJ9kL1mN3pQ5rS7tU9vW1xY';
const LINK = `passer://pair?v=1&name=WALSON-LAPTOP&host=walson-laptop.local&ip=192.168.1.24&port=8000&token=${TOKEN}&id=fSNmP3mMLvF1TTAA`;

function payloadOf(link: string) {
  const result = parsePairingLink(link);
  if (!result.ok) throw new Error(`expected a payload, got ${result.error}`);
  return result.payload;
}

function errorOf(link: string) {
  const result = parsePairingLink(link);
  return result.ok ? 'ok' : result.error;
}

describe('parsePairingLink', () => {
  it('reads the payload the desktop QR code encodes', () => {
    expect(payloadOf(LINK)).toEqual({
      version: 1,
      name: 'WALSON-LAPTOP',
      host: 'walson-laptop.local',
      ip: '192.168.1.24',
      port: 8000,
      token: TOKEN,
      id: 'fSNmP3mMLvF1TTAA',
    });
  });

  it('decodes URLSearchParams encoding', () => {
    const link = `passer://pair?v=1&name=Bureau+de+L%C3%A9a&host=bureau.local&ip=10.0.0.2&port=8000&token=${TOKEN}`;
    expect(payloadOf(link).name).toBe('Bureau de Léa');
  });

  it('accepts links without an id from older desktops', () => {
    const link = `passer://pair?v=1&name=PC&host=pc.local&ip=10.0.0.2&port=8000&token=${TOKEN}`;
    expect(payloadOf(link).id).toBeNull();
  });

  it('ignores unknown parameters', () => {
    expect(payloadOf(`${LINK}&theme=dark&future=1`).name).toBe('WALSON-LAPTOP');
  });

  it('tolerates surrounding whitespace', () => {
    expect(payloadOf(`  ${LINK}\n`).host).toBe('walson-laptop.local');
  });

  it('keeps the other address when one is unusable', () => {
    const link = `passer://pair?v=1&name=PC&host=not%20a%20host&ip=10.0.0.2&port=8000&token=${TOKEN}`;
    expect(payloadOf(link)).toMatchObject({ host: null, ip: '10.0.0.2' });
  });

  it('falls back to port 8000 when the port is invalid', () => {
    const link = `passer://pair?v=1&name=PC&host=pc.local&port=99999&token=${TOKEN}`;
    expect(payloadOf(link).port).toBe(8000);
  });

  it('asks for an update when the payload version is newer', () => {
    expect(errorOf(LINK.replace('v=1', 'v=2'))).toBe('newer-version');
  });

  it('rejects anything that is not a pairing link', () => {
    expect(errorOf('')).toBe('not-a-pairing-link');
    expect(errorOf('https://passer.direct')).toBe('not-a-pairing-link');
    expect(errorOf('passer://settings?v=1')).toBe('not-a-pairing-link');
    expect(errorOf(LINK.replace('v=1&', ''))).toBe('not-a-pairing-link');
  });

  it('rejects a link without a usable token', () => {
    expect(errorOf(LINK.replace(`token=${TOKEN}`, 'token=short'))).toBe('missing-token');
  });

  it('rejects a link with no usable address', () => {
    const link = `passer://pair?v=1&name=PC&host=&ip=999.1.1.1&port=8000&token=${TOKEN}`;
    expect(errorOf(link)).toBe('missing-address');
  });
});
