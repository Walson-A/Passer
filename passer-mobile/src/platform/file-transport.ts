import { File, Paths, UploadType } from 'expo-file-system';
import { downloadAsync, readAsStringAsync } from 'expo-file-system/legacy';

import type { FileTransport } from '@/core/client';
import { PasserError } from '@/core/errors';

function networkFailure(error: unknown, signal?: AbortSignal): PasserError {
  if (signal?.aborted) return new PasserError('cancelled', 'Cancelled');
  return new PasserError('unreachable', error instanceof Error ? error.message : 'Transfer failed');
}

function header(headers: Record<string, string>, name: string): string | undefined {
  const match = Object.keys(headers).find((key) => key.toLowerCase() === name);
  return match ? headers[match] : undefined;
}

/**
 * Streams `/pull` to disk and uploads files with progress. The legacy download
 * is used because it is the one that reports the status and Content-Type the
 * client needs to tell text, image and ZIP apart. The modern upload task is
 * the one that reports progress and honours an AbortSignal.
 */
export const fileTransport: FileTransport = {
  async download({ url, headers, signal }) {
    if (signal?.aborted) throw new PasserError('cancelled', 'Cancelled');
    const destination = new File(Paths.cache, `pull-${Date.now()}`);
    try {
      const result = await downloadAsync(url, destination.uri, { headers });
      if (signal?.aborted) throw new PasserError('cancelled', 'Cancelled');
      return {
        status: result.status,
        contentType: header(result.headers, 'content-type') ?? result.mimeType ?? '',
        fileUri: result.uri,
        readText: () => readAsStringAsync(result.uri),
      };
    } catch (error) {
      if (error instanceof PasserError) throw error;
      throw networkFailure(error, signal);
    }
  },

  async upload({ url, headers, file, field, onProgress, signal }) {
    const task = new File(file.uri).createUploadTask(url, {
      uploadType: UploadType.MULTIPART,
      fieldName: field,
      mimeType: file.mimeType,
      headers,
      // The UI shows progress and a cancel button, so the upload lives with the screen.
      sessionType: 'foreground',
      signal,
      onProgress: ({ bytesSent, totalBytes }) => onProgress?.({ sent: bytesSent, total: totalBytes }),
    });
    try {
      const { status, body } = await task.uploadAsync();
      return { status, body };
    } catch (error) {
      throw networkFailure(error, signal);
    }
  },
};
