import { benchPreference } from './web-bench';

const SCALES: Record<string, number> = { large: 1.35, huge: 1.65 };

/**
 * The bench's stand-in for Dynamic Type: "large" is iOS's largest standard size for body
 * text (×1.35), "huge" the first accessibility size (×1.65). Text grows, icons don't, as on iOS.
 */
export const benchFontScale = SCALES[benchPreference('text') ?? ''] ?? 1;
