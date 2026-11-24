import { PixelRatio, StyleSheet, View } from 'react-native';

import { minutesSince } from '@/core/devices';
import { format, t } from '@/i18n';
import { benchFontScale } from '@/platform/font-scale';
import type { Reach } from '@/state/devices';
import { useTheme } from '@/theme/theme';
import { formatRelative } from '@/utils/format';

import { AppText } from './ui/app-text';

/** Whether a device answers, in the desktop's words: Reachable, Not reachable, Checking. */
export function ReachLine({
  reach,
  suffix,
  answeredAt,
}: {
  reach: Reach | undefined;
  suffix?: string;
  /** When it last answered (passer-core, Unix seconds): said when it doesn't answer now. */
  answeredAt?: number | null;
}) {
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
        {state !== 'reachable' && minutesSince(answeredAt) !== null && answeredAt
          ? ` · ${format(t.status.seen, { time: formatRelative(answeredAt * 1000) })}`
          : ''}
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
