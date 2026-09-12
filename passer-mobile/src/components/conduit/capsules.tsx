import type { ComponentType } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import {
  ArrowDownToLineIcon,
  ChevronUpIcon,
  ChevronsDownIcon,
  FileIcon,
  ImageIcon,
  LinkIcon,
  MoonIcon,
  PackageIcon,
  RotateIcon,
  ShareIcon,
  ShieldIcon,
  TextIcon,
  XIcon,
  type IconProps,
} from '@/components/icons';
import { AppText } from '@/components/ui/app-text';
import { PressableScale } from '@/components/ui/pressable-scale';
import { format, t } from '@/i18n';
import type { HistoryItem, HistoryKind } from '@/state/history';
import type { ActiveTransfer } from '@/state/transfers';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';
import { formatBytes, formatRelative } from '@/utils/format';

function iconFor(kind: HistoryKind, title: string): ComponentType<IconProps> {
  if (kind === 'image') return ImageIcon;
  if (kind === 'files') return PackageIcon;
  if (kind === 'file') return FileIcon;
  return /^https?:\/\/|^[\w-]+\.[a-z]{2,}\//i.test(title) ? LinkIcon : TextIcon;
}

function IconTile({ icon: Icon, tint, wash }: { icon: ComponentType<IconProps>; tint?: string; wash?: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.tile,
        wash
          ? { backgroundColor: wash }
          : { backgroundColor: colors.surface.raised, borderColor: colors.border.raised, borderWidth: 1 },
      ]}
    >
      <Icon size={17} color={tint ?? colors.icon.normal} />
    </View>
  );
}

function SmallIconButton({
  icon: Icon,
  label,
  onPress,
}: {
  icon: ComponentType<IconProps>;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.hit}>
      <View style={[styles.round, { backgroundColor: colors.surface.raised, borderColor: colors.border.raised }]}>
        <Icon size={14} color={colors.icon.normal} strokeWidth={2} />
      </View>
    </PressableScale>
  );
}

/** A file on its way along the conduit. The line itself shows the progress. */
export function TransferCapsule({ transfer, onCancel }: { transfer: ActiveTransfer; onCancel: () => void }) {
  const { colors } = useTheme();
  const detail =
    transfer.total > 0
      ? format(t.transfer.progress, { sent: formatBytes(transfer.sent), total: formatBytes(transfer.total) })
      : transfer.direction === 'up'
        ? t.transfer.sending
        : t.transfer.receiving;
  const counter = transfer.count > 1 ? `${format(t.transfer.itemOf, { index: transfer.index + 1, count: transfer.count })} · ` : '';

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(160)}
      accessibilityLiveRegion="polite"
      style={[
        styles.capsule,
        { backgroundColor: colors.surface.capsule, borderColor: colors.status.warnBorder, boxShadow: colors.shadow.capsule },
      ]}
    >
      <IconTile icon={transfer.direction === 'down' ? ArrowDownToLineIcon : iconFor(transfer.kind, transfer.title)} />
      <View style={styles.text}>
        <AppText variant="body" numberOfLines={1}>
          {transfer.title}
        </AppText>
        <AppText variant="caption" tone="tertiary" numberOfLines={1} style={styles.tabular}>
          {counter + detail}
        </AppText>
      </View>
      <SmallIconButton icon={XIcon} label={t.transfer.cancel} onPress={onCancel} />
    </Animated.View>
  );
}

/** The last thing that arrived on this iPhone, resting at the phone end of the conduit. */
export function ReceivedCapsule({
  item,
  onSave,
  onShare,
}: {
  item: HistoryItem;
  onSave?: () => void;
  onShare?: () => void;
}) {
  const { colors } = useTheme();
  const where =
    item.destination === 'iphone-clipboard'
      ? t.transfer.copiedHere
      : item.destination === 'files'
        ? t.transfer.filesFromPc
        : t.recent.destinations[item.destination];

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      style={[
        styles.capsule,
        styles.received,
        { backgroundColor: colors.surface.capsule, borderColor: colors.border.glass, boxShadow: colors.shadow.capsule },
      ]}
    >
      <IconTile icon={iconFor(item.kind, item.title)} />
      <View style={styles.text}>
        <AppText variant="body" numberOfLines={1}>
          {item.title}
        </AppText>
        <AppText variant="meta" tone="tertiary" numberOfLines={1}>
          {`${where} · ${formatRelative(item.at)}`}
        </AppText>
      </View>
      {onSave ? <SmallIconButton icon={ArrowDownToLineIcon} label={t.transfer.saveToPhotos} onPress={onSave} /> : null}
      {onShare ? <SmallIconButton icon={ShareIcon} label={t.transfer.share} onPress={onShare} /> : null}
    </Animated.View>
  );
}

/** A transfer that did not go through, or a short notice. Styled, never raw text. */
export function MessageCapsule({
  message,
  tone,
  onDismiss,
}: {
  message: string;
  tone: 'error' | 'notice';
  onDismiss: () => void;
}) {
  const { colors } = useTheme();
  const isError = tone === 'error';
  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(160)}
      accessibilityRole="alert"
      style={[
        styles.capsule,
        {
          backgroundColor: colors.surface.capsule,
          borderColor: isError ? colors.status.error : colors.border.glass,
          boxShadow: colors.shadow.capsule,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: isError ? colors.status.error : colors.status.ok }]} />
      <AppText variant="body" style={styles.text} numberOfLines={2}>
        {message}
      </AppText>
      <SmallIconButton icon={XIcon} label={t.transfer.dismiss} onPress={onDismiss} />
    </Animated.View>
  );
}

/** Teaches the pull gesture at the PC end of the line. */
export function PullHint({ armed }: { armed: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.hint, { backgroundColor: colors.ground, borderColor: armed ? colors.accent : colors.border.subtle }]}>
      <ChevronsDownIcon size={14} color={armed ? colors.accent : colors.icon.dim} strokeWidth={2} />
      <AppText variant="caption" tone="tertiary" color={armed ? colors.accent : undefined} numberOfLines={1}>
        {armed ? t.home.releaseToPull : t.home.pullHint}
      </AppText>
    </View>
  );
}

export function RecentHandle({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t.home.recent}
      onPress={onPress}
      style={[styles.handle, { backgroundColor: colors.ground, borderColor: colors.border.subtle }]}
    >
      <ChevronUpIcon size={13} color={colors.icon.normal} strokeWidth={2} />
      <AppText variant="caption" tone="secondary" style={styles.handleLabel}>
        {t.home.recent}
      </AppText>
    </PressableScale>
  );
}

/** The PC stopped answering: the line breaks and this card sits in the gap. */
export function OfflineCard({
  name,
  onRetry,
  onPairAgain,
}: {
  name: string;
  onRetry: () => void;
  onPairAgain: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Animated.View
      entering={FadeIn.duration(260)}
      style={[styles.card, { backgroundColor: colors.surface.capsule, borderColor: colors.border.glass, boxShadow: colors.shadow.capsule }]}
    >
      <View style={styles.cardHead}>
        <IconTile icon={MoonIcon} tint={colors.status.warn} wash={colors.status.warnWash} />
        <View style={styles.text}>
          <AppText variant="body" style={styles.strong}>
            {format(t.home.offlineTitle, { name })}
          </AppText>
          <AppText variant="caption" tone="secondary">
            {t.home.offlineBody}
          </AppText>
        </View>
      </View>
      <View style={styles.cardActions}>
        <CardButton icon={RotateIcon} label={t.common.tryAgain} onPress={onRetry} strong />
        <CardButton label={t.home.pairAgain} onPress={onPairAgain} />
      </View>
      <PressableScale accessibilityRole="link" onPress={() => void Linking.openSettings()} style={styles.link}>
        <AppText variant="caption" tone="tertiary">
          {t.home.localNetworkSettings}
        </AppText>
      </PressableScale>
    </Animated.View>
  );
}

/** The PC rejected the token: the only way forward is its new code. */
export function UnauthorizedCard({ name, onScan }: { name: string; onScan: () => void }) {
  const { colors } = useTheme();
  return (
    <Animated.View
      entering={FadeIn.duration(260)}
      style={[styles.card, { backgroundColor: colors.surface.capsule, borderColor: colors.border.glass, boxShadow: colors.shadow.capsule }]}
    >
      <View style={styles.cardHead}>
        <IconTile icon={ShieldIcon} tint={colors.status.error} wash={colors.status.errorWash} />
        <View style={styles.text}>
          <AppText variant="body" style={styles.strong}>
            {format(t.home.unauthorizedTitle, { name })}
          </AppText>
          <AppText variant="caption" tone="secondary">
            {t.home.unauthorizedBody}
          </AppText>
        </View>
      </View>
      <View style={styles.cardActions}>
        <CardButton label={t.home.scanNewCode} onPress={onScan} strong />
      </View>
    </Animated.View>
  );
}

function CardButton({
  label,
  onPress,
  icon: Icon,
  strong = false,
}: {
  label: string;
  onPress: () => void;
  icon?: ComponentType<IconProps>;
  strong?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.cardButton,
        strong
          ? { backgroundColor: colors.surface.raised, borderColor: colors.border.raised }
          : { borderColor: colors.border.subtle },
      ]}
    >
      {Icon ? <Icon size={15} color={colors.icon.normal} strokeWidth={2} /> : null}
      <AppText variant="body" tone={strong ? 'primary' : 'secondary'} style={strong && styles.strong} numberOfLines={1}>
        {label}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  capsule: {
    width: '84%',
    maxWidth: 340,
    minHeight: 60,
    borderRadius: radius.capsule,
    borderWidth: 1,
    paddingLeft: 12,
    paddingRight: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  received: { width: '76%', maxWidth: 310, minHeight: 54 },
  tile: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0, gap: 2 },
  tabular: { fontVariant: ['tabular-nums'] },
  strong: { fontWeight: '600' },
  hit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  round: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginLeft: 4 },
  hint: {
    minHeight: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingLeft: 10,
    paddingRight: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  handle: {
    minHeight: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingLeft: 13,
    paddingRight: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  handleLabel: { fontWeight: '600' },
  card: {
    width: '86%',
    maxWidth: 350,
    borderRadius: radius.card,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardActions: { flexDirection: 'row', gap: 8 },
  cardButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 10,
  },
  link: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
});
