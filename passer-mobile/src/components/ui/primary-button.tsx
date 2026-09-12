import type { ComponentType } from 'react';
import { StyleSheet } from 'react-native';

import type { IconProps } from '@/components/icons';
import { haptic } from '@/platform/haptics';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';

import { AppText } from './app-text';
import { PressableScale } from './pressable-scale';

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  icon?: ComponentType<IconProps>;
  disabled?: boolean;
  /** `solid` is the one high-contrast action on a screen; `quiet` sits beside it. */
  tone?: 'solid' | 'quiet';
};

/** Shares the paste control's colours, so the main action looks the same on every screen. */
export function PrimaryButton({ label, onPress, icon: Icon, disabled = false, tone = 'solid' }: PrimaryButtonProps) {
  const { colors } = useTheme();
  const solid = tone === 'solid';
  const foreground = solid ? colors.paste.foreground : colors.text.primary;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={[
        styles.button,
        solid
          ? { backgroundColor: colors.paste.background }
          : { backgroundColor: colors.surface.raised, borderColor: colors.border.raised, borderWidth: 1 },
        disabled && styles.disabled,
      ]}
    >
      {Icon ? <Icon size={19} color={foreground} strokeWidth={2} /> : null}
      <AppText variant="title" color={foreground} numberOfLines={1}>
        {label}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    borderRadius: radius.pill,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  disabled: { opacity: 0.4 },
});
