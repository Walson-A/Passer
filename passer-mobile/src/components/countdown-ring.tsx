import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { format, t } from '@/i18n';
import { useTheme } from '@/theme/theme';

import { AppText } from './ui/app-text';

/** Seconds left from a deadline, ticking. */
export function useSecondsLeft(deadline: number): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [deadline]);
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

/**
 * How long is left to answer a request: a ring that empties, blue, then amber, then red,
 * like the desktop's. The number is what VoiceOver reads.
 */
export function CountdownRing({
  seconds,
  total,
  size = 46,
  ink,
}: {
  seconds: number;
  total: number;
  size?: number;
  /** The number's colour on a ground that ignores the theme (the screen viewer is always dark). */
  ink?: string;
}) {
  const { colors } = useTheme();
  const stroke = 3.5;
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;
  const ratio = total > 0 ? Math.max(0, Math.min(1, seconds / total)) : 0;
  const color = seconds <= 10 ? colors.status.error : seconds <= 20 ? colors.status.warn : '#60A5FA';
  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="timer"
      accessibilityLabel={format(t.approval.secondsLeft, { count: seconds })}
    >
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={ink ? 'rgba(255,255,255,0.18)' : colors.border.raised} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${length}`}
          strokeDashoffset={length * (1 - ratio)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.center}>
          <AppText variant="footnote" maxFontSizeMultiplier={1.2} color={ink} style={styles.number}>
            {seconds}
          </AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  number: { fontWeight: '700', fontVariant: ['tabular-nums'] },
});
