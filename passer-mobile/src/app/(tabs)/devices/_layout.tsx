import { Stack } from 'expo-router';

import { useTheme } from '@/theme/theme';

/** The list, then one device's page pushed over it, with the system's back gesture. */
export default function DevicesStack() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }} />;
}
