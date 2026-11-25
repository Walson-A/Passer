/**
 * The screen-sharing protocol of Vasistas (`docs/share.md` in the Vasistas repository), as
 * the viewer speaks it: what travels over a `screen.view` or `screen.control` stream of the
 * device network. No React Native import: unit-tested.
 *
 * Both directions use the same framing: one byte of kind, four bytes of length (unsigned,
 * little-endian), then the payload.
 */

export const FRAME_JSON = 1;
export const FRAME_VIDEO = 2;
export const FRAME_POINTER_SHAPE = 3;

export type Frame = { kind: number; payload: Uint8Array };

/** Frames can arrive split over several chunks, or several in one chunk: this puts them back together. */
export class FrameReader {
  private buffer = new Uint8Array(0);

  push(chunk: Uint8Array): Frame[] {
    const joined = new Uint8Array(this.buffer.length + chunk.length);
    joined.set(this.buffer, 0);
    joined.set(chunk, this.buffer.length);
    const frames: Frame[] = [];
    let offset = 0;
    while (joined.length - offset >= 5) {
      const size =
        (joined[offset + 1] | (joined[offset + 2] << 8) | (joined[offset + 3] << 16) | (joined[offset + 4] << 24)) >>> 0;
      if (joined.length - offset - 5 < size) break;
      frames.push({ kind: joined[offset], payload: joined.slice(offset + 5, offset + 5 + size) });
      offset += 5 + size;
    }
    this.buffer = joined.slice(offset);
    return frames;
  }
}

export function encodeFrame(kind: number, payload: Uint8Array): Uint8Array {
  const frame = new Uint8Array(5 + payload.length);
  frame[0] = kind;
  const length = payload.length >>> 0;
  frame[1] = length & 0xff;
  frame[2] = (length >>> 8) & 0xff;
  frame[3] = (length >>> 16) & 0xff;
  frame[4] = (length >>> 24) & 0xff;
  frame.set(payload, 5);
  return frame;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** A message from the viewer: JSON, kind 1. */
export function encodeMessage(message: ViewerMessage): Uint8Array {
  return encodeFrame(FRAME_JSON, encoder.encode(JSON.stringify(message)));
}

export function decodeJson(payload: Uint8Array): unknown {
  try {
    return JSON.parse(decoder.decode(payload));
  } catch {
    return null;
  }
}

/** What the viewer sends. Positions go from 0 to 1 across the shared display. */
export type ViewerMessage =
  | { type: 'keyframe' }
  | { type: 'move'; x: number; y: number }
  | { type: 'button'; button: 'left' | 'right' | 'middle'; down: boolean }
  | { type: 'wheel'; dy: number; dx: number }
  | { type: 'key'; code: string; down: boolean }
  | { type: 'text'; text: string }
  | { type: 'release_all' };

export type EndReason = 'escape' | 'stopped' | 'expired' | 'viewer_left' | string;

/** What the shared PC says, besides the video. */
export type ScreenEvent =
  | { event: 'ready'; width: number; height: number; control: boolean }
  | { event: 'pointer'; x: number; y: number }
  | { event: 'pointer'; visible: false }
  | { event: 'paused'; reason: string }
  | { event: 'resumed' }
  | { event: 'refused'; reason: string }
  | { event: 'local_input' }
  | { event: 'ended'; reason: EndReason };

/** A JSON event, checked: anything malformed or unknown is dropped. */
export function parseEvent(value: unknown): ScreenEvent | null {
  if (!value || typeof value !== 'object') return null;
  const message = value as Record<string, unknown>;
  switch (message.event) {
    case 'ready':
      if (typeof message.width !== 'number' || typeof message.height !== 'number') return null;
      return { event: 'ready', width: message.width, height: message.height, control: message.control === true };
    case 'pointer':
      if (message.visible === false) return { event: 'pointer', visible: false };
      if (typeof message.x !== 'number' || typeof message.y !== 'number') return null;
      return { event: 'pointer', x: clamp01(message.x), y: clamp01(message.y) };
    case 'paused':
      return { event: 'paused', reason: typeof message.reason === 'string' ? message.reason : 'unavailable' };
    case 'resumed':
      return { event: 'resumed' };
    case 'refused':
      return { event: 'refused', reason: typeof message.reason === 'string' ? message.reason : '' };
    case 'local_input':
      return { event: 'local_input' };
    case 'ended':
      return { event: 'ended', reason: typeof message.reason === 'string' ? message.reason : 'stopped' };
    default:
      return null;
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Where the video sits inside the view: scaled to fit, centred, letterboxed. */
export function videoRect(viewWidth: number, viewHeight: number, videoWidth: number, videoHeight: number) {
  if (viewWidth <= 0 || viewHeight <= 0 || videoWidth <= 0 || videoHeight <= 0) {
    return { x: 0, y: 0, width: Math.max(0, viewWidth), height: Math.max(0, viewHeight) };
  }
  const scale = Math.min(viewWidth / videoWidth, viewHeight / videoHeight);
  const width = videoWidth * scale;
  const height = videoHeight * scale;
  return { x: (viewWidth - width) / 2, y: (viewHeight - height) / 2, width, height };
}

/** A touch in the view, as a position on the shared display (0 to 1), or null outside the video. */
export function touchToDisplay(
  touch: { x: number; y: number },
  rect: { x: number; y: number; width: number; height: number },
): { x: number; y: number } | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const x = (touch.x - rect.x) / rect.width;
  const y = (touch.y - rect.y) / rect.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x, y };
}

/**
 * A point on the phone's window, in the picture's own frame. The picture fills `area`; turned, it
 * is a quarter clockwise, centred, as wide as the area is tall. Computed here rather than read
 * from the gesture's local position, which some platforms (the web) give before the rotation.
 */
export function windowToStage(
  point: { x: number; y: number },
  area: { x: number; y: number; width: number; height: number },
  turned: boolean,
): { x: number; y: number } {
  const x = point.x - area.x;
  const y = point.y - area.y;
  if (!turned) return { x, y };
  const dx = x - area.width / 2;
  const dy = y - area.height / 2;
  return { x: area.height / 2 + dy, y: area.width / 2 - dx };
}

/** The keys a phone keyboard can't type, named like the web's `KeyboardEvent.code`, as Vasistas expects. */
export const SPECIAL_KEYS = {
  escape: 'Escape',
  tab: 'Tab',
  enter: 'Enter',
  backspace: 'Backspace',
  delete: 'Delete',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  up: 'ArrowUp',
  down: 'ArrowDown',
  control: 'ControlLeft',
  alt: 'AltLeft',
  shift: 'ShiftLeft',
  meta: 'MetaLeft',
} as const;

/** A key pressed and released, with modifiers held around it (`ControlLeft` then `KeyC`). */
export function keyPress(code: string, modifiers: string[] = []): ViewerMessage[] {
  return [
    ...modifiers.map((modifier): ViewerMessage => ({ type: 'key', code: modifier, down: true })),
    { type: 'key', code, down: true },
    { type: 'key', code, down: false },
    ...[...modifiers].reverse().map((modifier): ViewerMessage => ({ type: 'key', code: modifier, down: false })),
  ];
}
