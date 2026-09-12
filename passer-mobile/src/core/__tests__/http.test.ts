import { describe, expect, it } from '@jest/globals';

import { isSamePc } from '../endpoint';
import { PasserError } from '../errors';
import { interpretResponse } from '../http';

function outcome(status: number, body: string): string {
  try {
    interpretResponse(status, body);
    return 'ok';
  } catch (error) {
    return error instanceof PasserError ? error.kind : 'unexpected';
  }
}

describe('interpretResponse', () => {
  it('returns the parsed body on success', () => {
    expect(interpretResponse(200, '{"status":"success"}')).toEqual({ status: 'success' });
  });

  it('maps the desktop status codes to error kinds', () => {
    expect(outcome(401, '{"status":"error","message":"Missing or invalid pairing token."}')).toBe('unauthorized');
    expect(outcome(400, '{"status":"error","message":"No image found"}')).toBe('rejected');
    expect(outcome(500, '{"status":"error","message":"Clipboard error"}')).toBe('pc-failed');
    expect(outcome(404, '')).toBe('protocol');
  });

  it('treats the HTTP 200 error bodies of older desktops as failures', () => {
    expect(outcome(200, '{"status":"error","message":"Clipboard error"}')).toBe('pc-failed');
    expect(outcome(200, '{"error":"Failed to read clipboard"}')).toBe('pc-failed');
  });

  it('keeps a /push/file clipboard_error as a success', () => {
    expect(interpretResponse(200, '{"status":"success","count":1,"clipboard_error":"busy"}')).toMatchObject({
      count: 1,
    });
  });

  it('does not mistake pulled text for an error', () => {
    expect(interpretResponse(200, '{"text":"error"}')).toEqual({ text: 'error' });
  });

  it('never puts a token-looking value in its messages', () => {
    try {
      interpretResponse(401, '');
    } catch (error) {
      expect((error as Error).message).toBe('Pairing token rejected');
    }
  });
});

describe('isSamePc', () => {
  const ping = { app: 'passer' as const, version: '1.0.0', host: 'WALSON-LAPTOP' };

  it('trusts the stable id when both sides have one', () => {
    expect(isSamePc({ id: 'abc', name: 'OTHER' }, { ...ping, id: 'abc' })).toBe(true);
    expect(isSamePc({ id: 'abc', name: 'WALSON-LAPTOP' }, { ...ping, id: 'xyz' })).toBe(false);
  });

  it('falls back to the machine name for desktops without an id', () => {
    expect(isSamePc({ id: null, name: 'walson-laptop' }, ping)).toBe(true);
    expect(isSamePc({ id: 'abc', name: 'WALSON-LAPTOP' }, ping)).toBe(true);
    expect(isSamePc({ id: null, name: 'OFFICE-PC' }, ping)).toBe(false);
  });
});
