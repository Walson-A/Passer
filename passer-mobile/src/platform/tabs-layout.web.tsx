import { Tabs, type BottomTabBarProps } from 'expo-router/tabs';
import type { ComponentType } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ClockIcon, DevicesIcon, SendIcon, type IconProps } from '@/components/icons';
import { AppText } from '@/components/ui/app-text';
import { t } from '@/i18n';
import { useTheme } from '@/theme/theme';

import { look } from './look';

const TABS: Record<string, { label: string; icon: ComponentType<IconProps> }> = {
  index: { label: t.tabs.send, icon: SendIcon },
  devices: { label: t.tabs.devices, icon: DevicesIcon },
  activity: { label: t.tabs.activity, icon: ClockIcon },
};

/**
 * Bench stand-in for the native tab bar (`tabs-layout.tsx`), drawn after UITabBar or
 * Material 3's navigation bar depending on the bench's platform.
 */
function BenchTabBar({ state, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const ios = look === 'ios';
  return (
    <View
      style={[
        styles.bar,
        ios ? styles.iosBar : styles.androidBar,
        { backgroundColor: colors.tab.bar, borderTopColor: colors.tab.border, paddingBottom: insets.bottom + (ios ? 2 : 10) },
      ]}
    >
      {state.routes.map((route, index) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const focused = state.index === index;
        const color = focused ? colors.tab.active : colors.tab.inactive;
        const Icon = tab.icon;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.label}
            onPress={() => {
              if (!focused) navigation.navigate(route.name);
            }}
            style={styles.item}
          >
            <View style={[styles.icon, !ios && focused && { backgroundColor: colors.tab.indicator }, !ios && styles.pill]}>
              <Icon size={ios ? 25 : 22} color={color} strokeWidth={focused ? 2.1 : 1.8} />
            </View>
            <AppText variant="meta" color={color} maxFontSizeMultiplier={1.2} style={ios ? styles.iosLabel : styles.androidLabel}>
              {tab.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <BenchTabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="devices" />
      <Tabs.Screen name="activity" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', justifyContent: 'space-around' },
  iosBar: { paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth },
  androidBar: { paddingTop: 12 },
  item: { flex: 1, alignItems: 'center', gap: 4, minHeight: 48 },
  icon: { height: 32, alignItems: 'center', justifyContent: 'center' },
  pill: { width: 64, borderRadius: 16 },
  iosLabel: { fontSize: 10, fontWeight: '600' },
  androidLabel: { fontSize: 12, fontWeight: '500' },
});
