import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { CountdownRing, useSecondsLeft } from '@/components/countdown-ring';
import { KeyboardIcon, LockIcon, TurnIcon, XIcon } from '@/components/icons';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { classifyCallError } from '@/core/device-calls';
import {
  decodeJson,
  keyPress,
  parseEvent,
  SPECIAL_KEYS,
  touchToDisplay,
  windowToStage,
  videoRect,
  type ViewerMessage,
} from '@/core/screen-protocol';
import { format, t } from '@/i18n';
import { announce } from '@/platform/accessibility';
import { provePresence } from '@/platform/biometrics';
import { haptic } from '@/platform/haptics';
import { useDevices } from '@/state/devices';
import { ThemeProvider } from '@/theme/theme';

import { PasserCore, ScreenView, screenSupported, type ScreenNativeEvent } from '../../../modules/passer-core';

/** passer-core waits this long for the other device's user before it counts as a no. */
const APPROVAL_SECONDS = 60;
/** Pointer moves are sent at most this often while a finger drags. */
const MOVE_EVERY_MS = 33;

/** The screen is always dark, whatever the theme: it frames a picture. */
const INK = {
  ground: '#000000',
  bar: 'rgba(20,20,22,0.92)',
  text: '#FFFFFF',
  dim: 'rgba(255,255,255,0.68)',
  control: 'rgba(255,255,255,0.14)',
  warn: '#FCD34D',
};

type Phase =
  | { step: 'proving' }
  | { step: 'proof'; kind: 'cancelled' | 'no-code' | 'failed' }
  | { step: 'waiting'; since: number }
  | { step: 'failed'; message: string }
  | { step: 'live' }
  | { step: 'ended'; reason: string };

const core = PasserCore.module;

let sessions = 0;

/**
 * Another device's screen, live (Vasistas over passer-core: `screen.view` or `screen.control`).
 * Face ID or the phone's code first, then the other device's user accepts (unless its owner
 * switched that off), then the picture. Tap clicks, holding right-clicks, dragging drags, two
 * fingers scroll; the keyboard types text and the keys a phone keyboard lacks.
 */
export default function ScreenRoute() {
  return (
    <ThemeProvider scheme="dark">
      <ScreenViewer />
    </ThemeProvider>
  );
}

function ScreenViewer() {
  const { id, control: controlParam } = useLocalSearchParams<{
    id: string;
    control?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const devices = useDevices();
  const member = devices.status?.members.find((one) => one.id === id) ?? null;
  const wantsControl = controlParam === '1';
  const name = member?.name ?? '';

  const [phase, setPhase] = useState<Phase>({ step: 'proving' });
  const [video, setVideo] = useState<{
    width: number;
    height: number;
    control: boolean;
  } | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const [localInput, setLocalInput] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [view, setView] = useState({ width: 0, height: 0 });
  const [area, setArea] = useState({ width: 0, height: 0 });
  /** The picture turned a quarter, to use the phone's height: hold the phone sideways. */
  const [turned, setTurned] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const [modifiers, setModifiers] = useState<string[]>([]);
  const sessionId = useRef(`screen-${Date.now().toString(36)}-${(sessions += 1)}`).current;
  const opened = useRef(false);
  const lastMove = useRef(0);
  const dragging = useRef(false);
  const scrolled = useRef(0);
  const scrollFrom = useRef(0);
  const downAt = useRef({ x: 0, y: 0 });
  /** Where the picture's area sits on the window, for fingers read in window coordinates. */
  const areaAt = useRef({ x: 0, y: 0 });
  const areaView = useRef<View>(null);
  const input = useRef<TextInput>(null);
  const secondsLeft = useSecondsLeft(phase.step === 'waiting' ? phase.since + APPROVAL_SECONDS * 1000 : 0);

  const send = useCallback(
    (message: ViewerMessage) => {
      core?.screenSend?.(sessionId, JSON.stringify(message));
    },
    [sessionId],
  );

  const close = useCallback(() => {
    if (opened.current) {
      send({ type: 'release_all' });
      core?.screenClose?.(sessionId);
      opened.current = false;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/devices');
  }, [router, send, sessionId]);

  const start = useCallback(async () => {
    if (!member || !core?.screenOpen) return;
    setPhase({ step: 'proving' });
    const proof = await provePresence(
      format(wantsControl ? t.screen.proveReasonControl : t.screen.proveReason, { name: member.name }),
    );
    if (proof !== 'ok') {
      setPhase({ step: 'proof', kind: proof });
      return;
    }
    setPhase({ step: 'waiting', since: Date.now() });
    announce(format(t.screen.waiting, { name: member.name }));
    try {
      await core.screenOpen(member.id, wantsControl ? 'screen.control' : 'screen.view', '{}', sessionId);
      opened.current = true;
      haptic.success();
      setPhase({ step: 'live' });
      announce(
        format(wantsControl ? t.screen.controlling : t.screen.seeing, {
          name: member.name,
        }),
      );
    } catch (error) {
      haptic.error();
      const failure = classifyCallError(error);
      const kind = failure.kind;
      setPhase({
        step: 'failed',
        message: failure.message.includes('no_indicator')
          ? format(t.screen.noIndicator, { name: member.name })
          : kind === 'denied'
            ? format(t.transfer.denied, { name: member.name })
            : kind === 'timeout'
              ? format(t.transfer.timeout, { name: member.name })
              : kind === 'unreachable'
                ? format(t.transfer.unreachable, { name: member.name })
                : kind === 'not-offered'
                  ? format(t.transfer.notOffered, { name: member.name })
                  : t.transfer.failed,
      });
    }
  }, [member, sessionId, wantsControl]);

  // What the shared PC says, for this session only.
  useEffect(() => {
    if (!core) return;
    const subscription = core.addListener('onScreenEvent', (event: ScreenNativeEvent) => {
      if (event.sessionId !== sessionId) return;
      if (event.closed) {
        opened.current = false;
        setPhase((current) =>
          current.step === 'ended'
            ? current
            : { step: 'ended', reason: event.code === 'interrupted' ? 'interrupted' : event.error ? 'other' : 'stopped' },
        );
        return;
      }
      if (!event.json) return;
      const message = parseEvent(decodeJson(new TextEncoder().encode(event.json)));
      if (!message) return;
      switch (message.event) {
        case 'ready':
          setVideo({
            width: message.width,
            height: message.height,
            control: message.control,
          });
          break;
        case 'pointer':
          setPointer('x' in message ? { x: message.x, y: message.y } : null);
          break;
        case 'paused':
          setPaused(true);
          break;
        case 'resumed':
          setPaused(false);
          break;
        case 'local_input':
          setLocalInput(true);
          break;
        case 'refused':
          setViewOnly(true);
          break;
        case 'ended':
          opened.current = false;
          haptic.warning();
          setPhase({ step: 'ended', reason: message.reason });
          announce(t.screen.endedTitle);
          break;
      }
    });
    return () => subscription.remove();
  }, [sessionId]);

  // The keys row goes with the phone's keyboard, whatever closed it (a swipe, Android's back).
  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!localInput) return;
    const timer = setTimeout(() => setLocalInput(false), 3_000);
    return () => clearTimeout(timer);
  }, [localInput]);

  // Once, as soon as the member is known (straight after a cold start it loads first); a retry calls `start` itself.
  const started = useRef(false);
  const known = member !== null;
  useEffect(() => {
    if (!known || started.current) return;
    started.current = true;
    void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [known]);

  // Leaving by any way (close, a deep link, the system): nothing stays held down, the share ends.
  useEffect(
    () => () => {
      if (!opened.current) return;
      core?.screenSend?.(sessionId, JSON.stringify({ type: 'release_all' }));
      core?.screenClose?.(sessionId);
      opened.current = false;
    },
    [sessionId],
  );

  const canControl = phase.step === 'live' && (video?.control ?? wantsControl) && !viewOnly;
  const rect = video ? videoRect(view.width, view.height, video.width, video.height) : videoRect(view.width, view.height, 16, 9);

  /** A finger, from its position on the window (`absoluteX/Y`), to the shared display. */
  const at = (x: number, y: number) => touchToDisplay(windowToStage({ x, y }, { ...areaAt.current, ...area }, turned), rect);
  const moveTo = (x: number, y: number, force = false) => {
    const point = at(x, y);
    if (!point) return null;
    const now = Date.now();
    if (force || now - lastMove.current >= MOVE_EVERY_MS) {
      lastMove.current = now;
      send({ type: 'move', x: point.x, y: point.y });
    }
    return point;
  };
  const click = (button: 'left' | 'right', x: number, y: number) => {
    if (!moveTo(x, y, true)) return;
    haptic.tap();
    send({ type: 'button', button, down: true });
    send({ type: 'button', button, down: false });
  };

  const tap = Gesture.Tap()
    .runOnJS(true)
    .maxDuration(300)
    .maxDistance(8)
    .onEnd((event, success) => {
      if (success) click('left', event.absoluteX, event.absoluteY);
    });
  const hold = Gesture.LongPress()
    .runOnJS(true)
    .minDuration(450)
    .onStart((event) => click('right', event.absoluteX, event.absoluteY));
  const drag = Gesture.Pan()
    .runOnJS(true)
    .maxPointers(1)
    .minDistance(8)
    .onBegin((event) => {
      downAt.current = { x: event.absoluteX, y: event.absoluteY };
    })
    .onStart(() => {
      if (!moveTo(downAt.current.x, downAt.current.y, true)) return;
      dragging.current = true;
      send({ type: 'button', button: 'left', down: true });
    })
    .onUpdate((event) => {
      if (dragging.current) moveTo(event.absoluteX, event.absoluteY);
    })
    // Also runs for a pan that never started (a tap): only a real drag has a button to let go.
    .onFinalize((event) => {
      if (!dragging.current) return;
      dragging.current = false;
      moveTo(event.absoluteX, event.absoluteY, true);
      send({ type: 'button', button: 'left', down: false });
    });
  const scroll = Gesture.Pan()
    .runOnJS(true)
    .minPointers(2)
    .onStart((event) => {
      scrolled.current = 0;
      scrollFrom.current = windowToStage({ x: event.absoluteX, y: event.absoluteY }, { ...areaAt.current, ...area }, turned).y;
    })
    .onUpdate((event) => {
      // Down the picture, whichever way it is turned.
      const moved =
        windowToStage({ x: event.absoluteX, y: event.absoluteY }, { ...areaAt.current, ...area }, turned).y - scrollFrom.current;
      const step = Math.round((moved - scrolled.current) / 24);
      if (step !== 0) {
        scrolled.current += step * 24;
        send({ type: 'wheel', dy: step * 120, dx: 0 });
      }
    });
  // Two-finger scroll and one-finger drag race (the first to move wins); a tap waits only to be
  // sure it isn't a long press. Waiting on the pans as well left taps hanging when they never fail.
  const gestures = Gesture.Race(
    scroll.enabled(canControl),
    drag.enabled(canControl),
    Gesture.Exclusive(hold.enabled(canControl), tap.enabled(canControl)),
  );

  const pressKey = (code: string) => {
    haptic.select();
    keyPress(code, modifiers).forEach(send);
    setModifiers([]);
    if (keyboard) input.current?.focus();
  };
  const toggleModifier = (code: string) => {
    haptic.select();
    if (keyboard) input.current?.focus();
    setModifiers((current) => (current.includes(code) ? current.filter((one) => one !== code) : [...current, code]));
  };

  const title = phase.step === 'live' ? format(canControl ? t.screen.controlling : t.screen.seeing, { name }) : name;

  // While the group loads, the first state (checking it is you) stands in.
  if ((devices.status && !member) || !core?.screenOpen || !screenSupported() || !ScreenView) {
    return (
      <Centered insets={insets} onClose={close}>
        <AppText variant="heading" color={INK.text} style={styles.center}>
          {t.screen.unavailableTitle}
        </AppText>
        <AppText variant="callout" color={INK.dim} style={styles.center}>
          {t.screen.unavailableBody}
        </AppText>
      </Centered>
    );
  }

  if (phase.step !== 'live') {
    return (
      <Centered insets={insets} onClose={close}>
        {phase.step === 'proving' ? (
          <>
            <LockIcon size={34} color={INK.text} strokeWidth={1.8} />
            <AppText variant="headline" color={INK.text} style={styles.center}>
              {t.screen.proving}
            </AppText>
          </>
        ) : phase.step === 'proof' ? (
          <>
            <LockIcon size={34} color={INK.warn} strokeWidth={1.8} />
            <AppText variant="heading" color={INK.text} style={styles.center}>
              {phase.kind === 'no-code'
                ? t.screen.noCode
                : phase.kind === 'cancelled'
                  ? t.screen.proofCancelled
                  : t.screen.proofFailed}
            </AppText>
            <AppText variant="callout" color={INK.dim} style={styles.center}>
              {phase.kind === 'no-code' ? t.screen.noCodeBody : t.screen.proofCancelledBody}
            </AppText>
            {phase.kind !== 'no-code' ? <Button label={t.screen.retry} tone="primary" onPress={() => void start()} /> : null}
          </>
        ) : phase.step === 'waiting' ? (
          <>
            <CountdownRing seconds={secondsLeft} total={APPROVAL_SECONDS} size={64} ink={INK.text} />
            <AppText variant="heading" color={INK.text} style={styles.center} accessibilityRole="header">
              {format(t.screen.waiting, { name })}
            </AppText>
            <AppText variant="callout" color={INK.dim} style={styles.center}>
              {format(t.screen.waitingBody, {
                name,
                seconds: APPROVAL_SECONDS,
              })}
            </AppText>
            <Button label={t.screen.cancel} tone="quiet" onPress={close} />
          </>
        ) : phase.step === 'failed' ? (
          <>
            <AppText variant="heading" color={INK.text} style={styles.center} accessibilityRole="alert">
              {phase.message}
            </AppText>
            <Button label={t.screen.retry} tone="primary" onPress={() => void start()} />
          </>
        ) : (
          <>
            <AppText variant="heading" color={INK.text} style={styles.center} accessibilityRole="alert">
              {t.screen.endedTitle}
            </AppText>
            <AppText variant="callout" color={INK.dim} style={styles.center}>
              {format(t.screen.ended[phase.reason] ?? t.screen.ended.other, {
                name,
              })}
            </AppText>
            <Button label={t.screen.close} tone="primary" onPress={close} />
          </>
        )}
      </Centered>
    );
  }

  return (
    // The keys row rides above the phone's keyboard (Android resizes the window by itself).
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { paddingTop: insets.top }]}
    >
      <StatusBar style="light" />
      <View style={styles.bar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.screen.close}
          onPress={close}
          hitSlop={8}
          style={styles.round}
        >
          <XIcon size={20} color={INK.text} strokeWidth={2.2} />
        </Pressable>
        <AppText variant="subhead" color={INK.text} numberOfLines={1} style={styles.flex}>
          {title}
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.screen.turn}
          accessibilityState={{ selected: turned }}
          onPress={() => {
            haptic.select();
            setTurned((on) => !on);
          }}
          hitSlop={8}
          style={[styles.round, turned && styles.roundOn]}
        >
          <TurnIcon size={20} color={INK.text} strokeWidth={1.9} />
        </Pressable>
        {canControl ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={keyboard ? t.screen.hideKeyboard : t.screen.keyboard}
            accessibilityState={{ selected: keyboard }}
            onPress={() => {
              setKeyboard((open) => !open);
              if (!keyboard) setTimeout(() => input.current?.focus(), 50);
              else input.current?.blur();
            }}
            hitSlop={8}
            style={[styles.round, keyboard && styles.roundOn]}
          >
            <KeyboardIcon size={20} color={INK.text} strokeWidth={1.9} />
          </Pressable>
        ) : null}
      </View>

      {/* Layout ignores transforms, so a turned stage keeps its own frame: touches need no rotating. */}
      <View
        ref={areaView}
        style={styles.area}
        onLayout={(event: LayoutChangeEvent) => {
          setArea({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height });
          areaView.current?.measureInWindow((x, y) => {
            areaAt.current = { x, y };
          });
        }}
      >
        <GestureDetector gesture={gestures}>
          <View
            style={
              turned && area.width > 0
                ? {
                    position: 'absolute',
                    width: area.height,
                    height: area.width,
                    left: (area.width - area.height) / 2,
                    top: (area.height - area.width) / 2,
                    overflow: 'hidden',
                    transform: [{ rotate: '90deg' }],
                  }
                : styles.stage
            }
            onLayout={(event: LayoutChangeEvent) =>
              setView({
                width: event.nativeEvent.layout.width,
                height: event.nativeEvent.layout.height,
              })
            }
            accessible
            accessibilityLabel={title}
            accessibilityHint={canControl ? t.screen.hint : undefined}
          >
            <ScreenView sessionId={sessionId} style={StyleSheet.absoluteFill} />
            {!video ? (
              <View style={styles.overlayCenter}>
                <ActivityIndicator color={INK.text} />
                <AppText variant="subhead" color={INK.dim}>
                  {t.screen.starting}
                </AppText>
              </View>
            ) : null}
            {pointer && video && !paused ? (
              <View
                pointerEvents="none"
                style={[
                  styles.pointer,
                  {
                    left: rect.x + pointer.x * rect.width,
                    top: rect.y + pointer.y * rect.height,
                  },
                ]}
              >
                <Svg width={18} height={22} viewBox="0 0 18 22">
                  <Path
                    d="M1 1v17l4.5-4.2 3 6.7 3-1.4-3-6.6H15z"
                    fill="#FFFFFF"
                    stroke="#000000"
                    strokeWidth={1.4}
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
            ) : null}
            {paused ? (
              <Banner title={t.screen.paused} body={format(t.screen.pausedBody, { name })} />
            ) : localInput ? (
              <Banner title={format(t.screen.localInput, { name })} body={t.screen.localInputBody} />
            ) : viewOnly && wantsControl ? (
              <Banner title={t.screen.viewOnly} />
            ) : null}
          </View>
        </GestureDetector>
      </View>

      {canControl && keyboard ? (
        // One line that scrolls, and taps on it keep the phone's keyboard open.
        <ScrollView
          horizontal
          keyboardShouldPersistTaps="always"
          showsHorizontalScrollIndicator={false}
          style={styles.keysBar}
          contentContainerStyle={styles.keys}
        >
          {(['escape', 'tab', 'control', 'alt'] as const).map((key) => {
            const code = SPECIAL_KEYS[key];
            const modifier = key === 'control' || key === 'alt';
            const held = modifiers.includes(code);
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityState={modifier ? { selected: held } : undefined}
                onPress={() => (modifier ? toggleModifier(code) : pressKey(code))}
                style={[styles.key, held && styles.keyHeld]}
              >
                <AppText variant="footnote" color={INK.text} maxFontSizeMultiplier={1.3}>
                  {t.screen.keys[key]}
                </AppText>
              </Pressable>
            );
          })}
          {(['left', 'up', 'down', 'right'] as const).map((key) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={t.screen.keys[key]}
              onPress={() => pressKey(SPECIAL_KEYS[key])}
              style={styles.key}
            >
              <AppText variant="footnote" color={INK.text} maxFontSizeMultiplier={1.3}>
                {{ left: '←', up: '↑', down: '↓', right: '→' }[key]}
              </AppText>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" onPress={() => pressKey(SPECIAL_KEYS.delete)} style={styles.key}>
            <AppText variant="footnote" color={INK.text} maxFontSizeMultiplier={1.3}>
              {t.screen.keys.delete}
            </AppText>
          </Pressable>
        </ScrollView>
      ) : null}

      {/* The phone's keyboard: what it types goes as text, Return and Backspace as keys. */}
      <TextInput
        ref={input}
        value=""
        autoCorrect={false}
        autoCapitalize="none"
        spellCheck={false}
        accessibilityLabel={t.screen.keyboard}
        onChangeText={(text) => {
          if (!text) return;
          if (modifiers.length > 0 && text.length === 1 && /[a-z]/i.test(text)) {
            pressKey(`Key${text.toUpperCase()}`);
            return;
          }
          send({ type: 'text', text });
        }}
        onKeyPress={({ nativeEvent }) => {
          if (nativeEvent.key === 'Backspace') pressKey(SPECIAL_KEYS.backspace);
        }}
        onSubmitEditing={() => pressKey(SPECIAL_KEYS.enter)}
        blurOnSubmit={false}
        style={styles.hiddenInput}
      />

      <View style={{ height: keyboard ? 0 : insets.bottom }} />
    </KeyboardAvoidingView>
  );
}

function Centered({
  insets,
  onClose,
  children,
}: {
  insets: { top: number; bottom: number };
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]}>
      <StatusBar style="light" />
      <View style={styles.bar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.screen.close}
          onPress={onClose}
          hitSlop={8}
          style={styles.round}
        >
          <XIcon size={20} color={INK.text} strokeWidth={2.2} />
        </Pressable>
      </View>
      <View style={styles.centered}>{children}</View>
    </View>
  );
}

function Banner({ title, body }: { title: string; body?: string }) {
  return (
    <View style={styles.banner} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <AppText variant="headline" color={INK.text}>
        {title}
      </AppText>
      {body ? (
        <AppText variant="subhead" color={INK.dim}>
          {body}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: INK.ground },
  bar: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
  },
  flex: { flex: 1 },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: INK.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundOn: { backgroundColor: 'rgba(255,255,255,0.32)' },
  area: { flex: 1 },
  stage: { flex: 1, overflow: 'hidden' },
  overlayCenter: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  pointer: { position: 'absolute', marginLeft: -1, marginTop: -1 },
  banner: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: 16,
    padding: 14,
    gap: 2,
    backgroundColor: INK.bar,
  },
  keysBar: { flexGrow: 0, backgroundColor: INK.bar },
  keys: { flexDirection: 'row', gap: 6, padding: 8 },
  key: {
    minWidth: 44,
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: INK.control,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  keyHeld: {
    backgroundColor: '#1E2A44',
    borderWidth: 1,
    borderColor: '#3B5B8F',
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    left: -10,
    top: -10,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 28,
  },
  center: { textAlign: 'center' },
});
