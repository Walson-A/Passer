import type { PairingPayload } from './types';

/** Highest payload version this build understands. */
export const PAIRING_VERSION = 1;

const DEFAULT_PORT = 8000;

export type PairingParseError =
  | 'not-a-pairing-link'
  | 'newer-version'
  | 'missing-token'
  | 'missing-address';

export type PairingParseResult =
  | { ok: true; payload: PairingPayload }
  | { ok: false; error: PairingParseError };

const PREFIX = /^passer:\/\/pair\/?\?/i;
const TOKEN = /^[A-Za-z0-9_-]{16,256}$/;
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const HOSTNAME =
  /^(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.?$/;
const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

/** Splits a query string the way `URLSearchParams` encodes it, where `+` is a space. */
function readQuery(query: string): Map<string, string> {
  const params = new Map<string, string>();
  for (const part of query.split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    const rawKey = eq === -1 ? part : part.slice(0, eq);
    const rawValue = eq === -1 ? '' : part.slice(eq + 1);
    try {
      const key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
      if (!params.has(key)) {
        params.set(key, decodeURIComponent(rawValue.replace(/\+/g, ' ')));
      }
    } catch {
      // One malformed escape must not reject the other parameters.
    }
  }
  return params;
}

/**
 * Parses the link a desktop pairing QR code encodes:
 * `passer://pair?v=1&name=&host=&ip=&port=&token=&id=`.
 *
 * Unknown parameters are ignored so the desktop can add fields without bumping
 * `v`. Hermes has no complete `URL` implementation for custom schemes, hence
 * the manual parsing.
 */
export function parsePairingLink(raw: string): PairingParseResult {
  const text = raw.trim();
  const prefix = PREFIX.exec(text);
  if (!prefix) return { ok: false, error: 'not-a-pairing-link' };

  const params = readQuery(text.slice(prefix[0].length).split('#')[0]);

  const version = Number.parseInt(params.get('v') ?? '', 10);
  if (!Number.isFinite(version) || version < 1) return { ok: false, error: 'not-a-pairing-link' };
  if (version > PAIRING_VERSION) return { ok: false, error: 'newer-version' };

  const token = params.get('token') ?? '';
  if (!TOKEN.test(token)) return { ok: false, error: 'missing-token' };

  const hostParam = params.get('host')?.trim() ?? '';
  const ipParam = params.get('ip')?.trim() ?? '';
  const host = HOSTNAME.test(hostParam) ? hostParam.replace(/\.$/, '') : null;
  const ip = IPV4.test(ipParam) ? ipParam : null;
  if (!host && !ip) return { ok: false, error: 'missing-address' };

  const port = Number.parseInt(params.get('port') ?? '', 10);
  const id = params.get('id') ?? '';

  return {
    ok: true,
    payload: {
      version,
      name: params.get('name')?.trim() || host || ip || '',
      host,
      ip,
      port: port >= 1 && port <= 65535 ? port : DEFAULT_PORT,
      token,
      id: ID.test(id) ? id : null,
    },
  };
}
