import { Platform } from 'react-native';

/**
 * Which platform's conventions the screens follow: navigation, titles, lists and dialogs
 * look like iOS on an iPhone and like Android (Material 3) on Android, while Passer's own
 * identity stays the same on both. The bench can show either (`look.web.ts`).
 */
export type Look = 'ios' | 'android';

export const look: Look = Platform.OS === 'android' ? 'android' : 'ios';
