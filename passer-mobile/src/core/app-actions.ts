/**
 * What a widget or a Control Center control asks the app to do. The names are
 * the `passer://action/<name>` links and the raw values of `PasserAction` in
 * `targets/widgets/_shared/PasserActions.swift`; change both sides together.
 */
export const APP_ACTIONS = [
  'send-clipboard',
  'pull',
  'send-screenshot',
  'send-and-delete-screenshot',
  'send-photo',
  'send-file',
] as const;

export type AppAction = (typeof APP_ACTIONS)[number];

/** An action older than this was left by an app that closed before running it. */
export const ACTION_LIFETIME_MS = 60_000;

export function parseAppAction(value: unknown): AppAction | null {
  return typeof value === 'string' && (APP_ACTIONS as readonly string[]).includes(value) ? (value as AppAction) : null;
}
