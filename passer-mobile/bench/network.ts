import type { FileTransport } from '@/core/client';
import { PasserError } from '@/core/errors';
import type { AddressKind } from '@/core/types';
import type { BenchLogKind } from '@/platform/web-bench';

import { handle, type FakePc, type FakeRequest, type FakeResponse } from './fake-pc';
import { OTHER_PC, PC, ROTATED_TOKEN, type PcClipboard } from './fixtures';
import type { RegimeName } from './state';

/** How the network between the phone and the PC behaves in each regime. */
type Behaviour = {
  /** Which of the PC's two addresses answer at all. */
  answers: Record<AddressKind, boolean>;
  pingLatencyMs: number;
  latencyMs: number;
  bytesPerSecond: number;
  identity: 'paired' | 'other';
  tokenAccepted: boolean;
};

const QUICK = { pingLatencyMs: 35, latencyMs: 110, bytesPerSecond: 11_000_000 };
/** At home the bare machine name usually doesn't resolve: that takes Tailscale's MagicDNS or an obliging router. */
const HOME = { host: true, ip: true, name: false };
const SILENT = { host: false, ip: false, name: false };

const BEHAVIOUR: Record<RegimeName, Behaviour> = {
  paired: { answers: HOME, ...QUICK, identity: 'paired', tokenAccepted: true },
  'first-launch': { answers: HOME, ...QUICK, identity: 'paired', tokenAccepted: true },
  asleep: { answers: SILENT, ...QUICK, identity: 'paired', tokenAccepted: true },
  // Pings stay under the app's 2.5 s timeout: any slower and the PC reads as asleep, not slow.
  slow: {
    answers: HOME,
    pingLatencyMs: 900,
    latencyMs: 1_500,
    bytesPerSecond: 450_000,
    identity: 'paired',
    tokenAccepted: true,
  },
  'no-mdns': { answers: { host: false, ip: true, name: false }, ...QUICK, identity: 'paired', tokenAccepted: true },
  // Away from home over Tailscale: only the machine name resolves, through a relay.
  remote: {
    answers: { host: false, ip: false, name: true },
    pingLatencyMs: 180,
    latencyMs: 260,
    bytesPerSecond: 1_500_000,
    identity: 'paired',
    tokenAccepted: true,
  },
  refused: { answers: HOME, ...QUICK, identity: 'paired', tokenAccepted: false },
  // The paired PC is off, and another Passer PC was given its IP address.
  'other-pc': { answers: { host: false, ip: true, name: false }, ...QUICK, identity: 'other', tokenAccepted: true },
};

const TICK_MS = 100;

function abortError(): DOMException {
  return new DOMException('The operation was aborted.', 'AbortError');
}

function sleep(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** An address nobody answers: the request only ends when the app gives up on it. */
function silence(signal?: AbortSignal | null): Promise<never> {
  return new Promise((_, reject) => {
    if (!signal) return;
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    signal.addEventListener('abort', () => reject(abortError()), { once: true });
  });
}

function headerRecord(headers?: HeadersInit): Record<string, string> {
  const record: Record<string, string> = {};
  new Headers(headers).forEach((value, name) => {
    record[name] = value;
  });
  return record;
}

function toBlob(response: FakeResponse): Blob {
  if (response.body instanceof Blob) return response.body;
  return new Blob(response.body === null ? [] : [response.body], { type: response.contentType ?? '' });
}

/** Mirrors the native transport's errors: an abort is a cancel, anything else an unreachable PC. */
function transportFailure(error: unknown, signal?: AbortSignal): PasserError {
  if (error instanceof PasserError) return error;
  if (signal?.aborted) return new PasserError('cancelled', 'Cancelled');
  return new PasserError('unreachable', error instanceof Error ? error.message : 'Transfer failed');
}

type FakeNetworkOptions = {
  regime: RegimeName;
  pcClipboard: () => Promise<PcClipboard>;
  log: (kind: BenchLogKind, message: string) => void;
};

/**
 * Puts the fake PC on the phone's network. `fetch` calls to the PC's addresses
 * (pings and text) are answered by the fake, and the file transport the app
 * uses on the web sends pulls and uploads to it, with the regime's latency and
 * throughput. Any other request goes out untouched.
 */
export function createFakeNetwork({ regime, pcClipboard, log }: FakeNetworkOptions) {
  const behaviour = BEHAVIOUR[regime];
  const other = behaviour.identity === 'other';

  const pc: FakePc = {
    identity: () => (other ? OTHER_PC : PC),
    expectedToken: () => (other ? OTHER_PC.token : behaviour.tokenAccepted ? PC.token : ROTATED_TOKEN),
    clipboard: pcClipboard,
    received: (message) => log('pc', message),
  };

  const addressOf = (url: URL): AddressKind | null => {
    if (url.port !== String(PC.port)) return null;
    if (url.hostname === PC.host) return 'host';
    if (url.hostname === PC.ip) return 'ip';
    if (url.hostname === PC.host.replace(/\.local$/, '')) return 'name';
    return null;
  };

  const answers = (url: URL): boolean => {
    const address = addressOf(url);
    return address !== null && behaviour.answers[address];
  };

  const serve = async (request: FakeRequest): Promise<FakeResponse> => {
    const response = await handle(pc, request);
    if (response.status >= 400) log('pc', `${request.method} ${request.url.pathname} → HTTP ${response.status}`);
    return response;
  };

  const install = () => {
    const realFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      if (addressOf(url) === null) return realFetch(input, init);
      const signal = init?.signal;
      if (!answers(url)) return silence(signal);
      await sleep(url.pathname === '/ping' ? behaviour.pingLatencyMs : behaviour.latencyMs, signal);
      const headers = headerRecord(init?.headers);
      const response = await serve({
        method: (init?.method ?? 'GET').toUpperCase(),
        url,
        headers,
        body:
          typeof init?.body === 'string'
            ? { kind: 'text', contentType: headers['content-type'] ?? null, text: init.body }
            : null,
      });
      return new Response(response.body, {
        status: response.status,
        headers: response.contentType ? { 'Content-Type': response.contentType } : undefined,
      });
    };
  };

  const transport: FileTransport = {
    async download({ url, headers, signal }) {
      const target = new URL(url);
      try {
        if (!answers(target)) await silence(signal);
        await sleep(behaviour.latencyMs, signal);
        const response = await serve({ method: 'GET', url: target, headers: headerRecord(headers), body: null });
        const blob = toBlob(response);
        await sleep(Math.min(30_000, (blob.size / behaviour.bytesPerSecond) * 1000), signal);
        return {
          status: response.status,
          contentType: response.contentType ?? '',
          fileUri: URL.createObjectURL(blob),
          readText: () => blob.text(),
        };
      } catch (error) {
        throw transportFailure(error, signal);
      }
    },

    async upload({ url, headers, file, field, onProgress, signal }) {
      const target = new URL(url);
      try {
        if (!answers(target)) await silence(signal);
        const size = file.size ?? 0;
        // The request is a little larger than the file: multipart boundaries and part headers.
        const total = size + 190 + field.length + file.name.length + file.mimeType.length;
        const step = Math.max(1, Math.round((behaviour.bytesPerSecond * TICK_MS) / 1000));
        await sleep(behaviour.latencyMs, signal);
        for (let sent = 0; sent < total; ) {
          sent = Math.min(total, sent + step);
          onProgress?.({ sent, total });
          await sleep(TICK_MS, signal);
        }
        const response = await serve({
          method: 'POST',
          url: target,
          headers: headerRecord(headers),
          body: { kind: 'multipart', parts: [{ name: field, fileName: file.name, contentType: file.mimeType, size }] },
        });
        return { status: response.status, body: await toBlob(response).text() };
      } catch (error) {
        throw transportFailure(error, signal);
      }
    },
  };

  return { install, transport };
}
