export type PasserErrorKind =
  /** Nothing answered: the PC is asleep, on another network, or local network access is denied. */
  | 'unreachable'
  /** The PC rejected the pairing token, usually because it was regenerated on the desktop. */
  | 'unauthorized'
  /** A Passer PC answered, but not the one this phone paired with. */
  | 'wrong-pc'
  /** Something answered on that address, but it is not Passer. */
  | 'not-passer'
  /** The PC understood the request but could not use it (HTTP 400). */
  | 'rejected'
  /** The PC failed on its side, for example its clipboard was locked (HTTP 5xx). */
  | 'pc-failed'
  /** The response did not match the contract. */
  | 'protocol'
  | 'cancelled';

/**
 * Every failure the app shows goes through this type. `message` is for
 * diagnostics only: screens map `kind` to their own translated copy, and no
 * message ever contains the pairing token.
 */
export class PasserError extends Error {
  readonly kind: PasserErrorKind;
  readonly status: number | null;

  constructor(kind: PasserErrorKind, message: string, status: number | null = null) {
    super(message);
    this.name = 'PasserError';
    this.kind = kind;
    this.status = status;
  }
}

export function isPasserError(value: unknown): value is PasserError {
  return value instanceof PasserError;
}
