import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { parseAppAction } from '@/core/app-actions';
import { requestAction } from '@/state/actions';
import { useTheme } from '@/theme/theme';

/**
 * `passer://action/<name>`, opened by a Home Screen or Lock Screen widget. It
 * hands the action to Home, which runs it where the transfer can be seen, and
 * closes any sheet on the way. An unknown name just opens Home.
 */
export default function ActionRoute() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const router = useRouter();
  const { colors } = useTheme();

  useEffect(() => {
    const action = parseAppAction(name);
    if (action) requestAction(action);
    router.dismissTo('/');
  }, [name, router]);

  return <View style={[styles.screen, { backgroundColor: colors.ground }]} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
