import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { JoinedHerePrompt } from '@/components/joined-here-prompt';
import { SafeAreaProvider } from '@/platform/safe-area-provider';
import { ApprovalsProvider } from '@/state/approvals';
import { ConnectionProvider } from '@/state/connection';
import { DevicesProvider } from '@/state/devices';
import { HistoryProvider } from '@/state/history';
import { PairingsProvider } from '@/state/pairings';
import { SettingsProvider } from '@/state/settings';
import { TransfersProvider } from '@/state/transfers';
import { ThemeProvider, useTheme } from '@/theme/theme';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <SettingsProvider>
            <PairingsProvider>
              <HistoryProvider>
                <ConnectionProvider>
                  <DevicesProvider>
                    <TransfersProvider>
                      <ApprovalsProvider>
                        <Screens />
                        <JoinedHerePrompt />
                      </ApprovalsProvider>
                    </TransfersProvider>
                  </DevicesProvider>
                </ConnectionProvider>
              </HistoryProvider>
            </PairingsProvider>
          </SettingsProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Screens() {
  const { scheme, colors } = useTheme();
  const sheet = {
    presentation: 'formSheet',
    sheetGrabberVisible: true,
    sheetCornerRadius: 32,
    contentStyle: { backgroundColor: colors.surface.sheet },
  } as const;

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
        <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="join" options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen
          name="pair"
          options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }}
        />
        <Stack.Screen name="manual" options={{ ...sheet, sheetAllowedDetents: 'fitToContents' }} />
        <Stack.Screen name="target" options={{ ...sheet, sheetAllowedDetents: 'fitToContents' }} />
        <Stack.Screen name="destination" options={{ ...sheet, sheetAllowedDetents: 'fitToContents' }} />
        <Stack.Screen name="invite" options={{ ...sheet, sheetAllowedDetents: [1] }} />
        <Stack.Screen name="settings" options={{ ...sheet, sheetAllowedDetents: [1] }} />
        {/* A widget's link: gone as soon as it has handed its action to Send. */}
        <Stack.Screen name="action/[name]" options={{ animation: 'none' }} />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
