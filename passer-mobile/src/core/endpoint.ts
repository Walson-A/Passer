import { PasserError, type PasserErrorKind } from './errors';
import { fetchWithTimeout } from './http';
import type { AddressKind, Endpoint, PairedPc, PingInfo } from './types';

/** `.local` names can take a moment to resolve over Bonjour; raw IPs answer fast or not at all. */
const PING_TIMEOUT_MS: Record<AddressKind, number> = { host: 2500, ip: 1500 };

/** Head start given to the preferred address before the other one is tried too. */
const FALLBACK_DELAY_MS = 350;

export function baseUrl(address: string, port: number): string {
  return `http://${address}:${port}`;
}

/** Unauthenticated liveness probe. Never sends the token. */
export async function ping(url: string, timeoutMs: number, signal?: AbortSignal): Promise<PingInfo> {
  const response = await fetchWithTimeout(`${url}/ping`, { method: 'GET', timeoutMs, signal });
  if (!response.ok) {
    throw new PasserError('not-passer', `HTTP ${response.status} on /ping`, response.status);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new PasserError('not-passer', 'Non-JSON /ping response');
  }
  if (!body || typeof body !== 'object' || (body as { app?: unknown }).app !== 'passer') {
    throw new PasserError('not-passer', 'Not a Passer host');
  }
  return body as PingInfo;
}

/**
 * True when the PC that answered is the one this phone paired with. The
 * stable id decides when both sides have one; otherwise the machine name does,
 * for desktops that predate the id.
 */
export function isSamePc(pc: Pick<PairedPc, 'id' | 'name'>, info: PingInfo): boolean {
  if (pc.id && info.id) return pc.id === info.id;
  const answered = (info.name ?? info.host ?? '').toLowerCase();
  return answered !== '' && answered === pc.name.toLowerCase();
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new PasserError('cancelled', 'Cancelled'));
    });
  });
}

/** When every attempt fails, the most specific reason wins. */
const FAILURE_PRIORITY: PasserErrorKind[] = ['wrong-pc', 'not-passer', 'unreachable', 'cancelled'];

function mostSpecific(errors: unknown[]): unknown {
  for (const kind of FAILURE_PRIORITY) {
    const match = errors.find((error) => error instanceof PasserError && error.kind === kind);
    if (match) return match;
  }
  return errors[0];
}

/**
 * Finds a verified way to reach a paired PC. The preferred address is tried
 * first and the other one joins shortly after, so a stale IP or a network
 * without working `.local` resolution costs a fraction of a second rather than
 * a full timeout. The token is never sent to a PC whose identity doesn't match.
 */
export async function locate(pc: PairedPc, signal?: AbortSignal): Promise<Endpoint> {
  const order: AddressKind[] = pc.preferredAddress === 'ip' ? ['ip', 'host'] : ['host', 'ip'];
  const candidates = order.filter((kind) => pc[kind]);
  if (candidates.length === 0) {
    throw new PasserError('unreachable', 'This pairing has no address');
  }

  const race = new AbortController();
  const stop = () => race.abort();
  signal?.addEventListener('abort', stop);

  const attempts = candidates.map(async (address, index): Promise<Endpoint> => {
    if (index > 0) await wait(FALLBACK_DELAY_MS * index, race.signal);
    const url = baseUrl(pc[address] as string, pc.port);
    const info = await ping(url, PING_TIMEOUT_MS[address], race.signal);
    if (!isSamePc(pc, info)) {
      throw new PasserError('wrong-pc', `The ${address} address answered as another PC`);
    }
    return { baseUrl: url, address, ping: info };
  });

  try {
    return await new Promise<Endpoint>((resolve, reject) => {
      const errors: unknown[] = [];
      attempts.forEach((attempt) => {
        attempt.then(
          (endpoint) => {
            resolve(endpoint);
            race.abort();
          },
          (error) => {
            errors.push(error);
            if (errors.length === attempts.length) {
              reject(signal?.aborted ? new PasserError('cancelled', 'Cancelled') : mostSpecific(errors));
            }
          },
        );
      });
    });
  } finally {
    signal?.removeEventListener('abort', stop);
  }
}
