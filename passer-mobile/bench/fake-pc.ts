import { formatBytes } from '@/utils/format';

import type { PcClipboard } from './fixtures';

/**
 * The bench's Passer desktop: the HTTP API of `passer-app/src-tauri/src`
 * (`server.rs`, `auth.rs`, `clipboard.rs`, `files.rs`), answer for answer.
 *
 * Every status, content type and body here was read in that code. A fake that
 * answers with shapes the desktop never sends makes a correct screen look broken,
 * or a broken one look correct. When the desktop changes, change this with it.
 */

export type FakePart = { name: string; fileName: string; contentType: string; size: number };

export type FakeRequest = {
  method: string;
  url: URL;
  /** Lowercased names. */
  headers: Record<string, string>;
  body: { kind: 'text'; contentType: string | null; text: string } | { kind: 'multipart'; parts: FakePart[] } | null;
};

export type FakeResponse = { status: number; contentType: string | null; body: string | Blob | null };

export type FakePc = {
  identity: () => { name: string; host: string; id: string; version: string };
  expectedToken: () => string;
  clipboard: () => Promise<PcClipboard>;
  /** What the desktop would show in its history. */
  received: (message: string) => void;
};

/** `auth::require_token`. */
const TOKEN_MESSAGE =
  'Missing or invalid pairing token. Send it as the X-Passer-Token header (or ?token=). You can copy it from Passer > Settings.';

/** The routes behind `auth::require_token`, with the method each accepts. */
const PROTECTED: Record<string, string> = {
  '/pull': 'GET',
  '/push': 'POST',
  '/push/image': 'POST',
  '/push/file': 'POST',
};

/** What `image::load_from_memory` decodes with the crate's default features. HEIC is not among them. */
const DECODABLE_IMAGES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/tiff',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);

function json(status: number, value: unknown): FakeResponse {
  return { status, contentType: 'application/json', body: JSON.stringify(value) };
}

/** axum's own rejections are plain text. */
function plain(status: number, text: string): FakeResponse {
  return { status, contentType: 'text/plain; charset=utf-8', body: text };
}

const EMPTY = (status: number): FakeResponse => ({ status, contentType: null, body: null });

/** `auth::extract_token`: the header first, then a raw `token=` query pair. */
function providedToken(request: FakeRequest): string | null {
  const header = request.headers['x-passer-token'];
  if (header !== undefined) return header;
  const pair = request.url.search
    .replace(/^\?/, '')
    .split('&')
    .find((item) => item.startsWith('token='));
  return pair ? pair.slice('token='.length) : null;
}

function preview(text: string): string {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > 60 ? `${line.slice(0, 59)}…` : line;
}

export async function handle(pc: FakePc, request: FakeRequest): Promise<FakeResponse> {
  const path = request.url.pathname;

  if (path === '/ping') {
    if (request.method !== 'GET') return EMPTY(405);
    const identity = pc.identity();
    return json(200, {
      app: 'passer',
      version: identity.version,
      host: identity.name,
      name: identity.name,
      mdns: identity.host,
      id: identity.id,
    });
  }

  const method = PROTECTED[path];
  if (!method) return EMPTY(404);

  // `Router::layer` runs the token check before method routing, so a wrong method without a token is a 401.
  const expected = pc.expectedToken();
  if (!expected || providedToken(request) !== expected) {
    return json(401, { status: 'error', message: TOKEN_MESSAGE });
  }
  if (request.method !== method) return EMPTY(405);

  switch (path) {
    case '/pull':
      return pull(pc);
    case '/push':
      return pushText(pc, request);
    case '/push/image':
      return pushImage(pc, request);
    default:
      return pushFile(pc, request);
  }
}

/** `clipboard::pull_clipboard`: files as a ZIP, else an image as PNG, else the text as JSON. */
async function pull(pc: FakePc): Promise<FakeResponse> {
  const content = await pc.clipboard();
  if (content.kind === 'files') return { status: 200, contentType: 'application/zip', body: content.zip };
  if (content.kind === 'image') return { status: 200, contentType: 'image/png', body: content.png };
  return json(200, { text: content.text });
}

/** `clipboard::push_clipboard`, behind axum's `Json<ClipboardContent>` extractor. */
function pushText(pc: FakePc, request: FakeRequest): FakeResponse {
  const body = request.body;
  const contentType = body?.kind === 'text' ? (body.contentType ?? '').split(';')[0].trim().toLowerCase() : '';
  if (body?.kind !== 'text' || !(contentType === 'application/json' || contentType.endsWith('+json'))) {
    return plain(415, 'Expected request with `Content-Type: application/json`');
  }
  let payload: unknown;
  try {
    payload = JSON.parse(body.text);
  } catch (error) {
    return plain(400, `Failed to parse the request body as JSON: ${error instanceof Error ? error.message : 'invalid JSON'}`);
  }
  const text = payload && typeof payload === 'object' ? (payload as { text?: unknown }).text : undefined;
  if (typeof text !== 'string') {
    return plain(422, 'Failed to deserialize the JSON body into the target type: missing field `text`');
  }
  if (text.trim()) pc.received(`Presse-papiers du PC ← « ${preview(text)} »`);
  return json(200, { status: 'success' });
}

/** `clipboard::push_image`: the first `image/*` part, decoded, then put on the clipboard. */
function pushImage(pc: FakePc, request: FakeRequest): FakeResponse {
  const parts = request.body?.kind === 'multipart' ? request.body.parts : [];
  const image = parts.find((part) => part.contentType.startsWith('image/'));
  if (!image || image.size === 0) return json(400, { status: 'error', message: 'No image found' });
  if (!DECODABLE_IMAGES.has(image.contentType)) {
    return json(500, { status: 'error', message: 'Decode: The image format could not be determined' });
  }
  pc.received(`Presse-papiers du PC ← image ${image.fileName} (${formatBytes(image.size)})`);
  return json(200, { status: 'success' });
}

/** `files::push_file`: every part saved under its base name, then added to the clipboard as files. */
function pushFile(pc: FakePc, request: FakeRequest): FakeResponse {
  const parts = request.body?.kind === 'multipart' ? request.body.parts : [];
  if (parts.length === 0) return json(400, { status: 'error', message: 'No files saved' });
  for (const part of parts) {
    const base = part.fileName.split(/[\\/]/).pop() ?? '';
    const name = base && base !== '.' && base !== '..' ? base : 'unknown_file';
    pc.received(`Passboard ← ${name} (${formatBytes(part.size)})`);
  }
  return json(200, { status: 'success', count: parts.length });
}
