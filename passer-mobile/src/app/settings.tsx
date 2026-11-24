import * as Application from 'expo-application';
import { useRouter } from 'expo-router';
import { useEffect, useState, type ComponentType } from 'react';
import { AppState, Linking, Platform, ScrollView, StyleSheet, Switch, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DeviceGlyph } from '@/components/device-glyph';
import {
  ArrowDownToLineIcon,
  CheckIcon,
  ImageIcon,
  LaptopIcon,
  LayersIcon,
  LockIcon,
  RotateIcon,
  ScanIcon,
  TrashIcon,
  VibrateIcon,
  WifiIcon,
  type IconProps,
} from '@/components/icons';
import { AppText } from '@/components/ui/app-text';
import { Group, Row } from '@/components/ui/list';
import { PressableScale } from '@/components/ui/pressable-scale';
import { format, language, t } from '@/i18n';
import { announce } from '@/platform/accessibility';
import { haptic } from '@/platform/haptics';
import { readPhotoAccess, requestPhotoAccess, type PhotoAccess } from '@/platform/photo-access';
import type { PhotoDestination } from '@/platform/storage';
import type { UpdateStatus } from '@/platform/update-status';
import { useAppUpdates } from '@/platform/updates';
import { thisDeviceName, useDevices } from '@/state/devices';
import { useHistory } from '@/state/history';
import { usePairings } from '@/state/pairings';
import { useSettings } from '@/state/settings';
import { useTransfers } from '@/state/transfers';
import { useTheme } from '@/theme/theme';
import { deviceName } from '@/utils/format';

/** Destructive actions arm on the first tap and disarm after this long, as on the desktop. */
const DISARM_MS = 4_000;

const pairedDate = new Intl.DateTimeFormat(language, { day: 'numeric', month: 'long', year: 'numeric' });
const updateDate = new Intl.DateTimeFormat(language, { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });

function Icon({ icon: Glyph, color }: { icon: ComponentType<IconProps>; color?: string }) {
  const { colors } = useTheme();
  return <Glyph size={20} color={color ?? colors.icon.normal} strokeWidth={1.9} />;
}

/**
 * Settings: this phone, preferences, the direct connection that Shortcuts and large files
 * still use, updates. The device network itself lives in the Devices tab.
 */
export default function Settings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { pc, forget } = usePairings();
  const { me } = useDevices();
  const { settings, updateSettings } = useSettings();
  const { clear } = useHistory();
  const { active } = useTransfers();
  const [armed, setArmed] = useState(false);
  const [photoAccess, setPhotoAccess] = useState<PhotoAccess | null>(null);
  const updates = useAppUpdates();

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), DISARM_MS);
    return () => clearTimeout(timer);
  }, [armed]);

  // Coming back from the system settings may have changed the photo access.
  useEffect(() => {
    const refresh = () => {
      readPhotoAccess()
        .then(setPhotoAccess)
        .catch(() => setPhotoAccess(null));
    };
    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, []);

  const askPhotoAccess = async () => {
    if (photoAccess !== 'undetermined') {
      void Linking.openSettings();
      return;
    }
    setPhotoAccess(await requestPhotoAccess());
  };

  const photoAccessLabel =
    photoAccess === 'all'
      ? t.settings.photoAccessAll
      : photoAccess === 'limited'
        ? t.settings.photoAccessLimited
        : photoAccess === 'denied'
          ? t.settings.photoAccessDenied
          : t.settings.photoAccessAsk;

  const forgetPc = async () => {
    if (!pc) return;
    if (!armed) {
      haptic.warning();
      setArmed(true);
      return;
    }
    haptic.success();
    setArmed(false);
    await forget(pc);
  };

  const checkForUpdate = async () => {
    const outcome = await updates.check();
    if (outcome === 'ready') {
      haptic.success();
      announce(t.settings.restartToUpdate);
    } else if (outcome === 'up-to-date') {
      announce(t.settings.upToDate);
    } else {
      haptic.warning();
      announce(t.settings.updateFailed);
    }
  };

  const restartOntoUpdate = () => {
    // Restarting would cut the transfer running on Send.
    if (active) {
      haptic.warning();
      announce(t.transfer.busy);
      return;
    }
    void updates.restart({ background: colors.ground, spinner: colors.text.secondary });
  };

  const updateFooter =
    updates.status.kind === 'ready' ? t.settings.restartHint : updates.status.kind === 'failed' ? t.settings.updateFailed : undefined;

  const version = [Application.nativeApplicationVersion, Application.nativeBuildVersion].filter(Boolean).join(' · ');
  const name = deviceName(me?.name ?? thisDeviceName());

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
      <AppText variant="heading" accessibilityRole="header" style={styles.title}>
        {t.settings.title}
      </AppText>

      <Group header={t.settings.thisPhone} footer={t.settings.nameHint}>
        <Row title={name} leading={<DeviceGlyph id={me?.id ?? name} name={name} kind="phone" size={40} />} />
      </Group>

      <Group header={t.settings.preferences}>
        <Row
          title={t.settings.haptics}
          leading={<Icon icon={VibrateIcon} />}
          trailing={
            <Switch
              value={settings.haptics}
              onValueChange={(value) => updateSettings({ haptics: value })}
              trackColor={{ false: colors.toggleOff, true: colors.status.ok }}
              ios_backgroundColor={colors.toggleOff}
              accessibilityLabel={t.settings.haptics}
            />
          }
        />
        {pc ? (
          <View style={styles.choice}>
            <AppText variant="callout">{t.settings.photoDestination}</AppText>
            <Segmented
              value={settings.photoDestination}
              options={[
                { value: null, label: t.settings.askEachTime },
                { value: 'clipboard', label: t.destination.clipboardTitle },
                { value: 'passboard', label: t.destination.passboardTitle },
              ]}
              onChange={(value) => updateSettings({ photoDestination: value })}
            />
          </View>
        ) : null}
      </Group>

      <Group header={t.settings.direct} footer={t.settings.directHint}>
        {pc ? (
          <Row
            key="pc"
            title={pc.name}
            leading={<Icon icon={LaptopIcon} />}
            subtitle={format(t.settings.pairedOn, { date: pairedDate.format(pc.pairedAt) })}
          />
        ) : null}
        <Row
          key="pair"
          title={pc ? t.pair.scanAgain : t.settings.directNone}
          tone={pc ? 'default' : 'link'}
          leading={<Icon icon={ScanIcon} color={pc ? undefined : colors.link} />}
          onPress={() => router.push('/scan')}
          chevron
        />
        {pc ? (
          <Row
            key="forget"
            title={armed ? t.settings.forgetConfirm : t.settings.forget}
            tone="destructive"
            leading={<Icon icon={TrashIcon} color={colors.status.error} />}
            onPress={() => void forgetPc()}
          />
        ) : null}
      </Group>

      {Platform.OS !== 'android' ? (
        <Group header={t.settings.shortcutsSection} footer={t.settings.shortcutsHint}>
          <Row
            title={t.settings.shortcutsApp}
            leading={<Icon icon={LayersIcon} />}
            onPress={() => void Linking.openURL('shortcuts://')}
            chevron
          />
          <Row
            title={t.settings.photoAccess}
            leading={<Icon icon={ImageIcon} />}
            detail={photoAccessLabel}
            onPress={() => void askPhotoAccess()}
            chevron
          />
        </Group>
      ) : null}

      <Group>
        <Row
          title={t.settings.localNetwork}
          leading={<Icon icon={WifiIcon} />}
          detail={t.settings.manageInSettings}
          onPress={() => void Linking.openSettings()}
          chevron
        />
        <Row
          title={t.settings.clearHistory}
          tone="destructive"
          leading={<Icon icon={TrashIcon} color={colors.status.error} />}
          onPress={() => {
            haptic.warning();
            clear();
          }}
        />
      </Group>

      {updates.enabled ? (
        <Group header={t.settings.updatesSection} footer={updateFooter}>
          <UpdateRow status={updates.status} onCheck={() => void checkForUpdate()} onRestart={restartOntoUpdate} />
        </Group>
      ) : null}

      <View style={styles.footer}>
        <View style={styles.privacy}>
          <LockIcon size={13} color={colors.text.tertiary} strokeWidth={2} />
          <AppText variant="footnote" tone="tertiary" style={styles.center}>
            {t.settings.privacy}
          </AppText>
        </View>
        {version ? (
          <AppText variant="footnote" tone="tertiary">
            {format(t.settings.version, { version })}
          </AppText>
        ) : null}
        {updates.runningSince ? (
          <AppText variant="footnote" tone="tertiary">
            {format(t.settings.runningUpdate, { date: updateDate.format(updates.runningSince) })}
          </AppText>
        ) : null}
      </View>
    </ScrollView>
  );
}

/** One row that follows the update from the first tap to the restart. */
function UpdateRow({ status, onCheck, onRestart }: { status: UpdateStatus; onCheck: () => void; onRestart: () => void }) {
  const { colors } = useTheme();
  switch (status.kind) {
    case 'checking':
      return <Row title={t.settings.checkingForUpdate} leading={<SpinningRotateIcon size={20} color={colors.icon.normal} />} />;
    case 'downloading':
      return (
        <Row
          title={t.settings.downloadingUpdate}
          leading={<Icon icon={ArrowDownToLineIcon} />}
          detail={
            status.progress === null
              ? undefined
              : format(t.settings.downloadProgress, { percent: String(Math.round(status.progress * 100)) })
          }
        />
      );
    case 'ready':
      return <Row title={t.settings.restartToUpdate} leading={<Icon icon={RotateIcon} color={colors.status.ok} />} onPress={onRestart} />;
    case 'up-to-date':
      return <Row title={t.settings.upToDate} leading={<Icon icon={CheckIcon} color={colors.status.ok} />} onPress={onCheck} />;
    default:
      return <Row title={t.settings.checkForUpdate} leading={<Icon icon={RotateIcon} />} onPress={onCheck} />;
  }
}

/** Turns while the check runs; still with Reduce Motion, where the label says enough. */
function SpinningRotateIcon(props: IconProps) {
  const reduceMotion = useReducedMotion();
  const turn = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    turn.set(0);
    turn.set(withRepeat(withTiming(1, { duration: 900, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(turn);
  }, [reduceMotion, turn]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get() * 360}deg` }] }));

  return (
    <Animated.View style={animatedStyle}>
      <RotateIcon {...props} />
    </Animated.View>
  );
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: PhotoDestination | null;
  options: { value: PhotoDestination | null; label: string }[];
  onChange: (value: PhotoDestination | null) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: colors.surface.well, borderColor: colors.border.subtle }]} accessibilityRole="radiogroup">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <PressableScale
            key={option.label}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => {
              haptic.select();
              onChange(option.value);
            }}
            pressedScale={0.98}
            style={[
              styles.segment,
              selected && { backgroundColor: colors.surface.raised, borderColor: colors.border.raised, borderWidth: 1 },
            ]}
          >
            <AppText variant="footnote" tone={selected ? 'primary' : 'secondary'} style={[styles.center, selected && styles.strong]} numberOfLines={2}>
              {option.label}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 28, gap: 24 },
  title: { paddingHorizontal: 20 },
  choice: { padding: 16, gap: 10 },
  segmented: { flexDirection: 'row', borderRadius: 14, borderWidth: 1, padding: 4, gap: 4 },
  segment: { flex: 1, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  strong: { fontWeight: '600' },
  center: { textAlign: 'center' },
  footer: { alignItems: 'center', gap: 6, paddingTop: 4, paddingHorizontal: 24 },
  privacy: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
