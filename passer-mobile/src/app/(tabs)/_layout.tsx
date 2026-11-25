import { Redirect } from 'expo-router';

import { TabsLayout } from '@/platform/tabs-layout';
import { useDevices } from '@/state/devices';

/** Send, Devices, Activity. A phone that belongs to no group yet starts on the welcome screen. */
export default function TabsRoute() {
  const { available, phase, status } = useDevices();
  if (available && phase === 'ready' && status && !status.group) return <Redirect href="/welcome" />;
  return <TabsLayout />;
}
