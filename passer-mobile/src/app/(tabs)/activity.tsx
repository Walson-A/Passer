import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActivityRow } from '@/components/activity-row';
import { ClockIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { StatusScrim } from '@/components/ui/status-scrim';
import { LargeHeader } from '@/components/ui/header';
import { Group } from '@/components/ui/list';
import { EmptyState, Notice } from '@/components/ui/notice';
import { language, t } from '@/i18n';
import { haptic } from '@/platform/haptics';
import { shareFile } from '@/platform/media';
import { useHistory, type HistoryItem } from '@/state/history';
import { useTheme } from '@/theme/theme';

const dayLabel = new Intl.DateTimeFormat(language, { weekday: 'long', day: 'numeric', month: 'long' });

function dayOf(at: number, now: Date): string {
  const date = new Date(at);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (at >= startOfToday) return t.activity.today;
  if (at >= startOfToday - 86_400_000) return t.activity.yesterday;
  const label = dayLabel.format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Everything sent and received, by day. It stays on this phone and can be cleared. */
export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { items, clear } = useHistory();
  const [confirming, setConfirming] = useState(false);

  const now = new Date();
  const days: { label: string; items: HistoryItem[] }[] = [];
  for (const item of items) {
    const label = dayOf(item.at, now);
    const last = days[days.length - 1];
    if (last?.label === label) last.items.push(item);
    else days.push({ label, items: [item] });
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ backgroundColor: colors.ground }}
        contentContainerStyle={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom + 110 }]}
      >
        <LargeHeader
          title={t.activity.title}
          right={
            items.length > 0 && !confirming ? (
              <Button label={t.activity.clear} tone="plain" onPress={() => setConfirming(true)} />
            ) : undefined
          }
        />

        {confirming ? (
          <Notice tone="warn" title={t.activity.clearConfirm} body={t.activity.clearBody}>
            <View style={styles.confirm}>
              <Button label={t.common.cancel} tone="quiet" grow onPress={() => setConfirming(false)} />
              <Button
                label={t.activity.clear}
                tone="destructive"
                grow
                onPress={() => {
                  clear();
                  haptic.success();
                  setConfirming(false);
                }}
              />
            </View>
          </Notice>
        ) : null}

        {items.length === 0 ? (
          <EmptyState icon={ClockIcon} title={t.activity.emptyTitle} body={t.activity.emptyBody} />
        ) : (
          days.map((day) => (
            <Group key={day.label} header={day.label}>
              {day.items.map((item) => (
                <ActivityRow
                  key={item.id}
                  item={item}
                  onPress={
                    item.fileUri
                      ? () => void shareFile(item.fileUri as string, { mimeType: 'application/octet-stream', uti: 'public.data' })
                      : undefined
                  }
                />
              ))}
            </Group>
          ))
        )}
      </ScrollView>
      <StatusScrim />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 24 },
  confirm: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
});
