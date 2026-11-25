import type { FileTransport } from '@/core/client';

import { benchHost } from './web-bench';

/** Bench stand-in (see `web-bench.ts`): pulls and uploads go to the bench's fake PC. */
export const fileTransport: FileTransport = {
  download: (request) => benchHost().transport.download(request),
  upload: (request) => benchHost().transport.upload(request),
};
