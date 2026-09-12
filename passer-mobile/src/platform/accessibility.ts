import { AccessibilityInfo } from 'react-native';

/** VoiceOver ignores `accessibilityLiveRegion`, so results are announced explicitly. */
export function announce(message: string): void {
  AccessibilityInfo.announceForAccessibility(message);
}
