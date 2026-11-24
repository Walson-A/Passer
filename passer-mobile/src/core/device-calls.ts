/**
 * Calls to another device of the group, through passer-core.
 *
 * The PC's capabilities are defined in `passer-app/src-tauri/src/devices.rs`; the limits
 * below mirror its constants. This file has no React Native import: it is given the
 * native `call` and unit-tested.
 */

/** `(device id or name, capability, input as JSON) → output as JSON`, as the native module exposes it. */
export type CoreCall = (device: string, capability: string, inputJson: string) => Promise<string>;

export const CAPABILITIES = {
  clipboardWrite: 'clipboard.write',
  clipboardRead: 'clipboard.read',
  fileReceive: 'file.receive',
  deviceInfo: 'device.info',
} as const;

/** `MAX_TEXT` in devices.rs. */
export const MAX_TEXT_LENGTH = 200_000;
/** `MAX_FILE_BYTES` in devices.rs: files above go through the HTTP pairing, or wait for streams in the core. */
export const MAX_FILE_BYTES = 700 * 1024;

/**
 * What went wrong, in the words the screens need.
 * - `denied`: the other device's user said no.
 * - `timeout`: nobody answered the approval in time; it counts as a no.
 * - `too-large`: above what a single call carries today.
 * - `unreachable`: the device didn't answer at all.
 * - `not-member`: this phone was removed from the group.
 * - `not-offered`: the device doesn't offer that (an older PC, or another kind of device).
 * - `failed`: anything else; `detail` keeps the raw message.
 */
export type CallFailureKind = 'denied' | 'timeout' | 'too-large' | 'unreachable' | 'not-member' | 'not-offered' | 'failed';

export class CallFailure extends Error {
  constructor(
    readonly kind: CallFailureKind,
    readonly detail: string,
  ) {
    super(detail);
    this.name = 'CallFailure';
  }
}

/**
 * Native errors arrive as text. The core's stable codes (`denied`, `approval_timeout`…) and
 * its error variants (`Network`, `NotStarted`) appear in it whatever the bridge's wording.
 */
export function classifyCallError(error: unknown): CallFailure {
  if (error instanceof CallFailure) return error;
  const detail = (error instanceof Error ? error.message : String(error)).split('\n')[0];
  const text = detail.toLowerCase();
  const has = (...needles: string[]) => needles.some((needle) => text.includes(needle));

  if (has('approval_timeout', 'approvaltimeout')) return new CallFailure('timeout', detail);
  if (has('denied')) return new CallFailure('denied', detail);
  if (has('too_large', 'toolarge', 'too large')) return new CallFailure('too-large', detail);
  if (has('not_member', 'notmember')) return new CallFailure('not-member', detail);
  if (has('unknown_capability', 'unknowncapability', 'unsupported')) return new CallFailure('not-offered', detail);
  if (has('network', 'notstarted', 'not started', 'timed out', 'unreachable', 'connection')) {
    return new CallFailure('unreachable', detail);
  }
  return new CallFailure('failed', detail);
}

async function invoke(call: CoreCall, device: string, capability: string, input: object): Promise<unknown> {
  let output: string;
  try {
    output = await call(device, capability, JSON.stringify(input));
  } catch (error) {
    throw classifyCallError(error);
  }
  try {
    return JSON.parse(output) as unknown;
  } catch {
    throw new CallFailure('failed', `unreadable answer to ${capability}`);
  }
}

/** Puts text on the device's clipboard. */
export async function sendTextTo(call: CoreCall, device: string, text: string): Promise<void> {
  if (text.length > MAX_TEXT_LENGTH) throw new CallFailure('too-large', `text over ${MAX_TEXT_LENGTH} characters`);
  await invoke(call, device, CAPABILITIES.clipboardWrite, { text });
}

/** Saves a file in the device's Passer folder. `base64` is the file's content. */
export async function sendFileTo(call: CoreCall, device: string, name: string, base64: string): Promise<{ size: number }> {
  if (base64Size(base64) > MAX_FILE_BYTES) throw new CallFailure('too-large', `file over ${MAX_FILE_BYTES} bytes`);
  const output = (await invoke(call, device, CAPABILITIES.fileReceive, { name, data_base64: base64 })) as { size?: number };
  return { size: typeof output?.size === 'number' ? output.size : base64Size(base64) };
}

/** Reads the device's clipboard. The device's user approves each read. */
export async function readClipboardOf(call: CoreCall, device: string): Promise<string> {
  const output = (await invoke(call, device, CAPABILITIES.clipboardRead, {})) as { text?: unknown };
  return typeof output?.text === 'string' ? output.text : '';
}

/** Bytes encoded by a base64 string, without decoding it. */
export function base64Size(base64: string): number {
  const length = base64.replace(/\s/g, '').length;
  if (length === 0) return 0;
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((length * 3) / 4) - padding;
}

/** Whether a file of this size can go through a single call today. `null` (unknown size) is let through to the core's own check. */
export function fitsOneCall(size: number | null): boolean {
  return size === null || size <= MAX_FILE_BYTES;
}
