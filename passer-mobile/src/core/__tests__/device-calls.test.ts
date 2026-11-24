import { describe, expect, it } from '@jest/globals';

import {
  base64Size,
  CallFailure,
  classifyCallError,
  fitsOneCall,
  listFilesOf,
  MAX_FILE_BYTES,
  readClipboardOf,
  sendFileTo,
  sendTextTo,
  type CoreCall,
} from '../device-calls';

describe('classifyCallError', () => {
  it.each([
    ['Refused(code: "denied", message: "the user said no")', 'denied'],
    ['approval_timeout: nobody answered', 'timeout'],
    ['too_large: payload', 'too-large'],
    ['not_member: unknown device', 'not-member'],
    ['unknown_capability: clipboard.read', 'not-offered'],
    ['network error: connection lost', 'unreachable'],
    ['Network(message: "timed out")', 'unreachable'],
    ['the device is not started', 'unreachable'],
    ['storage error: disk full', 'failed'],
  ])('%s → %s', (message, kind) => {
    expect(classifyCallError(new Error(message)).kind).toBe(kind);
  });

  it('keeps the first line as the detail', () => {
    expect(classifyCallError(new Error('denied: no\nstack')).detail).toBe('denied: no');
  });
});

describe('calls', () => {
  const recorder = (answer: string | Error) => {
    const calls: { device: string; capability: string; input: unknown }[] = [];
    const call: CoreCall = async (device, capability, inputJson) => {
      calls.push({ device, capability, input: JSON.parse(inputJson) });
      if (answer instanceof Error) throw answer;
      return answer;
    };
    return { call, calls };
  };

  it('sends text to clipboard.write', async () => {
    const { call, calls } = recorder('{"ok":true}');
    await sendTextTo(call, 'pc-id', 'hello');
    expect(calls).toEqual([{ device: 'pc-id', capability: 'clipboard.write', input: { text: 'hello' } }]);
  });

  it('refuses text the PC would refuse, before calling', async () => {
    const { call, calls } = recorder('{"ok":true}');
    await expect(sendTextTo(call, 'pc', 'x'.repeat(200_001))).rejects.toMatchObject({ kind: 'too-large' });
    expect(calls).toHaveLength(0);
  });

  it('sends a file to file.receive and reads the saved size', async () => {
    const { call, calls } = recorder('{"saved":true,"size":3}');
    await expect(sendFileTo(call, 'pc', 'a.txt', 'YWJj')).resolves.toEqual({ size: 3 });
    expect(calls[0]).toEqual({ device: 'pc', capability: 'file.receive', input: { name: 'a.txt', data_base64: 'YWJj' } });
  });

  it('refuses a file over the limit before calling', async () => {
    const { call, calls } = recorder('{}');
    const big = 'A'.repeat(Math.ceil(((MAX_FILE_BYTES + 3) * 4) / 3));
    await expect(sendFileTo(call, 'pc', 'big.bin', big)).rejects.toBeInstanceOf(CallFailure);
    expect(calls).toHaveLength(0);
  });

  it('reads the clipboard text', async () => {
    const { call } = recorder('{"text":"from the PC"}');
    await expect(readClipboardOf(call, 'pc')).resolves.toBe('from the PC');
  });

  it('turns a refusal into a typed failure', async () => {
    const { call } = recorder(new Error('denied: no'));
    await expect(readClipboardOf(call, 'pc')).rejects.toMatchObject({ kind: 'denied' });
  });

  it('rejects an unreadable answer', async () => {
    const { call } = recorder('not json');
    await expect(readClipboardOf(call, 'pc')).rejects.toMatchObject({ kind: 'failed' });
  });
});

describe('sizes', () => {
  it('measures base64 without decoding', () => {
    expect(base64Size('')).toBe(0);
    expect(base64Size('YQ==')).toBe(1);
    expect(base64Size('YWI=')).toBe(2);
    expect(base64Size('YWJj')).toBe(3);
  });

  it('lets unknown sizes through', () => {
    expect(fitsOneCall(null)).toBe(true);
    expect(fitsOneCall(MAX_FILE_BYTES)).toBe(true);
    expect(fitsOneCall(MAX_FILE_BYTES + 1)).toBe(false);
  });
});

describe('listFilesOf', () => {
  it('reads the desktop answer and skips what it cannot use', async () => {
    const call: CoreCall = async (_device, capability) => {
      expect(capability).toBe('file.list');
      return JSON.stringify({ files: [{ name: 'a.pdf', size: 12, modified: 1700000000 }, { size: 3 }, { name: 'b.txt' }] });
    };
    await expect(listFilesOf(call, 'pc')).resolves.toEqual([
      { name: 'a.pdf', size: 12, modified: 1700000000 },
      { name: 'b.txt', size: null, modified: null },
    ]);
  });

  it('classifies a refusal', async () => {
    const call: CoreCall = async () => {
      throw new Error('unknown_capability: file.list');
    };
    await expect(listFilesOf(call, 'pc')).rejects.toMatchObject({ kind: 'not-offered' });
  });
});
