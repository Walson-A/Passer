import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActivityRow } from '@/components/activity-row';
import { CopiedPanel } from '@/components/copied-panel';
import { DeviceGlyph } from '@/components/device-glyph';
import { ClipboardDownIcon, FileIcon, ImageIcon, QrIcon, SlidersIcon } from '@/components/icons';
import { ReachLine } from '@/components/reach-line';
import { AppText } from '@/components/ui/app-text';
import { StatusScrim } from '@/components/ui/status-scrim';
import { Disc } from '@/components/ui/disc';
import { HeaderButton, LargeHeader } from '@/components/ui/header';
import { Group } from '@/components/ui/list';
import { EmptyState, Notice } from '@/components/ui/notice';
import { ACTION_LIFETIME_MS, type AppAction } from '@/core/app-actions';
import { format, t } from '@/i18n';
import { readClipboard } from '@/platform/clipboard';
import { haptic } from '@/platform/haptics';
import { deletePhoto, latestScreenshot, pickFiles, pickPhotos, shareFile } from '@/platform/media';
import { takeAction, usePendingAction } from '@/state/actions';
import { roleOf, useDevices } from '@/state/devices';
import { useHistory } from '@/state/history';
import { useSettings } from '@/state/settings';
import { useTransfers } from '@/state/transfers';
import { useTheme } from '@/theme/theme';
import { formatBytes } from '@/utils/format';

/** Notices and failures step aside on their own; a landed transfer stays until the next one. */
const MESSAGE_LIFETIME_MS = 6_000;
const RECENT = 3;

/**
 * Send: the device things go to, what was copied, then photos, files and the other
 * device's clipboard. One tap from opening the app to the PC.
 */
export default function SendScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const devices = useDevices();
  const { available, phase, target, reach, others, me, received } = devices;
  const transfers = useTransfers();
  const { active, outcome } = transfers;
  const { items } = useHistory();
  const { settings } = useSettings();

  const reachable = target ? reach[target.id] !== 'unreachable' : false;
  // What the destination lets this phone ask for; an older core says nothing, and then every command shows.
  const offered = target ? devices.offers[target.id] : undefined;
  const offers = (name: string) => !offered || offered.some((offer) => offer.name === name);
  const canWrite = offers('clipboard.write');
  const canFile = offers('file.drop') || offers('file.receive');
  const canRead = offers('clipboard.read');
  const readOffer = offered?.find((offer) => offer.name === 'clipboard.read');
  const busy = active !== null;

  useEffect(() => {
    if (outcome?.kind !== 'notice' && outcome?.kind !== 'failed') return;
    const timer = setTimeout(transfers.dismissOutcome, MESSAGE_LIFETIME_MS);
    return () => clearTimeout(timer);
  }, [outcome, transfers.dismissOutcome]);

  const choosePhotos = async () => {
    const photos = await pickPhotos();
    if (photos.length === 0) return;
    // A choice only where a photo can go onto the PC clipboard.
    const toClipboard = transfers.direct || transfers.imagesToClipboard;
    if (toClipboard && !settings.photoDestination) {
      transfers.setPendingPhotos(photos);
      router.push('/destination');
      return;
    }
    void transfers.sendPhotos(photos, toClipboard ? (settings.photoDestination ?? 'passboard') : 'passboard');
  };

  const chooseFiles = async () => {
    const files = await pickFiles();
    if (files.length > 0) void transfers.sendFiles(files);
  };

  /** What a widget or a control asked for, run here so the transfer is seen. */
  const runAction = async (action: AppAction) => {
    switch (action) {
      case 'pull':
        await transfers.pull();
        return;
      case 'send-photo':
        await choosePhotos();
        return;
      case 'send-file':
        await chooseFiles();
        return;
      case 'send-clipboard': {
        // Reading shows the iOS paste alert: not for a device that can't receive.
        if (!transfers.ensureReachable()) return;
        const content = await readClipboard();
        if (content.kind === 'text') await transfers.sendText(content.text);
        else if (content.kind === 'image') await transfers.sendPastedImage(content.dataUri);
        else {
          haptic.warning();
          transfers.inform(t.transfer.phoneClipboardEmpty);
        }
        return;
      }
      case 'send-screenshot':
      case 'send-and-delete-screenshot': {
        if (!transfers.ensureReachable()) return;
        const found = await latestScreenshot();
        if (found === null || found === 'denied') {
          haptic.warning();
          transfers.inform(found === 'denied' ? t.transfer.photosDenied : t.transfer.noScreenshot);
          return;
        }
        // A screenshot goes to the PC clipboard when it can, ready to paste, as the Shortcuts action does.
        const sent = await transfers.sendPhotos(
          [found.photo],
          transfers.direct || transfers.imagesToClipboard ? 'clipboard' : 'passboard',
        );
        if (sent && action === 'send-and-delete-screenshot' && (await deletePhoto(found.assetId))) {
          transfers.inform(t.transfer.screenshotDeleted);
        }
      }
    }
  };

  const pendingAction = usePendingAction();
  useEffect(() => {
    if (!pendingAction || phase !== 'ready' || !target) return;
    takeAction(pendingAction.key);
    if (Date.now() - pendingAction.at > ACTION_LIFETIME_MS) return;
    if (router.canDismiss()) router.dismissAll();
    void runAction(pendingAction.action);
  }, [pendingAction, phase, target, router, runAction]);

  const recent = items.slice(0, RECENT);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ backgroundColor: colors.ground }}
        contentContainerStyle={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom + 110 }]}
        contentInsetAdjustmentBehavior="never"
      >
        <LargeHeader
          title={t.send.title}
          right={
            <HeaderButton label={t.send.settings} onPress={() => router.push('/settings')}>
              <SlidersIcon size={20} color={colors.icon.normal} strokeWidth={1.9} />
            </HeaderButton>
          }
        />

        {!available ? (
          <Notice tone="warn" title={t.send.unavailableTitle} body={t.send.unavailableBody} />
        ) : phase === 'loading' ? (
          <SendSkeleton />
        ) : phase === 'failed' ? (
          <Notice
            tone="error"
            title={t.devices.loadFailedTitle}
            detail={devices.loadError ?? undefined}
            actions={[{ label: t.common.retry, onPress: devices.reload, tone: 'quiet' }]}
          />
        ) : !target ? (
          <EmptyState
            icon={QrIcon}
            title={t.send.aloneTitle}
            body={t.send.aloneBody}
            action={{
              label: t.send.aloneAction,
              onPress: () => (me?.approver ? router.push('/invite') : router.navigate('/devices')),
            }}
          />
        ) : (
          <>
            {/* Where things go. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t.send.to} ${target.name}`}
              accessibilityHint={others.length > 1 ? t.send.change : undefined}
              onPress={() => (others.length > 1 ? router.push('/target') : router.navigate(`/devices/${target.id}`))}
              style={({ pressed }) => [styles.target, { backgroundColor: colors.group.cell }, pressed && styles.pressed]}
            >
              <View style={styles.targetTop}>
                <AppText variant="footnote" tone="secondary" style={styles.flex}>
                  {t.send.to}
                </AppText>
                {others.length > 1 ? (
                  <AppText variant="subhead" color={colors.link}>
                    {t.send.change}
                  </AppText>
                ) : null}
              </View>
              <View style={styles.targetRow}>
                <DeviceGlyph id={target.id} name={target.name} kind={target.kind} size={60} dim={!reachable} />
                <View style={styles.flex}>
                  {/* A long name may wrap at its hyphen, like any word: never cut in the middle at large text sizes. */}
                  <AppText variant="heading" numberOfLines={3}>
                    {target.name}
                  </AppText>
                  <ReachLine reach={reach[target.id]} answeredAt={target.answeredAt} suffix={target.approver ? roleOf(target) : undefined} />
                </View>
              </View>
            </Pressable>

            {/* What happened, what is happening. */}
            {received ? (
              <Notice
                tone="ok"
                title={format(received.kind === 'text' ? t.received.text : t.received.file, {
                  name: received.agent
                    ? format(t.received.agentVia, { agent: received.agent, name: received.from })
                    : received.from,
                })}
                body={received.kind === 'text' ? t.received.textBody : `${received.name} · ${formatBytes(received.size)}`}
                onClose={devices.dismissReceived}
                actions={
                  received.kind === 'file'
                    ? [
                        {
                          label: t.transfer.share,
                          onPress: () =>
                            void shareFile(received.uri, { mimeType: 'application/octet-stream', uti: 'public.data' }),
                        },
                      ]
                    : []
                }
              />
            ) : null}
            {reach[target.id] === 'unreachable' && !busy ? (
              <Notice
                tone="warn"
                title={format(t.send.unreachableTitle, { name: target.name })}
                body={t.send.unreachableBody}
                actions={[{ label: t.common.retry, onPress: () => devices.probe(target.id), tone: 'quiet' }]}
              />
            ) : null}
            {active ? <TransferNotice /> : outcome ? <OutcomeNotice /> : null}

            {canWrite ? (
              <CopiedPanel
                peer={target.name}
                disabled={busy || !reachable}
                onText={(text) => void transfers.sendText(text)}
                onImage={(dataUri) => void transfers.sendPastedImage(dataUri)}
              />
            ) : null}

            {canFile || canRead ? (
              <View style={styles.discs}>
                {canFile ? (
                  <Disc icon={ImageIcon} label={t.send.photo} onPress={() => void choosePhotos()} disabled={busy || !reachable} />
                ) : null}
                {canFile ? (
                  <Disc icon={FileIcon} label={t.send.file} onPress={() => void chooseFiles()} disabled={busy || !reachable} />
                ) : null}
                {canRead ? (
                  <Disc
                    icon={ClipboardDownIcon}
                    label={t.send.theirClipboard}
                    locked={readOffer ? readOffer.needsApproval : true}
                    lockedLabel={t.send.asksFirst}
                    onPress={() => void transfers.pull()}
                    disabled={busy || !reachable}
                  />
                ) : null}
              </View>
            ) : null}
            {!canWrite && !canFile && !canRead ? (
              <AppText variant="callout" tone="secondary" style={styles.center}>
                {format(t.send.nothingOffered, { name: target.name })}
              </AppText>
            ) : null}
            {!reachable ? (
              <AppText variant="footnote" tone="secondary" style={styles.center}>
                {format(t.send.paused, { name: target.name })}
              </AppText>
            ) : null}

            {recent.length > 0 ? (
              <Group
                header={t.send.recent}
                footer={
                  <Pressable accessibilityRole="button" onPress={() => router.navigate('/activity')} hitSlop={8}>
                    <AppText variant="subhead" color={colors.link}>
                      {t.send.seeAll}
                    </AppText>
                  </Pressable>
                }
              >
                {recent.map((item) => (
                  <ActivityRow key={item.id} item={item} />
                ))}
              </Group>
            ) : null}
          </>
        )}
      </ScrollView>
      <StatusScrim />
    </View>
  );
}

function TransferNotice() {
  const { colors } = useTheme();
  const { active, cancel } = useTransfers();
  if (!active) return null;
  const ratio = active.total > 0 ? Math.min(1, active.sent / active.total) : null;
  const title = active.waiting
    ? active.title
    : active.count > 1
      ? `${active.direction === 'up' ? t.transfer.sending : t.transfer.receiving} · ${format(t.transfer.itemOf, { index: active.index + 1, count: active.count })}`
      : active.direction === 'up'
        ? t.transfer.sending
        : t.transfer.receiving;
  const body = active.waiting
    ? format(t.transfer.waitingApprovalBody, { name: active.peer })
    : ratio !== null
      ? `${active.title} · ${format(t.transfer.progress, { sent: formatBytes(active.sent), total: formatBytes(active.total) })}`
      : active.title;
  return (
    <Notice
      tone="busy"
      title={title}
      body={body}
      actions={active.cancellable ? [{ label: t.transfer.cancel, onPress: cancel, tone: 'quiet' }] : []}
    >
      {ratio !== null ? (
        <View
          style={[styles.track, { backgroundColor: colors.border.subtle }]}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}
        >
          <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: colors.link }]} />
        </View>
      ) : null}
    </Notice>
  );
}

function OutcomeNotice() {
  const { outcome, dismissOutcome } = useTransfers();
  if (!outcome) return null;
  if (outcome.kind === 'landed') {
    return <Notice tone="ok" title={outcome.message} body={outcome.note ?? outcome.item.title} onClose={dismissOutcome} />;
  }
  return (
    <Notice
      tone={outcome.kind === 'failed' ? 'error' : 'info'}
      title={outcome.message}
      body={outcome.kind === 'failed' ? (outcome.body ?? undefined) : undefined}
      onClose={dismissOutcome}
    />
  );
}

/** The shape of Send while the device opens, never an empty screen. */
function SendSkeleton() {
  const { colors } = useTheme();
  const block = { backgroundColor: colors.surface.raised };
  return (
    <View style={styles.skeleton} accessibilityLabel={t.send.loadingTitle} accessible>
      <View style={[styles.skeletonCard, block]} />
      <View style={[styles.skeletonLine, block]} />
      <View style={[styles.skeletonButton, block]} />
      <View style={styles.discs}>
        {[0, 1, 2].map((key) => (
          <View key={key} style={[styles.skeletonDisc, block]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 20 },
  flex: { flex: 1, gap: 2 },
  target: { marginHorizontal: 16, borderRadius: 22, padding: 16, gap: 8 },
  targetTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  targetRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  pressed: { opacity: 0.8 },
  discs: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 12, gap: 8 },
  center: { textAlign: 'center', paddingHorizontal: 24, marginTop: -8 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  skeleton: { gap: 20 },
  skeletonCard: { marginHorizontal: 16, height: 92, borderRadius: 22 },
  skeletonLine: { marginHorizontal: 16, height: 18, width: '60%', borderRadius: 9 },
  skeletonButton: { marginHorizontal: 16, height: 62, borderRadius: 31 },
  skeletonDisc: { width: 68, height: 68, borderRadius: 34 },
});
