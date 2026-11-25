import { benchHost } from './web-bench';

/** Bench stand-in (see `web-bench.ts`): what VoiceOver would say goes to the bench log. */
export function announce(message: string): void {
  benchHost().log('voiceover', message);
}
