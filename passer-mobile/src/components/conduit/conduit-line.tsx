import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';

import { useTheme } from '@/theme/theme';
import { motion } from '@/theme/tokens';

export type LineMode = 'online' | 'searching' | 'offline';

export type Travel = { key: number; direction: 'up' | 'down' };

type ConduitLineProps = {
  mode: LineMode;
  /** A file on its way, 0..1. Up goes to the PC, down comes to this iPhone. */
  progress: { direction: 'up' | 'down'; value: number } | null;
  /** A quick transfer that just completed, drawn as a comet along the line. */
  travel: Travel | null;
  children?: ReactNode;
};

const COMET_LENGTH = 56;
const travelEasing = Easing.bezier(...motion.easing.travel);

/**
 * The line between the PC (top) and this iPhone (bottom). Its look is the
 * connection status, and it is also the progress bar and the path content
 * travels along, so direction is spatial: up is to the PC, down is to the phone.
 */
export function ConduitLine({ mode, progress, travel, children }: ConduitLineProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const [height, setHeight] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => setHeight(event.nativeEvent.layout.height);

  return (
    <View style={styles.container} onLayout={onLayout}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
        <View style={[styles.band, { backgroundColor: colors.conduit.band }]} />
      </View>

      {mode === 'offline' ? (
        <Svg pointerEvents="none" width={2} height={height} style={styles.lineSlot}>
          <Line x1={1} y1={0} x2={1} y2={height} stroke={colors.border.dashed} strokeWidth={2} strokeDasharray="6 8" />
        </Svg>
      ) : mode === 'searching' ? (
        <SearchingLine height={height} reduceMotion={reduceMotion} />
      ) : (
        <LinearGradient
          pointerEvents="none"
          colors={colors.conduit.line}
          locations={[0, 0.5, 1]}
          style={[styles.line, colors.conduit.lineGlow ? { boxShadow: colors.conduit.lineGlow } : null]}
        />
      )}

      {progress ? <ProgressFill height={height} direction={progress.direction} value={progress.value} /> : null}
      {travel && mode === 'online' ? <Comet height={height} travel={travel} reduceMotion={reduceMotion} /> : null}

      {children}
    </View>
  );
}

function SearchingLine({ height, reduceMotion }: { height: number; reduceMotion: boolean }) {
  const { colors } = useTheme();
  const position = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || height === 0) return;
    position.set(0);
    position.set(withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }), -1, false));
    return () => cancelAnimation(position);
  }, [height, reduceMotion, position]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: position.get() * (height + COMET_LENGTH) - COMET_LENGTH }],
  }));

  return (
    <View pointerEvents="none" style={[styles.line, { backgroundColor: colors.conduit.lineIdle, overflow: 'hidden' }]}>
      {reduceMotion ? null : (
        <Animated.View style={[styles.pulse, pulseStyle]}>
          <LinearGradient colors={['transparent', colors.conduit.fill[0], 'transparent']} style={StyleSheet.absoluteFill} />
        </Animated.View>
      )}
    </View>
  );
}

function ProgressFill({ height, direction, value }: { height: number; direction: 'up' | 'down'; value: number }) {
  const { colors } = useTheme();
  const fill = useSharedValue(0);

  useEffect(() => {
    fill.set(withTiming(Math.max(0, Math.min(1, value)), { duration: 240, easing: Easing.out(Easing.quad) }));
  }, [value, fill]);

  const fillStyle = useAnimatedStyle(() => ({ height: fill.get() * height }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.fill,
        direction === 'up' ? styles.fromBottom : styles.fromTop,
        { boxShadow: colors.conduit.fillGlow },
        fillStyle,
      ]}
    >
      <LinearGradient
        colors={direction === 'up' ? [colors.conduit.fill[1], colors.conduit.fill[0]] : [colors.conduit.fill[0], colors.conduit.fill[1]]}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

function Comet({ height, travel, reduceMotion }: { height: number; travel: Travel; reduceMotion: boolean }) {
  const { colors } = useTheme();
  const position = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (height === 0) return;
    if (reduceMotion) {
      // Reduce Motion: no travel, a brief glow of the whole line instead.
      position.set(0.5);
      opacity.set(withSequence(withTiming(0.8, { duration: motion.duration.fade }), withTiming(0, { duration: 420 })));
      return;
    }
    position.set(0);
    opacity.set(1);
    position.set(
      withTiming(1, { duration: motion.duration.travel, easing: travelEasing }, () => {
        opacity.set(withTiming(0, { duration: motion.duration.fade }));
      }),
    );
  }, [travel.key, height, reduceMotion, position, opacity]);

  const cometStyle = useAnimatedStyle(() => {
    const progressAlong = position.get();
    const along = travel.direction === 'up' ? 1 - progressAlong : progressAlong;
    return {
      opacity: opacity.get(),
      transform: [{ translateY: along * (height - COMET_LENGTH) }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.comet,
        { boxShadow: colors.conduit.fillGlow },
        reduceMotion ? { height, top: 0 } : null,
        cometStyle,
      ]}
    >
      <LinearGradient
        colors={
          travel.direction === 'up'
            ? [colors.conduit.fill[0], 'transparent']
            : ['transparent', colors.conduit.fill[0]]
        }
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 200 },
  center: { alignItems: 'center', justifyContent: 'center' },
  band: { width: '85%', height: '70%', borderRadius: 999, opacity: 0.9 },
  lineSlot: { position: 'absolute', top: 0, left: '50%', marginLeft: -1 },
  line: { position: 'absolute', top: 0, bottom: 0, left: '50%', marginLeft: -1, width: 2, borderRadius: 1 },
  pulse: { position: 'absolute', left: 0, right: 0, height: COMET_LENGTH },
  fill: { position: 'absolute', left: '50%', marginLeft: -2, width: 4, borderRadius: 2, overflow: 'hidden' },
  fromBottom: { bottom: 0 },
  fromTop: { top: 0 },
  comet: {
    position: 'absolute',
    top: 0,
    left: '50%',
    marginLeft: -2,
    width: 4,
    height: COMET_LENGTH,
    borderRadius: 2,
    overflow: 'hidden',
  },
});
