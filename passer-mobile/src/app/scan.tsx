import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Mask, Path, Rect } from 'react-native-svg';

import { FlashlightIcon, LinkIcon, ScanIcon, XIcon } from '@/components/icons';
import { AppText } from '@/components/ui/app-text';
import { PressableScale } from '@/components/ui/pressable-scale';
import { parsePairingLink } from '@/core/pairing';
import { t } from '@/i18n';

/** The scanner always reads as a viewfinder: dark scrim and white marks, whatever the theme. */
const INK = {
  ground: '#0B0B0B',
  scrim: 'rgba(5,5,5,0.66)',
  text: '#FFFFFF',
  dim: 'rgba(255,255,255,0.64)',
  control: 'rgba(255,255,255,0.14)',
  controlBorder: 'rgba(255,255,255,0.20)',
  paper: '#FFFFFF',
  paperInk: '#0F0F0F',
};

const CORNER_RADIUS = 28;
const CORNER_LENGTH = 42;

export default function Scan() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const [focused, setFocused] = useState(true);
  const [torch, setTorch] = useState(false);
  const [rejected, setRejected] = useState(false);
  const handled = useRef(false);

  useFocusEffect(
    useCallback(() => {
      handled.current = false;
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  useEffect(() => {
    if (!rejected) return;
    const timer = setTimeout(() => setRejected(false), 2500);
    return () => clearTimeout(timer);
  }, [rejected]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const onScanned = ({ data }: BarcodeScanningResult) => {
    if (handled.current) return;
    const result = parsePairingLink(data);
    if (!result.ok && result.error === 'not-a-pairing-link') {
      setRejected(true);
      return;
    }
    // Anything that looks like a Passer link goes to the pairing screen, which explains its problems.
    handled.current = true;
    setFocused(false);
    router.replace({ pathname: '/pair', params: { link: data } });
  };

  if (!permission) {
    return <View style={[styles.screen, { backgroundColor: INK.ground }]} />;
  }

  if (!permission.granted) {
    return (
      <PermissionView
        insets={insets}
        canAsk={permission.canAskAgain}
        onAsk={() => void requestPermission()}
        onManual={() => router.push('/manual')}
        onClose={close}
      />
    );
  }

  const size = Math.min(width - 88, 290);
  const top = Math.round(height * 0.44 - size / 2);
  const left = (width - size) / 2;

  return (
    <View style={[styles.screen, { backgroundColor: INK.ground }]}>
      <StatusBar style="light" />
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        active={focused}
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={focused ? onScanned : undefined}
      />
      <Viewfinder width={width} height={height} size={size} top={top} left={left} />

      <CloseButton top={insets.top + 8} onPress={close} />

      <View style={[styles.heading, { top: Math.max(insets.top + 64, top - 96) }]}>
        <AppText variant="title" color={INK.text} accessibilityRole="header" style={styles.centerText}>
          {t.scan.title}
        </AppText>
        <AppText variant="caption" color={INK.dim} style={styles.centerText}>
          {t.scan.hint}
        </AppText>
      </View>

      {rejected ? (
        <Animated.View
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(200)}
          accessibilityRole="alert"
          style={[styles.rejected, { top: top + size + 20 }]}
        >
          <AppText variant="caption" color={INK.paperInk} style={styles.strong}>
            {t.scan.notPairingCode}
          </AppText>
        </Animated.View>
      ) : null}

      <View style={[styles.controls, { bottom: insets.bottom + 20 }]}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={torch ? t.scan.torchOff : t.scan.torchOn}
          accessibilityState={{ selected: torch }}
          onPress={() => setTorch((value) => !value)}
          style={[styles.roundControl, torch ? { backgroundColor: INK.paper } : { backgroundColor: INK.control, borderColor: INK.controlBorder, borderWidth: 1 }]}
        >
          <FlashlightIcon size={20} color={torch ? INK.paperInk : INK.text} />
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          onPress={() => router.push('/manual')}
          style={[styles.pillControl, { backgroundColor: INK.control, borderColor: INK.controlBorder }]}
        >
          <LinkIcon size={16} color={INK.text} />
          <AppText variant="body" color={INK.text}>
            {t.scan.manual}
          </AppText>
        </PressableScale>
      </View>
    </View>
  );
}

function Viewfinder({ width, height, size, top, left }: { width: number; height: number; size: number; top: number; left: number }) {
  const r = CORNER_RADIUS;
  const c = CORNER_LENGTH;
  const right = left + size;
  const bottom = top + size;
  const corners = [
    `M${left} ${top + c}V${top + r}A${r} ${r} 0 0 1 ${left + r} ${top}H${left + c}`,
    `M${right - c} ${top}H${right - r}A${r} ${r} 0 0 1 ${right} ${top + r}V${top + c}`,
    `M${right} ${bottom - c}V${bottom - r}A${r} ${r} 0 0 1 ${right - r} ${bottom}H${right - c}`,
    `M${left + c} ${bottom}H${left + r}A${r} ${r} 0 0 1 ${left} ${bottom - r}V${bottom - c}`,
  ].join(' ');

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Mask id="window">
          <Rect x={0} y={0} width={width} height={height} fill="#FFFFFF" />
          <Rect x={left} y={top} width={size} height={size} rx={r} fill="#000000" />
        </Mask>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={INK.scrim} mask="url(#window)" />
      <Path d={corners} stroke={INK.text} strokeWidth={4} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

function CloseButton({ top, onPress }: { top: number; onPress: () => void }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t.common.close}
      onPress={onPress}
      style={[styles.close, { top, backgroundColor: INK.control, borderColor: INK.controlBorder }]}
    >
      <XIcon size={18} color={INK.text} strokeWidth={2} />
    </PressableScale>
  );
}

function PermissionView({
  insets,
  canAsk,
  onAsk,
  onManual,
  onClose,
}: {
  insets: EdgeInsets;
  canAsk: boolean;
  onAsk: () => void;
  onManual: () => void;
  onClose: () => void;
}) {
  return (
    <View style={[styles.screen, { backgroundColor: INK.ground, paddingBottom: insets.bottom + 20 }]}>
      <StatusBar style="light" />
      <CloseButton top={insets.top + 8} onPress={onClose} />
      <View style={styles.permissionBody}>
        <View style={[styles.permissionIcon, { backgroundColor: INK.control, borderColor: INK.controlBorder }]}>
          <ScanIcon size={30} color={INK.text} strokeWidth={1.5} />
        </View>
        <AppText variant="pcName" color={INK.text} accessibilityRole="header" style={styles.centerText}>
          {canAsk ? t.scan.askTitle : t.scan.deniedTitle}
        </AppText>
        <AppText variant="body" color={INK.dim} style={styles.centerText}>
          {canAsk ? t.scan.askBody : t.scan.deniedBody}
        </AppText>
      </View>
      <View style={styles.permissionActions}>
        <PressableScale
          accessibilityRole="button"
          onPress={canAsk ? onAsk : () => void Linking.openSettings()}
          style={[styles.solid, { backgroundColor: INK.paper }]}
        >
          <AppText variant="title" color={INK.paperInk}>
            {canAsk ? t.scan.askAction : t.common.openSettings}
          </AppText>
        </PressableScale>
        <PressableScale accessibilityRole="button" onPress={onManual} style={styles.quiet}>
          <AppText variant="body" color={INK.dim}>
            {t.scan.manual}
          </AppText>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centerText: { textAlign: 'center' },
  strong: { fontWeight: '600' },
  close: {
    position: 'absolute',
    left: 16,
    zIndex: 2,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: { position: 'absolute', left: 32, right: 32, alignItems: 'center', gap: 6 },
  rejected: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  controls: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  roundControl: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  pillControl: {
    minHeight: 52,
    borderRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  permissionBody: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 32 },
  permissionIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  permissionActions: { paddingHorizontal: 20, gap: 6 },
  solid: { minHeight: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  quiet: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
