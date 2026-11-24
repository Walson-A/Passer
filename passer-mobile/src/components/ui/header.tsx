import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ArrowLeftIcon, ChevronLeftIcon } from '@/components/icons';
import { look } from '@/platform/look';
import { useTheme } from '@/theme/theme';

import { AppText } from './app-text';

/**
 * A tab's title: iOS's large title, Android's headline under the top app bar, with an
 * action on the right. It scrolls with the content, so it grows with Dynamic Type.
 */
export function LargeHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={[styles.large, look === 'android' && styles.largeAndroid]}>
      <View style={styles.titleRow}>
        <AppText variant="largeTitle" accessibilityRole="header" style={styles.flex}>
          {title}
        </AppText>
        {right}
      </View>
      {subtitle ? (
        <AppText variant="subhead" tone="secondary">
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
}

/** Back to the previous screen: "‹ Devices" on iOS, an arrow on Android. */
export function BackHeader({ label, onBack, right }: { label: string; onBack: () => void; right?: ReactNode }) {
  const { colors } = useTheme();
  const ios = look === 'ios';
  return (
    <View style={styles.back}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={8}
        onPress={onBack}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
      >
        {ios ? (
          <>
            <ChevronLeftIcon size={24} color={colors.link} strokeWidth={2.4} />
            <AppText variant="callout" color={colors.link}>
              {label}
            </AppText>
          </>
        ) : (
          <ArrowLeftIcon size={24} color={colors.text.primary} strokeWidth={2} />
        )}
      </Pressable>
      <View style={styles.flex} />
      {right}
    </View>
  );
}

/** A round icon button for a header (Settings, Close). */
export function HeaderButton({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        styles.round,
        { backgroundColor: look === 'ios' ? colors.surface.raised : 'transparent' },
        pressed && styles.pressed,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  large: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 4 },
  largeAndroid: { paddingHorizontal: 16, paddingTop: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  back: { minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  backButton: { minHeight: 44, minWidth: 44, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 4 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
});
