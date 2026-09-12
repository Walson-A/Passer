import { Redirect, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Branches } from '@/components/conduit/branches';
import {
  MessageCapsule,
  OfflineCard,
  PullHint,
  ReceivedCapsule,
  RecentHandle,
  TransferCapsule,
  UnauthorizedCard,
} from '@/components/conduit/capsules';
import { ConduitLine, type LineMode, type Travel } from '@/components/conduit/conduit-line';
import { LaunchPad, type PadMode } from '@/components/conduit/launch-pad';
import { PcNode, type NodeStatus } from '@/components/conduit/pc-node';
import { Sockets, type SocketContent, type SocketName } from '@/components/conduit/sockets';
import { SlidersIcon } from '@/components/icons';
import { PressableScale } from '@/components/ui/pressable-scale';
import type { PairedPc } from '@/core/types';
import { format, t } from '@/i18n';
import { haptic } from '@/platform/haptics';
import { pickFiles, pickPhotos } from '@/platform/media';
import { useConnection } from '@/state/connection';
import { latest, useHistory, type HistoryItem } from '@/state/history';
import { usePairings } from '@/state/pairings';
import { useSettings } from '@/state/settings';
import { useTransfers } from '@/state/transfers';
import { useTheme } from '@/theme/theme';
import { formatRelative } from '@/utils/format';

/** How far the conduit must be pulled to fetch the PC clipboard. */
const PULL_THRESHOLD = 72;
/** Notices and failures step aside on their own. */
const MESSAGE_LIFETIME_MS = 4_000;

export default function HomeRoute() {
  const { ready, pc } = usePairings();
  const { colors } = useTheme();
  if (!ready) return <View style={[styles.screen, { backgroundColor: colors.ground }]} />;
  if (!pc) return <Redirect href="/welcome" />;
  return <Home pc={pc} />;
}

function socketContent(item: HistoryItem | null): SocketContent {
  return item ? { title: item.title, meta: formatRelative(item.at) } : null;
}

function Home({ pc }: { pc: PairedPc }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { connection, retry } = useConnection();
  const { items } = useHistory();
  const { settings } = useSettings();
  const transfers = useTransfers();
  const { active, outcome, dismissOutcome } = transfers;

  const status: NodeStatus =
    connection.status === 'online'
      ? 'online'
      : connection.status === 'offline'
        ? 'offline'
        : connection.status === 'unauthorized'
          ? 'unauthorized'
          : 'searching';

  let statusText: string;
  if (connection.status === 'online') {
    const address = connection.endpoint.address === 'host' ? pc.host : pc.ip;
    statusText = format(t.home.connected, { address: address ?? '' });
  } else if (connection.status === 'offline') {
    statusText = connection.lastSeen
      ? format(t.home.lastSeen, { time: formatRelative(connection.lastSeen) })
      : t.home.offline;
  } else if (connection.status === 'unauthorized') {
    statusText = t.home.refused;
  } else {
    statusText = format(t.home.searching, { name: pc.name });
  }

  const lineMode: LineMode = status === 'online' ? 'online' : status === 'searching' ? 'searching' : 'offline';
  const padMode: PadMode = status === 'online' ? 'ready' : status === 'searching' ? 'searching' : 'paused';

  const clipboardItem = latest(items, pc.key, 'pc-clipboard');
  const passboardItem = latest(items, pc.key, 'passboard');
  const receivedItem = items.find((item) => item.pcKey === pc.key && item.direction === 'received') ?? null;

  const uploading: SocketName | null =
    active?.direction === 'up' ? (active.destination === 'passboard' ? 'passboard' : 'clipboard') : null;
  const percent = active && active.total > 0 ? Math.round((active.sent / active.total) * 100) : null;
  const inFlight: SocketContent = active
    ? { title: active.title, meta: percent === null ? t.transfer.sending : `${t.transfer.receiving} · ${percent}%` }
    : null;

  const newestSent =
    clipboardItem && passboardItem
      ? clipboardItem.at >= passboardItem.at
        ? 'clipboard'
        : 'passboard'
      : clipboardItem
        ? 'clipboard'
        : passboardItem
          ? 'passboard'
          : null;

  const landing = outcome?.kind === 'landed' && outcome.socket ? { socket: outcome.socket, key: outcome.key } : null;
  const travel: Travel | null =
    outcome && (outcome.kind === 'landed' || outcome.kind === 'pulled-image' || outcome.kind === 'pulled-files')
      ? { key: outcome.key, direction: outcome.direction }
      : null;

  useEffect(() => {
    if (outcome?.kind !== 'notice' && outcome?.kind !== 'failed') return;
    const timer = setTimeout(dismissOutcome, MESSAGE_LIFETIME_MS);
    return () => clearTimeout(timer);
  }, [outcome, dismissOutcome]);

  const choosePhotos = async () => {
    const photos = await pickPhotos();
    if (photos.length === 0) return;
    if (settings.photoDestination) {
      void transfers.sendPhotos(photos, settings.photoDestination);
    } else {
      transfers.setPendingPhotos(photos);
      router.push('/destination');
    }
  };

  const chooseFiles = async () => {
    const files = await pickFiles();
    if (files.length > 0) void transfers.sendFiles(files);
  };

  // Pull the conduit down to fetch the PC clipboard.
  const pullOffset = useSharedValue(0);
  const [armed, setArmed] = useState(false);
  const armedRef = useRef(false);
  const canPull = status === 'online' && !active;

  const pullGesture = Gesture.Pan()
    .runOnJS(true)
    .enabled(canPull)
    .activeOffsetY(14)
    .failOffsetX([-24, 24])
    .onUpdate((event) => {
      const distance = Math.max(0, event.translationY);
      pullOffset.set(Math.min(distance, PULL_THRESHOLD * 1.5) * 0.45);
      const nextArmed = distance >= PULL_THRESHOLD;
      if (nextArmed !== armedRef.current) {
        armedRef.current = nextArmed;
        setArmed(nextArmed);
        if (nextArmed) haptic.select();
      }
    })
    .onEnd(() => {
      pullOffset.set(withSpring(0, { damping: 16, stiffness: 220 }));
      if (armedRef.current) void transfers.pull();
      armedRef.current = false;
      setArmed(false);
    });

  const hintStyle = useAnimatedStyle(() => ({ transform: [{ translateY: pullOffset.get() }] }));

  const pulled = outcome && (outcome.kind === 'pulled-image' || outcome.kind === 'pulled-files') ? outcome : null;

  return (
    <View style={[styles.screen, { backgroundColor: colors.ground, paddingTop: insets.top + 12 }]}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t.home.settings}
        onPress={() => router.push('/settings')}
        style={[
          styles.settings,
          { top: insets.top + 6, backgroundColor: colors.surface.raised, borderColor: colors.border.raised },
        ]}
      >
        <SlidersIcon size={18} color={colors.icon.normal} />
      </PressableScale>

      <PcNode
        name={pc.name}
        status={status}
        statusText={statusText}
        nameHint={t.home.nameHint}
        onPressName={() => router.push('/settings')}
      />

      <View style={styles.socketsGap} />
      <Sockets
        clipboard={uploading === 'clipboard' ? inFlight : socketContent(clipboardItem)}
        passboard={uploading === 'passboard' ? inFlight : socketContent(passboardItem)}
        lit={status === 'online' ? newestSent : null}
        receiving={uploading}
        landing={landing}
        dimmed={status === 'offline' || status === 'unauthorized'}
      />
      <Branches lit={status === 'online' ? newestSent : null} receiving={uploading} dimmed={status !== 'online'} />

      <GestureDetector gesture={pullGesture}>
        <View style={styles.conduit}>
          <ConduitLine
            mode={lineMode}
            progress={active && active.total > 0 ? { direction: active.direction, value: active.sent / active.total } : null}
            travel={travel}
          >
            {status === 'offline' ? (
              <View style={styles.centerSlot} pointerEvents="box-none">
                <OfflineCard name={pc.name} onRetry={retry} onPairAgain={() => router.push('/scan')} />
              </View>
            ) : status === 'unauthorized' ? (
              <View style={styles.centerSlot} pointerEvents="box-none">
                <UnauthorizedCard name={pc.name} onScan={() => router.push('/scan')} />
              </View>
            ) : (
              <>
                <Animated.View style={[styles.topSlot, hintStyle]} pointerEvents="none">
                  {status === 'online' && !active ? <PullHint armed={armed} /> : null}
                </Animated.View>
                <View style={styles.centerSlot} pointerEvents="box-none">
                  {active ? (
                    <TransferCapsule transfer={active} onCancel={transfers.cancel} />
                  ) : outcome?.kind === 'failed' || outcome?.kind === 'notice' ? (
                    <MessageCapsule
                      message={outcome.message}
                      tone={outcome.kind === 'failed' ? 'error' : 'notice'}
                      onDismiss={dismissOutcome}
                    />
                  ) : null}
                </View>
                <View style={styles.receivedSlot} pointerEvents="box-none">
                  {receivedItem && !active ? (
                    <ReceivedCapsule
                      item={receivedItem}
                      onSave={pulled?.kind === 'pulled-image' ? () => void transfers.saveImage(pulled.fileUri) : undefined}
                      onShare={pulled?.kind === 'pulled-files' ? () => void transfers.shareFiles(pulled.fileUri) : undefined}
                    />
                  ) : null}
                </View>
              </>
            )}
            <View style={styles.recentSlot} pointerEvents="box-none">
              <RecentHandle onPress={() => router.push('/recent')} />
            </View>
          </ConduitLine>
        </View>
      </GestureDetector>

      <LaunchPad
        mode={padMode}
        pcName={pc.name}
        bottomInset={insets.bottom}
        onPasteText={(text) => void transfers.sendText(text)}
        onPasteImage={(dataUri) => void transfers.sendPastedImage(dataUri)}
        onPhoto={() => void choosePhotos()}
        onFromPc={() => void transfers.pull()}
        onFile={() => void chooseFiles()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  settings: {
    position: 'absolute',
    right: 16,
    zIndex: 2,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socketsGap: { height: 18 },
  conduit: { flex: 1 },
  topSlot: { position: 'absolute', top: 14, left: 0, right: 0, alignItems: 'center' },
  centerSlot: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  receivedSlot: { position: 'absolute', bottom: 64, left: 0, right: 0, alignItems: 'center' },
  recentSlot: { position: 'absolute', bottom: 6, left: 0, right: 0, alignItems: 'center' },
});
