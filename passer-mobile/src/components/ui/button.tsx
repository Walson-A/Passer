import type { ComponentType } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import type { IconProps } from '@/components/icons';
import { haptic } from '@/platform/haptics';
import { useTheme } from '@/theme/theme';

import { AppText } from './app-text';
import { PressableScale } from './pressable-scale';

export type ButtonTone = 'primary' | 'navy' | 'quiet' | 'destructive' | 'plain';

type ButtonProps = {
  label: string;
  onPress: () => void;
  tone?: ButtonTone;
  icon?: ComponentType<IconProps>;
  disabled?: boolean;
  busy?: boolean;
  /** Fills the row it sits in. */
  grow?: boolean;
  accessibilityHint?: string;
};

/**
 * One button for every screen.
 * - `primary`: the one high-contrast action, in the paste control's colours.
 * - `navy`: the desktop's confirm colour (Add a device, Allow once).
 * - `quiet`: beside another action. `destructive`: removes something. `plain`: a link.
 */
export function Button({ label, onPress, tone = 'primary', icon: Icon, disabled = false, busy = false, grow = false, accessibilityHint }: ButtonProps) {
  const { colors } = useTheme();
  const look = {
    primary: { background: colors.paste.background, border: colors.paste.background, text: colors.paste.foreground },
    navy: { background: colors.navy.background, border: colors.navy.border, text: colors.navy.text },
    quiet: { background: colors.surface.raised, border: colors.border.raised, text: colors.text.primary },
    destructive: { background: colors.status.errorWash, border: colors.status.errorWash, text: colors.status.error },
    plain: { background: 'transparent', border: 'transparent', text: colors.link },
  }[tone];

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={[
        styles.button,
        tone === 'plain' && styles.plain,
        { backgroundColor: look.background, borderColor: look.border },
        grow && styles.grow,
        disabled && styles.disabled,
      ]}
    >
      {busy ? <ActivityIndicator color={look.text} /> : Icon ? <Icon size={19} color={look.text} strokeWidth={2} /> : null}
      <AppText variant="headline" color={look.text} style={styles.label}>
        {label}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 54,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  plain: { minHeight: 44, paddingHorizontal: 12 },
  grow: { flex: 1, paddingHorizontal: 14 },
  label: { textAlign: 'center', flexShrink: 1 },
  disabled: { opacity: 0.4 },
});
