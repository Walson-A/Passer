import { PasserError } from './errors';

export const TOKEN_HEADER = 'X-Passer-Token';

type ErrorBody = { status?: unknown; message?: unknown; error?: unknown };

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function describe(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const { message, error } = body as ErrorBody;
    if (typeof message === 'string') return message;
    if (typeof error === 'string') return error;
  }
  return fallback;
}

/**
 * Maps a desktop response to its parsed body or a typed error.
 *
 * Desktops released before real HTTP error codes answered failures with a
 * 200 and an error body (`{"status":"error"}`, or `{"error":…}` on `/pull`), so
 * the body is checked even on success codes. A `/push/file` answer carrying
 * `clipboard_error` is still a success: the files reached the disk.
 */
export function interpretResponse(status: number, text: string): unknown {
  const body = parseJson(text);

  if (status === 401) {
    throw new PasserError('unauthorized', describe(body, 'Pairing token rejected'), status);
  }
  if (status === 400) {
    throw new PasserError('rejected', describe(body, 'Request rejected'), status);
  }
  if (status >= 500) {
    throw new PasserError('pc-failed', describe(body, 'The PC could not complete the request'), status);
  }
  if (status < 200 || status >= 300) {
    throw new PasserError('protocol', `Unexpected HTTP ${status}`, status);
  }

  if (body && typeof body === 'object') {
    const { status: outcome, error } = body as ErrorBody;
    if (outcome === 'error' || (typeof error === 'string' && !('text' in body))) {
      throw new PasserError('pc-failed', describe(body, 'The PC could not complete the request'), status);
    }
  }
  return body;
}

type TimedRequest = Omit<RequestInit, 'signal'> & { timeoutMs: number; signal?: AbortSignal };

/**
 * `fetch` with a deadline. Network failures become `unreachable`, and an
 * abort requested by the caller becomes `cancelled`.
 */
export async function fetchWithTimeout(url: string, request: TimedRequest): Promise<Response> {
  const { timeoutMs, signal, ...init } = request;
  const controller = new AbortController();
  const forwardAbort = () => controller.abort();
  signal?.addEventListener('abort', forwardAbort);
  const timer = setTimeout(forwardAbort, timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (signal?.aborted) throw new PasserError('cancelled', 'Cancelled');
    throw new PasserError('unreachable', error instanceof Error ? error.message : 'Network request failed');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }
}
