import { PixelRatio, StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { benchFontScale } from '@/platform/font-scale';
import type { Reach } from '@/state/devices';
import { useTheme } from '@/theme/theme';

import { AppText } from './ui/app-text';

/** Whether a device answers, in the desktop's words: Reachable, Not reachable, Checking. */
export function ReachLine({ reach, suffix }: { reach: Reach | undefined; suffix?: string }) {
  const { colors } = useTheme();
  const state = reach ?? 'checking';
  const color = state === 'reachable' ? colors.status.ok : state === 'unreachable' ? colors.status.warn : colors.text.tertiary;
  const label = state === 'reachable' ? t.status.reachable : state === 'unreachable' ? t.status.unreachable : t.status.checking;
  // The dot sits on the first line, whatever the text size.
  const scale = benchFontScale !== 1 ? benchFontScale : PixelRatio.getFontScale();
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: color, marginTop: 6 * scale }]} />
      <AppText variant="subhead" tone="secondary" numberOfLines={2} style={styles.text}>
        <AppText variant="subhead" color={state === 'checking' ? colors.text.secondary : color}>
          {label}
        </AppText>
        {suffix ? ` · ${suffix}` : ''}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { flexShrink: 1 },
});
