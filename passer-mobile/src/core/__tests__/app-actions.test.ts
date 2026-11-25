import { describe, expect, it } from '@jest/globals';

import { APP_ACTIONS, parseAppAction } from '../app-actions';

describe('parseAppAction', () => {
  it('accepts every action a widget can open', () => {
    for (const action of APP_ACTIONS) expect(parseAppAction(action)).toBe(action);
  });

  it('refuses anything else, including a route parameter left unset', () => {
    expect(parseAppAction('send')).toBeNull();
    expect(parseAppAction('SEND-CLIPBOARD')).toBeNull();
    expect(parseAppAction(undefined)).toBeNull();
    expect(parseAppAction(['pull'])).toBeNull();
  });
});
