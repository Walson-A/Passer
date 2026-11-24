import { Text, type TextProps, type TextStyle } from 'react-native';

import { benchFontScale } from '@/platform/font-scale';
import { look } from '@/platform/look';
import { useTheme } from '@/theme/theme';
import { type } from '@/theme/tokens';

type Variant = keyof typeof type;
type Tone = 'primary' | 'secondary' | 'tertiary' | 'label';

type AppTextProps = TextProps & {
  variant?: Variant;
  tone?: Tone;
  /** Overrides `tone` for semantic colours (status, destinations). */
  color?: string;
};

/**
 * Material 3's scale for the same roles, so Android text sits like Android text:
 * no negative tracking, regular-weight headlines.
 */
const ANDROID: Partial<Record<Variant, TextStyle>> = {
  largeTitle: { fontSize: 28, lineHeight: 36, fontWeight: '400', letterSpacing: 0 },
  heading: { fontSize: 22, lineHeight: 28, fontWeight: '500', letterSpacing: 0 },
  headline: { fontSize: 16, lineHeight: 24, fontWeight: '500', letterSpacing: 0.15 },
  callout: { fontSize: 16, lineHeight: 24, fontWeight: '400', letterSpacing: 0.15 },
  subhead: { fontSize: 14, lineHeight: 20, fontWeight: '400', letterSpacing: 0.25 },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400', letterSpacing: 0.2 },
};

function scaled(variant: Variant): TextStyle {
  const base = { ...type[variant], ...(look === 'android' ? ANDROID[variant] : null) };
  const cap = variant === 'label' ? 1.4 : variant === 'digits' ? 1.6 : Infinity;
  const factor = Math.min(benchFontScale, cap);
  return { fontSize: (base.fontSize ?? 14) * factor, lineHeight: (base.lineHeight ?? 18) * factor };
}

/** Text on the type scale. Dynamic Type stays on; tight UI labels cap their growth. */
export function AppText({ variant = 'body', tone = 'primary', color, style, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  const isLabel = variant === 'label';
  return (
    <Text
      maxFontSizeMultiplier={isLabel ? 1.4 : variant === 'digits' ? 1.6 : undefined}
      {...rest}
      style={[
        type[variant],
        look === 'android' ? ANDROID[variant] : null,
        benchFontScale !== 1 ? scaled(variant) : null,
        { color: color ?? colors.text[tone] },
        isLabel && { textTransform: 'uppercase' },
        style,
      ]}
    />
  );
}
