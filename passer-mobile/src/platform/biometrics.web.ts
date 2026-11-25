import { benchHost } from './web-bench';

export type Proof = 'ok' | 'cancelled' | 'no-code' | 'failed';

/** Bench stand-in for Face ID: it succeeds after the time a phone takes, and says so in the log. */
export async function provePresence(reason: string): Promise<Proof> {
  benchHost().log('haptic', `Face ID : « ${reason} » → reconnu`);
  await new Promise((resolve) => setTimeout(resolve, 600));
  return 'ok';
}
