import { describe, expect, it } from '@jest/globals';

import { updateStatus } from '../update-status';

const quiet = { isChecking: false, isDownloading: false, isUpdatePending: false };

describe('updateStatus', () => {
  it('offers the restart once an update is downloaded, even by the launch check', () => {
    expect(updateStatus({ ...quiet, isUpdatePending: true }, null, null)).toEqual({ kind: 'ready' });
    expect(updateStatus(quiet, null, 'ready')).toEqual({ kind: 'ready' });
  });

  it('shows the launch check and its download while they run', () => {
    expect(updateStatus({ ...quiet, isChecking: true }, null, null)).toEqual({ kind: 'checking' });
    expect(updateStatus({ ...quiet, isDownloading: true, downloadProgress: 0.42 }, null, null)).toEqual({
      kind: 'downloading',
      progress: 0.42,
    });
  });

  it('leaves the progress unknown until the download reports some', () => {
    expect(updateStatus(quiet, 'downloading', null)).toEqual({ kind: 'downloading', progress: null });
    expect(updateStatus({ ...quiet, isDownloading: true, downloadProgress: 0 }, 'downloading', null)).toEqual({
      kind: 'downloading',
      progress: null,
    });
  });

  it('keeps how the last check ended until the next one', () => {
    expect(updateStatus(quiet, null, 'up-to-date')).toEqual({ kind: 'up-to-date' });
    expect(updateStatus(quiet, null, 'failed')).toEqual({ kind: 'failed' });
    expect(updateStatus(quiet, null, null)).toEqual({ kind: 'idle' });
  });
});
