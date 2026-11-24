import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { t } from '@/i18n';
import { useTheme } from '@/theme/theme';

/**
 * The three tabs as the system draws them: UITabBar on iOS (with its glass on iOS 26),
 * Material 3's navigation bar on Android. The bench draws a stand-in
 * (`tabs-layout.web.tsx`), since a browser has neither.
 */
export function TabsLayout() {
  const { colors } = useTheme();
  return (
    <NativeTabs
      tintColor={colors.tab.active}
      iconColor={{ default: colors.tab.inactive, selected: colors.tab.active }}
      labelStyle={{ default: { color: colors.tab.inactive }, selected: { color: colors.tab.active } }}
      indicatorColor={colors.tab.indicator}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="paperplane" md="send" />
        <NativeTabs.Trigger.Label>{t.tabs.send}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="devices">
        <NativeTabs.Trigger.Icon sf="laptopcomputer.and.iphone" md="devices" />
        <NativeTabs.Trigger.Label>{t.tabs.devices}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="activity">
        <NativeTabs.Trigger.Icon sf="clock" md="history" />
        <NativeTabs.Trigger.Label>{t.tabs.activity}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
