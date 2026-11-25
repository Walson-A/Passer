/**
 * Where an over-the-air update stands, as Settings shows it. `updates.ts` reads it
 * from expo-updates; the bench's stand-in (`updates.web.ts`) plays it out.
 */
export type UpdateStatus =
  | { kind: 'idle' }
  | { kind: 'checking' }
  /** `progress` runs from 0 to 1, and stays null until the download reports any. */
  | { kind: 'downloading'; progress: number | null }
  /** Downloaded: restarting the app runs it. */
  | { kind: 'ready' }
  | { kind: 'up-to-date' }
  | { kind: 'failed' };

/** How a check started from Settings ends. */
export type UpdateOutcome = 'up-to-date' | 'ready' | 'failed';

export type AppUpdates = {
  /** False in development, where the JavaScript comes from the dev server and there is nothing to check. */
  enabled: boolean;
  status: UpdateStatus;
  /** When the running update was published, or null while the app runs the code it was installed with. */
  runningSince: Date | null;
  /** Checks for an update, and downloads it when there is one. */
  check: () => Promise<UpdateOutcome>;
  /** Restarts onto the downloaded update, behind a screen in the app's colours. */
  restart: (colors: { background: string; spinner: string }) => Promise<void>;
};

/** What expo-updates itself reports, whether the launch check or a tap in Settings started the work. */
export type NativeUpdateState = {
  isChecking: boolean;
  isDownloading: boolean;
  isUpdatePending: boolean;
  downloadProgress?: number;
};

/** A downloaded update comes first, then the step under way, then how the last check ended. */
export function updateStatus(
  native: NativeUpdateState,
  step: 'checking' | 'downloading' | null,
  outcome: UpdateOutcome | null,
): UpdateStatus {
  if (native.isUpdatePending || outcome === 'ready') return { kind: 'ready' };
  if (step === 'downloading' || native.isDownloading) {
    const progress = native.downloadProgress;
    return { kind: 'downloading', progress: progress !== undefined && progress > 0 ? Math.min(progress, 1) : null };
  }
  if (step === 'checking' || native.isChecking) return { kind: 'checking' };
  if (outcome) return { kind: outcome };
  return { kind: 'idle' };
}
