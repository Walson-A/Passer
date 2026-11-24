import type { ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';

import { LockIcon, type IconProps } from '@/components/icons';
import { haptic } from '@/platform/haptics';
import { useTheme } from '@/theme/theme';

import { AppText } from './app-text';
import { PressableScale } from './pressable-scale';

type DiscProps = {
  icon: ComponentType<IconProps>;
  label: string;
  onPress: () => void;
  /** The other device asks its user first: an amber lock and "It asks first", as on the desktop. */
  locked?: boolean;
  lockedLabel?: string;
  disabled?: boolean;
  /** Read by VoiceOver instead of the label, when the label alone is too short. */
  accessibilityLabel?: string;
};

/** A command as a round disc with its label underneath: the desktop Showroom's grammar. */
export function Disc({ icon: Icon, label, onPress, locked = false, lockedLabel, disabled = false, accessibilityLabel }: DiscProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.column}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? (locked && lockedLabel ? `${label}, ${lockedLabel}` : label)}
        accessibilityState={{ disabled }}
        disabled={disabled}
        pressedScale={0.92}
        onPress={() => {
          haptic.tap();
          onPress();
        }}
        style={[styles.disc, { backgroundColor: colors.disc.background }, disabled && styles.disabled]}
      >
        <Icon size={27} color={colors.disc.icon} strokeWidth={1.8} />
        {locked ? (
          <View style={[styles.lock, { backgroundColor: colors.ground }]}>
            <LockIcon size={13} color={colors.lock} strokeWidth={2.4} />
          </View>
        ) : null}
      </PressableScale>
      <AppText variant="footnote" style={[styles.label, disabled && styles.disabled]} numberOfLines={2}>
        {label}
      </AppText>
      {locked && lockedLabel ? (
        <AppText variant="meta" color={colors.lock} style={styles.sub} numberOfLines={2}>
          {lockedLabel}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { flex: 1, alignItems: 'center', gap: 8, maxWidth: 120 },
  disc: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  lock: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { textAlign: 'center', fontWeight: '500' },
  sub: { textAlign: 'center', marginTop: -4 },
  disabled: { opacity: 0.4 },
});
