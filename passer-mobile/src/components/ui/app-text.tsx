import { Text, type TextProps } from 'react-native';

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

/** Text on the type scale. Dynamic Type stays on; tight UI labels cap their growth. */
export function AppText({ variant = 'body', tone = 'primary', color, style, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  const isLabel = variant === 'label';
  return (
    <Text
      maxFontSizeMultiplier={isLabel ? 1.4 : undefined}
      {...rest}
      style={[
        type[variant],
        { color: color ?? colors.text[tone] },
        isLabel && { textTransform: 'uppercase' },
        style,
      ]}
    />
  );
}
