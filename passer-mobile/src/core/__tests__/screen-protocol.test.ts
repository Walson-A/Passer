import { describe, expect, it } from '@jest/globals';

import {
  encodeFrame,
  encodeMessage,
  decodeJson,
  FRAME_JSON,
  FRAME_VIDEO,
  FrameReader,
  keyPress,
  parseEvent,
  touchToDisplay,
  windowToStage,
  videoRect,
} from '../screen-protocol';

const json = (value: unknown) => encodeFrame(FRAME_JSON, new TextEncoder().encode(JSON.stringify(value)));

describe('FrameReader', () => {
  it('reads frames split across chunks and several in one chunk', () => {
    const a = json({ event: 'ready', width: 1920, height: 1080, control: true });
    const b = encodeFrame(FRAME_VIDEO, new Uint8Array(300).fill(7));
    const all = new Uint8Array([...a, ...b]);
    const reader = new FrameReader();
    const first = reader.push(all.slice(0, 7));
    const rest = reader.push(all.slice(7));
    expect(first).toHaveLength(0);
    expect(rest.map((f) => f.kind)).toEqual([FRAME_JSON, FRAME_VIDEO]);
    expect(rest[1].payload).toHaveLength(300);
    expect(parseEvent(decodeJson(rest[0].payload))).toEqual({ event: 'ready', width: 1920, height: 1080, control: true });
  });

  it('encodes a length little-endian', () => {
    const frame = encodeFrame(FRAME_VIDEO, new Uint8Array(0x0102));
    expect([...frame.slice(0, 5)]).toEqual([2, 0x02, 0x01, 0, 0]);
  });

  it('round-trips a viewer message', () => {
    const [frame] = new FrameReader().push(encodeMessage({ type: 'move', x: 0.5, y: 0.25 }));
    expect(decodeJson(frame.payload)).toEqual({ type: 'move', x: 0.5, y: 0.25 });
  });
});

describe('parseEvent', () => {
  it.each([
    [{ event: 'pointer', x: 1.4, y: -1 }, { event: 'pointer', x: 1, y: 0 }],
    [{ event: 'pointer', visible: false }, { event: 'pointer', visible: false }],
    [{ event: 'paused', reason: 'unavailable' }, { event: 'paused', reason: 'unavailable' }],
    [{ event: 'ended', reason: 'escape' }, { event: 'ended', reason: 'escape' }],
    [{ event: 'local_input' }, { event: 'local_input' }],
  ])('%j', (input, output) => {
    expect(parseEvent(input)).toEqual(output);
  });

  it('drops what it does not know', () => {
    expect(parseEvent({ event: 'surprise' })).toBeNull();
    expect(parseEvent({ event: 'ready', width: 'big' })).toBeNull();
    expect(parseEvent(null)).toBeNull();
  });
});

describe('positions', () => {
  it('letterboxes a wide video in a tall view', () => {
    expect(videoRect(400, 800, 1920, 1080)).toEqual({ x: 0, y: 287.5, width: 400, height: 225 });
  });

  it('maps a touch to the display, or nothing outside the video', () => {
    const rect = { x: 0, y: 287.5, width: 400, height: 225 };
    expect(touchToDisplay({ x: 200, y: 400 }, rect)).toEqual({ x: 0.5, y: 0.5 });
    expect(touchToDisplay({ x: 200, y: 100 }, rect)).toBeNull();
  });
});

describe('windowToStage', () => {
  const area = { x: 0, y: 100, width: 400, height: 800 };

  it('only moves the origin when the picture is upright', () => {
    expect(windowToStage({ x: 50, y: 150 }, area, false)).toEqual({ x: 50, y: 50 });
  });

  it('turns a quarter clockwise: the stage is 800 wide, 400 tall', () => {
    // The area's centre is the stage's centre.
    expect(windowToStage({ x: 200, y: 500 }, area, true)).toEqual({ x: 400, y: 200 });
    // The stage's top-left corner sits at the area's top-right.
    expect(windowToStage({ x: 400, y: 100 }, area, true)).toEqual({ x: 0, y: 0 });
    // Its bottom-right corner at the area's bottom-left.
    expect(windowToStage({ x: 0, y: 900 }, area, true)).toEqual({ x: 800, y: 400 });
  });
});

describe('keyPress', () => {
  it('holds modifiers around the key', () => {
    expect(keyPress('KeyC', ['ControlLeft'])).toEqual([
      { type: 'key', code: 'ControlLeft', down: true },
      { type: 'key', code: 'KeyC', down: true },
      { type: 'key', code: 'KeyC', down: false },
      { type: 'key', code: 'ControlLeft', down: false },
    ]);
  });
});
