import * as Clipboard from 'expo-clipboard';

/**
 * Apple's `UIPasteControl`: it reads the clipboard on tap without the iOS paste
 * alert. The bench draws a stand-in of it (`paste-button.web.tsx`).
 */
export const isPasteButtonAvailable = Clipboard.isPasteButtonAvailable;
export const PasteButton = Clipboard.ClipboardPasteButton;
