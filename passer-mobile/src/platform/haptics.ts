import * as Haptics from 'expo-haptics';

let enabled = true;

export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

/**
 * Haptics are part of the design: a light tick when choosing, a success or
 * error notification when a transfer ends. Confirmation is felt, not read.
 */
export const haptic = {
  select(): void {
    if (enabled) void Haptics.selectionAsync();
  },
  tap(): void {
    if (enabled) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },
  success(): void {
    if (enabled) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
  warning(): void {
    if (enabled) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  },
  error(): void {
    if (enabled) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  },
};
