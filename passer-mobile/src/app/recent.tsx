import type { ComponentType } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ArrowDownToLineIcon,
  FileIcon,
  ImageIcon,
  LinkIcon,
  PackageIcon,
  TextIcon,
  type IconProps,
} from '@/components/icons';
import { AppText } from '@/components/ui/app-text';
import { PressableScale } from '@/components/ui/pressable-scale';
import { t } from '@/i18n';
import { haptic } from '@/platform/haptics';
import { useHistory, type HistoryItem } from '@/state/history';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';
import { formatBytes, formatRelative } from '@/utils/format';

function iconFor(item: HistoryItem): ComponentType<IconProps> {
  if (item.kind === 'image') return ImageIcon;
  if (item.kind === 'files') return PackageIcon;
  if (item.kind === 'file') return FileIcon;
  return /^https?:\/\//i.test(item.title) ? LinkIcon : TextIcon;
}

export default function Recent() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { items, clear } = useHistory();

  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">
          {t.recent.title}
        </AppText>
        {items.length > 0 ? (
          <PressableScale
            accessibilityRole="button"
            onPress={() => {
              haptic.warning();
              clear();
            }}
            style={styles.clear}
          >
            <AppText variant="caption" tone="secondary">
              {t.recent.clear}
            </AppText>
          </PressableScale>
        ) : null}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        renderItem={({ item }) => <Row item={item} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surface.raised, borderColor: colors.border.raised }]}>
              <ArrowDownToLineIcon size={20} color={colors.icon.dim} />
            </View>
            <AppText variant="body" tone="tertiary" style={styles.center}>
              {t.recent.empty}
            </AppText>
          </View>
        }
      />
    </View>
  );
}

function Row({ item }: { item: HistoryItem }) {
  const { colors } = useTheme();
  const Icon = iconFor(item);
  const parts = [
    item.direction === 'sent' ? t.recent.sent : t.recent.received,
    t.recent.destinations[item.destination],
    item.size ? formatBytes(item.size) : null,
    formatRelative(item.at),
  ].filter(Boolean);
  const accent = item.destination === 'passboard' ? colors.destination.folder : item.destination === 'pc-clipboard' ? colors.destination.clipboard : colors.icon.normal;

  return (
    <View
      accessible
      style={[styles.row, { backgroundColor: colors.surface.card, borderColor: colors.border.subtle }]}
    >
      <View style={[styles.tile, { backgroundColor: colors.surface.raised, borderColor: colors.border.raised }]}>
        <Icon size={17} color={accent} />
      </View>
      <View style={styles.text}>
        <AppText variant="body" numberOfLines={2}>
          {item.title}
        </AppText>
        <AppText variant="meta" tone="tertiary" numberOfLines={1}>
          {parts.join(' · ')}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, paddingTop: 24 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clear: { minHeight: 44, justifyContent: 'center' },
  list: { paddingHorizontal: 16, gap: 8 },
  row: {
    minHeight: 64,
    borderRadius: radius.button,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tile: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 3 },
  empty: { alignItems: 'center', gap: 14, paddingTop: 48, paddingHorizontal: 32 },
  emptyIcon: { width: 48, height: 48, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
});
