import type { ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';

import { FileIcon, ImageIcon, LinkIcon, PackageIcon, TextIcon, type IconProps } from '@/components/icons';
import { format, t } from '@/i18n';
import type { HistoryItem } from '@/state/history';
import { useTheme } from '@/theme/theme';
import { formatBytes, formatRelative } from '@/utils/format';

import { Row } from './ui/list';

const LINK = /^[a-z][a-z0-9+.-]*:\/\/\S+$/i;

function iconFor(item: HistoryItem): { Icon: ComponentType<IconProps>; tint: 'ok' | 'folder' | 'accent' } {
  if (item.kind === 'text') return { Icon: LINK.test(item.title) ? LinkIcon : TextIcon, tint: 'ok' };
  if (item.kind === 'image') return { Icon: ImageIcon, tint: 'accent' };
  if (item.kind === 'files') return { Icon: PackageIcon, tint: 'folder' };
  return { Icon: FileIcon, tint: 'folder' };
}

/** One transfer: what, with whom, where it landed, when. A received file opens the share sheet. */
export function ActivityRow({ item, onPress }: { item: HistoryItem; onPress?: () => void }) {
  const { colors } = useTheme();
  const { Icon, tint } = iconFor(item);
  const color = tint === 'ok' ? colors.status.ok : tint === 'folder' ? colors.destination.folder : colors.link;
  const wash = tint === 'ok' ? colors.status.okWash : tint === 'folder' ? colors.destination.folderWash : colors.surface.raised;
  const who = item.peer
    ? format(item.direction === 'sent' ? t.activity.sentTo : t.activity.receivedFrom, { name: item.peer })
    : item.direction === 'sent'
      ? t.transfer.sending
      : t.transfer.receiving;
  const parts = [who, t.activity.places[item.destination], item.size ? formatBytes(item.size) : null, formatRelative(item.at)];
  return (
    <Row
      title={item.title}
      numberOfLines={2}
      subtitle={parts.filter(Boolean).join(' · ')}
      leading={
        <View style={[styles.badge, { backgroundColor: wash }]}>
          <Icon size={18} color={color} strokeWidth={2} />
        </View>
      }
      onPress={onPress}
      chevron={Boolean(onPress)}
    />
  );
}

const styles = StyleSheet.create({
  badge: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
