import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

type StatusDotProps = {
  color: string;
  /** CSS box-shadow, e.g. the emerald glow of a live connection. */
  glow?: string;
  /** Breathes while the connection is being looked for. */
  pulsing?: boolean;
};

export function StatusDot({ color, glow, pulsing = false }: StatusDotProps) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (pulsing && !reduceMotion) {
      opacity.set(withRepeat(withTiming(0.35, { duration: 700, easing: Easing.inOut(Easing.quad) }), -1, true));
    } else {
      cancelAnimation(opacity);
      opacity.set(1);
    }
  }, [pulsing, reduceMotion, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Animated.View
      style={[styles.dot, { backgroundColor: color }, glow ? { boxShadow: glow } : null, animatedStyle]}
    />
  );
}

const styles = StyleSheet.create({
  dot: { width: 7, height: 7, borderRadius: 4 },
});
