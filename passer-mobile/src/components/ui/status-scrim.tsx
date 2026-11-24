import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/theme';

/**
 * Content scrolled up passes under the status bar; this keeps the time and battery
 * readable, as the system's navigation bar does.
 */
export function StatusScrim() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return <View pointerEvents="none" style={[styles.scrim, { height: insets.top, backgroundColor: colors.ground }]} />;
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, opacity: 0.94 },
});
