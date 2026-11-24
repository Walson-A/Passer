import { PasserError } from './errors';
import { fetchWithTimeout, interpretResponse, TOKEN_HEADER } from './http';
import type { Endpoint } from './types';

export type UploadFile = {
  uri: string;
  name: string;
  mimeType: string;
  size: number | null;
};

export type TransferProgress = { sent: number; total: number };

/**
 * File I/O the client needs but cannot do portably: streaming a response to
 * disk and uploading a file with progress. Implemented per platform in
 * `src/platform/file-transport.ts`, and faked in tests.
 */
export interface FileTransport {
  download(request: {
    url: string;
    headers: Record<string, string>;
    signal?: AbortSignal;
  }): Promise<{ status: number; contentType: string; fileUri: string; readText(): Promise<string> }>;

  upload(request: {
    url: string;
    headers: Record<string, string>;
    file: UploadFile;
    field: string;
    onProgress?: (progress: TransferProgress) => void;
    signal?: AbortSignal;
  }): Promise<{ status: number; body: string }>;
}

export type PullResult =
  | { kind: 'text'; text: string }
  | { kind: 'image'; fileUri: string }
  | { kind: 'files'; fileUri: string };

const PUSH_TEXT_TIMEOUT_MS = 10_000;

/** Authenticated calls to one PC, through an endpoint `locate()` has verified. */
export class PasserClient {
  private readonly endpoint: Endpoint;
  private readonly token: string;
  private readonly files: FileTransport;

  constructor(endpoint: Endpoint, token: string, files: FileTransport) {
    this.endpoint = endpoint;
    this.token = token;
    this.files = files;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { ...extra, [TOKEN_HEADER]: this.token };
  }

  /** Puts text on the PC clipboard. */
  async pushText(text: string, signal?: AbortSignal): Promise<void> {
    const response = await fetchWithTimeout(`${this.endpoint.baseUrl}/push`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ text }),
      timeoutMs: PUSH_TEXT_TIMEOUT_MS,
      signal,
    });
    interpretResponse(response.status, await response.text());
  }

  /**
   * Reads the PC clipboard. The response is streamed to a file first because it
   * may be a large ZIP of copied files; text is read back from that file.
   */
  async pull(signal?: AbortSignal): Promise<PullResult> {
    const result = await this.files.download({
      url: `${this.endpoint.baseUrl}/pull`,
      headers: this.headers(),
      signal,
    });
    const type = result.contentType.split(';')[0].trim().toLowerCase();

    if (result.status < 200 || result.status >= 300 || type === 'application/json') {
      const body = interpretResponse(result.status, await result.readText());
      const text = (body as { text?: unknown } | undefined)?.text;
      if (typeof text !== 'string') throw new PasserError('protocol', 'No text in the /pull response');
      return { kind: 'text', text };
    }
    if (type === 'image/png') return { kind: 'image', fileUri: result.fileUri };
    if (type === 'application/zip') return { kind: 'files', fileUri: result.fileUri };
    throw new PasserError('protocol', `Unexpected /pull content type: ${type || 'none'}`);
  }

  /** Puts an image on the PC clipboard. The PC decodes JPEG and PNG, not HEIC. */
  async pushImage(
    file: UploadFile,
    onProgress?: (progress: TransferProgress) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const { status, body } = await this.files.upload({
      url: `${this.endpoint.baseUrl}/push/image`,
      headers: this.headers(),
      file,
      field: 'image',
      onProgress,
      signal,
    });
    interpretResponse(status, body);
  }

  /**
   * Saves a file in the PC's Passboard folder. `clipboardError` reports that
   * the file arrived but could not also be placed on the PC clipboard.
   */
  async pushFile(
    file: UploadFile,
    onProgress?: (progress: TransferProgress) => void,
    signal?: AbortSignal,
  ): Promise<{ clipboardError: string | null }> {
    const { status, body } = await this.files.upload({
      url: `${this.endpoint.baseUrl}/push/file`,
      headers: this.headers(),
      file,
      field: 'file',
      onProgress,
      signal,
    });
    const parsed = interpretResponse(status, body) as { clipboard_error?: unknown } | undefined;
    return {
      clipboardError: typeof parsed?.clipboard_error === 'string' ? parsed.clipboard_error : null,
    };
  }
}
