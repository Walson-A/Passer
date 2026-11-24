import { File, Paths, UploadType } from 'expo-file-system';
import {
  createDownloadResumable,
  deleteAsync,
  FileSystemSessionType,
  readAsStringAsync,
} from 'expo-file-system/legacy';

import type { FileTransport } from '@/core/client';
import { PasserError } from '@/core/errors';

/** A pull whose data stops arriving for this long is treated as a lost connection. */
const STALL_TIMEOUT_MS = 15_000;

function networkFailure(error: unknown, signal?: AbortSignal): PasserError {
  if (signal?.aborted) return new PasserError('cancelled', 'Cancelled');
  return new PasserError('unreachable', error instanceof Error ? error.message : 'Transfer failed');
}

function header(headers: Record<string, string>, name: string): string | undefined {
  const match = Object.keys(headers).find((key) => key.toLowerCase() === name);
  return match ? headers[match] : undefined;
}

/**
 * Streams `/pull` to disk and uploads files with progress.
 *
 * The legacy resumable download is used because it reports the status and
 * Content-Type that tell text, image and ZIP apart. It runs in a foreground
 * session: the default background session waits for the network indefinitely,
 * which would leave a pull hanging when the PC falls asleep. The foreground
 * session gives up after 60 s without an answer, which leaves the PC time to
 * zip a large Passboard; once data flows, a watchdog cancels a stalled pull.
 */
export const fileTransport: FileTransport = {
  async download({ url, headers, signal }) {
    if (signal?.aborted) throw new PasserError('cancelled', 'Cancelled');

    const destination = new File(Paths.cache, `pull-${Date.now()}`);
    let stalled = false;
    let watchdog: ReturnType<typeof setTimeout> | undefined;

    const task = createDownloadResumable(
      url,
      destination.uri,
      { headers, sessionType: FileSystemSessionType.FOREGROUND },
      () => armWatchdog(),
    );

    function armWatchdog() {
      if (watchdog) clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        stalled = true;
        void task.cancelAsync();
      }, STALL_TIMEOUT_MS);
    }

    const cancel = () => void task.cancelAsync();
    signal?.addEventListener('abort', cancel);

    try {
      const result = await task.downloadAsync();
      if (signal?.aborted) throw new PasserError('cancelled', 'Cancelled');
      if (!result) {
        throw stalled
          ? new PasserError('unreachable', 'The PC stopped sending')
          : new PasserError('cancelled', 'Cancelled');
      }
      return {
        status: result.status,
        contentType: header(result.headers, 'content-type') ?? result.mimeType ?? '',
        fileUri: result.uri,
        readText: async () => {
          // Text answers are read once and never needed as a file.
          const text = await readAsStringAsync(result.uri);
          void deleteAsync(result.uri, { idempotent: true });
          return text;
        },
      };
    } catch (error) {
      if (error instanceof PasserError) throw error;
      if (stalled) throw new PasserError('unreachable', 'The PC stopped sending');
      throw networkFailure(error, signal);
    } finally {
      if (watchdog) clearTimeout(watchdog);
      signal?.removeEventListener('abort', cancel);
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
