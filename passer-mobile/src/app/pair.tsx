import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, type ComponentType } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CheckIcon, LaptopIcon, ScanIcon, ShieldIcon, SmartphoneIcon, WifiIcon, type IconProps } from '@/components/icons';
import { AppText } from '@/components/ui/app-text';
import { PressableScale } from '@/components/ui/pressable-scale';
import { PrimaryButton } from '@/components/ui/primary-button';
import { locate } from '@/core/endpoint';
import { PasserError } from '@/core/errors';
import { parsePairingLink, type PairingParseError } from '@/core/pairing';
import type { PairedPc } from '@/core/types';
import { format, t } from '@/i18n';
import { haptic } from '@/platform/haptics';
import { usePairings } from '@/state/pairings';
import { useTheme } from '@/theme/theme';
import { motion, radius } from '@/theme/tokens';

type Params = Partial<Record<'link' | 'v' | 'name' | 'host' | 'ip' | 'port' | 'token' | 'id', string>>;

type FailureReason = 'link' | 'network' | 'identity';

type Phase =
  | { step: 'connecting'; name: string }
  | { step: 'paired'; name: string }
  | { step: 'failed'; title: string; body: string; reason: FailureReason };

/** How long the paired state stays on screen before the home screen takes over. */
const PAIRED_HOLD_MS = 1_800;
const LINE_HEIGHT = 112;

/** Rebuilds the link when the app was opened by a `passer://pair?…` URL rather than the scanner. */
function linkFrom(params: Params): string {
  if (params.link) return params.link;
  const query = (['v', 'name', 'host', 'ip', 'port', 'token', 'id'] as const)
    .filter((key) => typeof params[key] === 'string')
    .map((key) => `${key}=${encodeURIComponent(params[key] as string)}`)
    .join('&');
  return `passer://pair?${query}`;
}

function linkFailure(error: PairingParseError): Phase {
  if (error === 'newer-version') return { step: 'failed', title: t.pair.newerTitle, body: t.pair.newerBody, reason: 'link' };
  if (error === 'not-a-pairing-link') return { step: 'failed', title: t.pair.invalidTitle, body: t.pair.invalidBody, reason: 'link' };
  return { step: 'failed', title: t.pair.incompleteTitle, body: t.pair.incompleteBody, reason: 'link' };
}

function connectionFailure(error: unknown, name: string): Phase {
  const kind = error instanceof PasserError ? error.kind : 'unreachable';
  if (kind === 'wrong-pc') {
    return { step: 'failed', title: t.pair.wrongPcTitle, body: format(t.pair.wrongPcBody, { name }), reason: 'identity' };
  }
  if (kind === 'not-passer') {
    return { step: 'failed', title: t.pair.notPasserTitle, body: t.pair.notPasserBody, reason: 'identity' };
  }
  return { step: 'failed', title: format(t.pair.unreachableTitle, { name }), body: t.pair.unreachableBody, reason: 'network' };
}

/**
 * Verifies a scanned or pasted pairing before anything is stored: the PC must
 * answer `/ping` as the machine the code came from. This first local connection
 * is also what triggers the iOS Local Network prompt primed on the welcome screen.
 */
export default function Pair() {
  const link = linkFrom(useLocalSearchParams() as Params);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { savePairing } = usePairings();
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<Phase>(() => {
    const parsed = parsePairingLink(link);
    return parsed.ok ? { step: 'connecting', name: parsed.payload.name } : linkFailure(parsed.error);
  });

  useEffect(() => {
    const parsed = parsePairingLink(link);
    if (!parsed.ok) {
      setPhase(linkFailure(parsed.error));
      haptic.error();
      return;
    }
    const { payload } = parsed;
    const controller = new AbortController();
    setPhase({ step: 'connecting', name: payload.name });

    const candidate: PairedPc = {
      key: 'pending',
      id: payload.id,
      name: payload.name,
      host: payload.host,
      ip: payload.ip,
      port: payload.port,
      pairedAt: 0,
      preferredAddress: 'host',
    };

    locate(candidate, controller.signal)
      .then(async (endpoint) => {
        await savePairing(payload, endpoint);
        if (controller.signal.aborted) return;
        haptic.success();
        setPhase({ step: 'paired', name: endpoint.ping.name ?? endpoint.ping.host });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        haptic.error();
        setPhase(connectionFailure(error, payload.name));
      });

    return () => controller.abort();
  }, [link, attempt]);

  const goHome = () => router.dismissTo('/');

  useEffect(() => {
    if (phase.step !== 'paired') return;
    const timer = setTimeout(() => router.dismissTo('/'), PAIRED_HOLD_MS);
    return () => clearTimeout(timer);
  }, [phase.step, router]);

  const title =
    phase.step === 'connecting'
      ? format(t.pair.connectingTitle, { name: phase.name })
      : phase.step === 'paired'
        ? format(t.pair.pairedTitle, { name: phase.name })
        : phase.title;
  const body =
    phase.step === 'connecting' ? t.pair.connectingBody : phase.step === 'paired' ? t.pair.pairedBody : phase.body;

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: colors.ground, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 },
      ]}
    >
      <View style={styles.stage}>
        {phase.step === 'failed' ? <FailureMark reason={phase.reason} /> : <PairingConduit step={phase.step} />}
        <Animated.View key={phase.step} entering={FadeIn.duration(motion.duration.reveal)} style={styles.copy}>
          <AppText variant="pcName" accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.center}>
            {title}
          </AppText>
          <AppText variant="body" tone="secondary" style={styles.center}>
            {body}
          </AppText>
        </Animated.View>
      </View>

      <View style={styles.actions}>
        {phase.step === 'paired' ? <PrimaryButton label={t.pair.start} onPress={goHome} /> : null}
        {phase.step === 'failed' && phase.reason === 'network' ? (
          <>
            <PrimaryButton label={t.common.tryAgain} onPress={() => setAttempt((value) => value + 1)} />
            <PrimaryButton label={t.common.openSettings} tone="quiet" onPress={() => void Linking.openSettings()} />
          </>
        ) : null}
        {phase.step === 'failed' ? (
          <PressableScale accessibilityRole="button" onPress={() => router.replace('/scan')} style={styles.quiet}>
            <AppText variant="body" tone="secondary">
              {t.pair.scanAgain}
            </AppText>
          </PressableScale>
        ) : null}
        {phase.step === 'connecting' ? (
          <PressableScale accessibilityRole="button" onPress={() => router.back()} style={styles.quiet}>
            <AppText variant="body" tone="tertiary">
              {t.common.cancel}
            </AppText>
          </PressableScale>
        ) : null}
      </View>
    </View>
  );
}

/** The home screen's conduit in miniature: the PC above, this iPhone below, content travelling between. */
function PairingConduit({ step }: { step: 'connecting' | 'paired' }) {
  const { colors, scheme } = useTheme();
  const reduceMotion = useReducedMotion();
  const travel = useSharedValue(0);
  const ring = useSharedValue(0);

  useEffect(() => {
    if (step === 'connecting' && !reduceMotion) {
      travel.set(0);
      travel.set(withRepeat(withTiming(1, { duration: 1100, easing: Easing.bezier(...motion.easing.travel) }), -1, false));
    } else {
      cancelAnimation(travel);
      travel.set(0);
    }
    if (step === 'paired') {
      ring.set(0);
      ring.set(withTiming(1, { duration: 900, easing: Easing.bezier(...motion.easing.outExpo) }));
    }
  }, [step, reduceMotion, travel, ring]);

  const cometStyle = useAnimatedStyle(() => {
    const along = travel.get();
    return {
      opacity: step === 'connecting' ? Math.sin(along * Math.PI) : 0,
      transform: [{ translateY: (1 - along) * (LINE_HEIGHT - 32) }],
    };
  });
  const ringStyle = useAnimatedStyle(() => ({
    opacity: (1 - ring.get()) * 0.8,
    transform: [{ scale: 1 + ring.get() * 0.7 }],
  }));

  const paired = step === 'paired';

  return (
    <View style={styles.conduit} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.pc}>
        {paired ? <Animated.View style={[styles.ring, { borderColor: colors.status.ok }, ringStyle]} /> : null}
        <View
          style={[
            styles.tile,
            {
              backgroundColor: colors.surface.raised,
              borderColor: paired ? colors.status.okBorder : colors.border.raised,
              boxShadow: colors.shadow.tile,
            },
          ]}
        >
          <LaptopIcon size={30} color={colors.text.primary} strokeWidth={1.5} />
        </View>
        {paired ? (
          <Animated.View entering={ZoomIn.springify().damping(13)} style={[styles.badge, { backgroundColor: colors.status.ok }]}>
            <CheckIcon size={13} color={scheme === 'dark' ? '#0F0F0F' : '#FFFFFF'} strokeWidth={3} />
          </Animated.View>
        ) : null}
      </View>

      <View style={[styles.line, { backgroundColor: paired ? colors.status.okBorder : colors.conduit.lineIdle }]}>
        <Animated.View style={[styles.comet, { backgroundColor: colors.conduit.fill[0], boxShadow: colors.conduit.fillGlow }, cometStyle]} />
      </View>

      <View style={[styles.phone, { backgroundColor: colors.surface.card, borderColor: colors.border.subtle }]}>
        <SmartphoneIcon size={20} color={colors.icon.normal} />
      </View>
    </View>
  );
}

function FailureMark({ reason }: { reason: FailureReason }) {
  const { colors } = useTheme();
  const Icon: ComponentType<IconProps> = reason === 'network' ? WifiIcon : reason === 'identity' ? ShieldIcon : ScanIcon;
  const tint = reason === 'identity' ? colors.status.error : colors.status.warn;
  const wash = reason === 'identity' ? colors.status.errorWash : colors.status.warnWash;
  return (
    <Animated.View entering={ZoomIn.duration(260)} style={[styles.failure, { backgroundColor: wash }]}>
      <Icon size={30} color={tint} strokeWidth={1.75} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 24 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 32 },
  copy: { alignItems: 'center', gap: 8, maxWidth: 340 },
  center: { textAlign: 'center' },
  actions: { gap: 8 },
  quiet: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  conduit: { alignItems: 'center' },
  pc: { alignItems: 'center', justifyContent: 'center' },
  tile: {
    width: 68,
    height: 68,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: { position: 'absolute', width: 68, height: 68, borderRadius: 22, borderWidth: 2 },
  badge: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: { width: 2, height: LINE_HEIGHT, marginVertical: 10, borderRadius: 1, overflow: 'visible' },
  comet: { position: 'absolute', left: -1, width: 4, height: 32, borderRadius: 2 },
  phone: {
    width: 44,
    height: 44,
    borderRadius: radius.button,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  failure: { width: 76, height: 76, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
