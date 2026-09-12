import type { ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';

import type { IconProps } from '@/components/icons';
import { haptic } from '@/platform/haptics';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';

import { AppText } from './app-text';
import { PressableScale } from './pressable-scale';

type ActionButtonProps = {
  icon: ComponentType<IconProps>;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Accent-coloured icon for the action that deserves the eye (e.g. "From PC"). */
  emphasis?: boolean;
  /** `pill` fills its row; `plain` is a borderless secondary action. */
  variant?: 'pill' | 'plain';
  accessibilityHint?: string;
};

export function ActionButton({
  icon: Icon,
  label,
  onPress,
  disabled = false,
  emphasis = false,
  variant = 'pill',
  accessibilityHint,
}: ActionButtonProps) {
  const { colors } = useTheme();
  const isPill = variant === 'pill';

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        haptic.select();
        onPress();
      }}
      style={[
        styles.base,
        isPill && { backgroundColor: colors.surface.raised, borderColor: colors.border.raised, borderWidth: 1 },
        !isPill && { borderColor: colors.border.subtle, borderWidth: 1 },
        disabled && styles.disabled,
      ]}
    >
      <View style={styles.content}>
        <Icon size={18} color={emphasis ? colors.accent : colors.icon.normal} strokeWidth={emphasis ? 2 : 1.75} />
        <AppText variant="body" tone={isPill ? 'primary' : 'secondary'} numberOfLines={1} style={emphasis && styles.strong}>
          {label}
        </AppText>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.button,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  strong: { fontWeight: '600' },
  disabled: { opacity: 0.4 },
});
