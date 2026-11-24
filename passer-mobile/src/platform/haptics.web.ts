import { benchHost } from './web-bench';

let enabled = true;

export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

/** Bench stand-in (see `web-bench.ts`): each haptic goes to the bench log, where it can be checked. */
function feel(name: string): void {
  if (enabled) benchHost().log('haptic', name);
}

export const haptic = {
  select(): void {
    feel('Sélection');
  },
  tap(): void {
    feel('Impact léger');
  },
  success(): void {
    feel('Succès');
  },
  warning(): void {
    feel('Avertissement');
  },
  error(): void {
    feel('Erreur');
  },
};
