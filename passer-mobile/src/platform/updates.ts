import * as Updates from 'expo-updates';
import { useState } from 'react';

import { updateStatus, type AppUpdates, type UpdateOutcome } from './update-status';

/**
 * Over-the-air updates through EAS Update. expo-updates checks at launch on its
 * own, but iOS keeps an app suspended for days, so an update downloaded then can
 * wait a long time for the next cold start. Settings checks on demand and
 * restarts onto the update.
 */
export function useAppUpdates(): AppUpdates {
  const native = Updates.useUpdates();
  const [step, setStep] = useState<'checking' | 'downloading' | null>(null);
  const [outcome, setOutcome] = useState<UpdateOutcome | null>(null);

  const check = async (): Promise<UpdateOutcome> => {
    setOutcome(null);
    setStep('checking');
    let result: UpdateOutcome;
    try {
      const found = await Updates.checkForUpdateAsync();
      if (found.isAvailable || found.isRollBackToEmbedded) {
        setStep('downloading');
        const fetched = await Updates.fetchUpdateAsync();
        result = fetched.isNew || fetched.isRollBackToEmbedded ? 'ready' : 'up-to-date';
      } else {
        result = 'up-to-date';
      }
    } catch {
      result = 'failed';
    }
    setStep(null);
    setOutcome(result);
    return result;
  };

  return {
    enabled: Updates.isEnabled,
    status: updateStatus(native, step, outcome),
    runningSince: Updates.isEmbeddedLaunch ? null : Updates.createdAt,
    check,
    restart: ({ background, spinner }) =>
      Updates.reloadAsync({
        reloadScreenOptions: { backgroundColor: background, fade: true, spinner: { color: spinner, size: 'small' } },
      }),
  };
}
