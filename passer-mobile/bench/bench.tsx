import { benchMode } from './boot';
import { Desk } from './desk';
import { Phone } from './phone';

/** The bench: the real screens in a browser, face to a fake PC. See `docs/mobile/bench.md`. */
export function Bench() {
  return benchMode === 'desk' ? <Desk /> : <Phone />;
}
