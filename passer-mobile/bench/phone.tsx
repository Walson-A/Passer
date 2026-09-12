import { router, type Href } from 'expo-router';
import { App } from 'expo-router/build/qualified-entry';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ReducedMotionConfig, ReduceMotion } from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { seedToken } from '@/platform/secrets.web';
import { DEFAULT_SETTINGS, storage } from '@/platform/storage';
import { installBenchHost, subscribeBenchPreferences, type IphoneClipboard } from '@/platform/web-bench';
import { useSystemScheme } from '@/theme/system-scheme.web';
import { palettes } from '@/theme/tokens';

import { openOnMount, stillMotion } from './boot';
import { FILES, history, iphoneClipboard, pairedPc, PC, pcClipboard, PHOTOS } from './fixtures';
import { postLog } from './log';
import { createFakeNetwork } from './network';
import { DEVICES, loadState, type BenchState, type Device } from './state';

function clipboardStore(initial: IphoneClipboard) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    read: () => value,
    write: (next: IphoneClipboard) => {
      value = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Writes what the app finds on disk at launch, through the app's own storage module. */
async function seed(state: BenchState): Promise<void> {
  const now = Date.now();
  const paired = state.regime !== 'first-launch';
  await storage.savePcs(paired ? [pairedPc(now)] : []);
  await storage.saveHistory(paired ? history(now) : []);
  await storage.saveSettings(DEFAULT_SETTINGS);
  if (paired) seedToken(PC.id, PC.token);
}

/** Puts the stand-ins in place before the app's first render, then seeds its storage. */
function start(state: BenchState) {
  const clipboard = clipboardStore(iphoneClipboard(state.iphoneClipboard));
  let appliedClipboard = state.iphoneClipboard;
  let pcChoice = state.pcClipboard;

  const network = createFakeNetwork({ regime: state.regime, pcClipboard: () => pcClipboard(pcChoice), log: postLog });
  network.install();

  installBenchHost({
    log: postLog,
    clipboard,
    transport: network.transport,
    pickPhotos: async () => PHOTOS,
    pickFiles: async () => FILES,
    insets: DEVICES[state.device].insets,
  });

  // The desk changes the clipboards live, as copying something on the iPhone or the PC would.
  subscribeBenchPreferences(() => {
    const next = loadState();
    if (next.iphoneClipboard !== appliedClipboard) {
      appliedClipboard = next.iphoneClipboard;
      clipboard.write(iphoneClipboard(next.iphoneClipboard));
    }
    pcChoice = next.pcClipboard;
  });

  return { device: DEVICES[state.device], seeded: seed(state) };
}

/** The phone: the app's real root, as `expo-router/entry` mounts it, under the device's status bar. */
export function Phone() {
  const [phone] = useState(() => start(loadState()));
  const [ready, setReady] = useState(false);
  const wrapper = useRef<View>(null);

  useEffect(() => {
    // vaul scales this element back behind an open sheet, as iOS does with the screen underneath.
    (wrapper.current as unknown as HTMLElement | null)?.setAttribute('data-vaul-drawer-wrapper', '');
  }, []);

  useEffect(() => {
    let active = true;
    void phone.seeded.then(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, [phone]);

  useEffect(() => {
    if (!ready || !openOnMount) return;
    const target = openOnMount;
    const path = target.split('?')[0];
    let attempts = 0;
    // The router refuses to navigate until the root layout has mounted: try until the URL shows the route.
    const timer = setInterval(() => {
      attempts += 1;
      if (window.location.pathname === path || attempts > 40) {
        clearInterval(timer);
        return;
      }
      try {
        router.push(target as Href);
      } catch {
        // Not mounted yet.
      }
    }, 200);
    return () => clearInterval(timer);
  }, [ready]);

  return (
    <View style={styles.screen}>
      {stillMotion ? <ReducedMotionConfig mode={ReduceMotion.Always} /> : null}
      <SheetStyle device={phone.device} />
      <View ref={wrapper} style={styles.app}>
        {ready ? <App /> : null}
      </View>
      <DeviceChrome device={phone.device} />
    </View>
  );
}

/**
 * With `EXPO_UNSTABLE_WEB_MODAL`, expo-router draws sheets with vaul, which knows
 * nothing of iOS. This paints them in the app's sheet colour instead of the
 * navigation theme's grey, keeps a large sheet below the status bar, and draws
 * the grabber the app asks for.
 */
function SheetStyle({ device }: { device: Device }) {
  const sheet = palettes[useSystemScheme() === 'light' ? 'light' : 'dark'].surface.sheet;
  const top = device.insets.top + 10;
  const css = [
    `[data-presentation="formSheet"] { background-color: ${sheet} !important; }`,
    // The sheet body is a row flexbox: without this, a screen is as wide as its longest line instead of the sheet.
    '[data-presentation="formSheet"] > div:last-child > * { flex: 1 1 auto !important; min-width: 0 !important; }',
    '[data-presentation="formSheet"]::before { content: ""; position: absolute; z-index: 5; top: 5px; left: 50%; width: 36px; height: 5px; margin-left: -18px; border-radius: 3px; background: rgba(128, 128, 128, 0.45); }',
    `[data-vaul-drawer] { top: auto !important; height: calc(100% - ${top}px) !important; }`,
    `[data-vaul-drawer][style*="height: auto"] { height: auto !important; max-height: calc(100% - ${top}px) !important; }`,
    // expo-router doesn't mark full-screen modals on the web; it gives them its default 24 px
    // corner radius, while every sheet in the app sets 32 px. That is what tells them apart.
    '[data-vaul-drawer]:has(> [style*="border-top-left-radius: 24px"]) { height: 100% !important; }',
    '[data-presentation][style*="border-top-left-radius: 24px"] { border-radius: 0 !important; }',
    '[data-presentation][style*="border-top-left-radius: 24px"]::before { display: none; }',
    stillMotion
      ? '[data-vaul-drawer], [data-vaul-overlay], [data-vaul-drawer-wrapper] { transition: none !important; animation: none !important; }'
      : '',
  ].join('\n');

  useEffect(() => {
    const element = document.createElement('style');
    element.textContent = css;
    document.head.appendChild(element);
    return () => element.remove();
  }, [css]);

  return null;
}

/** The status bar and home indicator iOS draws over the app, so collisions with them show. */
function DeviceChrome({ device }: { device: Device }) {
  const ink = useSystemScheme() === 'light' ? '#000000' : '#FFFFFF';
  return (
    <View pointerEvents="none" style={styles.chrome}>
      {device.island ? (
        <View style={styles.islandBar}>
          <View style={styles.side}>
            <Text style={[styles.time, { color: ink }]}>9:41</Text>
          </View>
          <View style={styles.island} />
          <View style={styles.side}>
            <StatusGlyphs color={ink} />
          </View>
        </View>
      ) : (
        <View style={[styles.classicBar, { height: device.insets.top }]}>
          <Text style={[styles.classicTime, { color: ink }]}>9:41</Text>
          <View style={styles.classicGlyphs}>
            <StatusGlyphs color={ink} />
          </View>
        </View>
      )}
      {device.insets.bottom > 0 ? <View style={[styles.homeIndicator, { backgroundColor: ink }]} /> : null}
    </View>
  );
}

function StatusGlyphs({ color }: { color: string }) {
  return (
    <Svg width={68} height={13} viewBox="0 0 68 13" fill="none">
      <Rect x={0} y={8.2} width={3} height={3.8} rx={0.8} fill={color} />
      <Rect x={4.6} y={6} width={3} height={6} rx={0.8} fill={color} />
      <Rect x={9.2} y={3.6} width={3} height={8.4} rx={0.8} fill={color} />
      <Rect x={13.8} y={1.2} width={3} height={10.8} rx={0.8} fill={color} />
      <Path d="M22.3 4.4a9.6 9.6 0 0 1 13.4 0" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
      <Path d="M25 7.2a5.6 5.6 0 0 1 8 0" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
      <Circle cx={29} cy={10.4} r={1.4} fill={color} />
      <Rect x={42.5} y={0.6} width={22} height={11.8} rx={3.4} stroke={color} strokeOpacity={0.4} />
      <Rect x={44.3} y={2.4} width={18.4} height={8.2} rx={2} fill={color} />
      <Path d="M66 4.6v3.8c.8-.3 1.3-1 1.3-1.9s-.5-1.6-1.3-1.9z" fill={color} fillOpacity={0.45} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  app: { flex: 1 },
  // Above vaul's sheets too, which are portaled after the app in the document.
  chrome: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 2147483647 },
  islandBar: { position: 'absolute', top: 11, left: 0, right: 0, height: 37, flexDirection: 'row', alignItems: 'center' },
  side: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  island: { width: 126, height: 37, borderRadius: 19, backgroundColor: '#000000' },
  time: { fontSize: 17, fontWeight: '600', letterSpacing: -0.3 },
  classicBar: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  classicTime: { fontSize: 12, fontWeight: '600' },
  classicGlyphs: { position: 'absolute', right: 6, top: 4 },
  homeIndicator: { position: 'absolute', bottom: 8, alignSelf: 'center', width: 134, height: 5, borderRadius: 3 },
});
