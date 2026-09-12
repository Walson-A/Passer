import * as Application from 'expo-application';
import { useRouter } from 'expo-router';
import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
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

import {
  ArrowDownToLineIcon,
  CheckIcon,
  ChevronRightIcon,
  ImageIcon,
  LaptopIcon,
  LayersIcon,
  RotateIcon,
  ScanIcon,
  ShieldIcon,
  TrashIcon,
  VibrateIcon,
  WifiIcon,
  type IconProps,
} from '@/components/icons';
import { AppText } from '@/components/ui/app-text';
import { PressableScale } from '@/components/ui/pressable-scale';
import { format, language, t } from '@/i18n';
import { announce } from '@/platform/accessibility';
import { haptic } from '@/platform/haptics';
import { readPhotoAccess, requestPhotoAccess, type PhotoAccess } from '@/platform/photo-access';
import type { PhotoDestination } from '@/platform/storage';
import type { UpdateStatus } from '@/platform/update-status';
import { useAppUpdates } from '@/platform/updates';
import { useHistory } from '@/state/history';
import { usePairings } from '@/state/pairings';
import { useSettings } from '@/state/settings';
import { useTransfers } from '@/state/transfers';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';

/** Destructive actions arm on the first tap and disarm after this long, as on the desktop. */
const DISARM_MS = 4_000;

const pairedDate = new Intl.DateTimeFormat(language, { day: 'numeric', month: 'long', year: 'numeric' });
const updateDate = new Intl.DateTimeFormat(language, { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });

export default function Settings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { pc, forget } = usePairings();
  const { settings, updateSettings } = useSettings();
  const { clear } = useHistory();
  const [armed, setArmed] = useState(false);
  const [photoAccess, setPhotoAccess] = useState<PhotoAccess | null>(null);
  const updates = useAppUpdates();
  const { active } = useTransfers();

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), DISARM_MS);
    return () => clearTimeout(timer);
  }, [armed]);

  // Coming back from iOS Settings may have changed the photo access.
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
    haptic.select();
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
    await forget(pc);
    router.dismissAll();
  };

  const checkForUpdate = async () => {
    haptic.select();
    const outcome = await updates.check();
    if (outcome === 'ready') {
      haptic.success();
      announce(t.settings.restartToUpdate);
    } else if (outcome === 'up-to-date') {
      haptic.tap();
      announce(t.settings.upToDate);
    } else {
      haptic.warning();
      announce(t.settings.updateFailed);
    }
  };

  const restartOntoUpdate = () => {
    // Restarting would cut the transfer running on Home.
    if (active) {
      haptic.warning();
      announce(t.transfer.busy);
      return;
    }
    haptic.tap();
    void updates.restart({ background: colors.ground, spinner: colors.text.secondary });
  };

  const updateFooter =
    updates.status.kind === 'ready'
      ? t.settings.restartHint
      : updates.status.kind === 'failed'
        ? t.settings.updateFailed
        : undefined;

  const version = [Application.nativeApplicationVersion, Application.nativeBuildVersion].filter(Boolean).join(' · ');

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
      <AppText variant="title" accessibilityRole="header">
        {t.settings.title}
      </AppText>

      {pc ? (
        <Section label={t.settings.pcSection}>
          <View style={styles.pc}>
            <View style={[styles.tile, { backgroundColor: colors.surface.raised, borderColor: colors.border.raised }]}>
              <LaptopIcon size={20} color={colors.text.primary} strokeWidth={1.5} />
            </View>
            <View style={styles.flex}>
              <AppText variant="body" style={styles.strong} numberOfLines={1}>
                {pc.name}
              </AppText>
              <AppText variant="caption" tone="tertiary" numberOfLines={1}>
                {[pc.host, pc.ip].filter(Boolean).join(' · ')}
              </AppText>
              <AppText variant="caption" tone="tertiary">
                {format(t.settings.pairedOn, { date: pairedDate.format(pc.pairedAt) })}
              </AppText>
            </View>
          </View>
          <Divider />
          <Row icon={ScanIcon} label={t.settings.pairAgain} onPress={() => router.push('/scan')} chevron />
          <Divider />
          <Row
            icon={TrashIcon}
            label={armed ? format(t.settings.forgetConfirm, { name: pc.name }) : t.settings.forget}
            tint={colors.status.error}
            onPress={() => void forgetPc()}
          />
        </Section>
      ) : null}

      <Section label={t.settings.preferences}>
        <Row
          icon={VibrateIcon}
          label={t.settings.haptics}
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
        <Divider />
        <View style={styles.choice}>
          <AppText variant="body">{t.settings.photoDestination}</AppText>
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
      </Section>

      {Platform.OS !== 'android' ? (
        <Section label={t.settings.shortcutsSection} footer={t.settings.shortcutsHint}>
          <Row icon={LayersIcon} label={t.settings.shortcutsApp} onPress={() => void Linking.openURL('shortcuts://')} chevron />
          <Divider />
          <Row icon={ImageIcon} label={t.settings.photoAccess} value={photoAccessLabel} onPress={() => void askPhotoAccess()} chevron />
        </Section>
      ) : null}

      <Section>
        <Row
          icon={WifiIcon}
          label={t.settings.localNetwork}
          value={t.settings.manageInSettings}
          onPress={() => void Linking.openSettings()}
          chevron
        />
        <Divider />
        <Row
          icon={TrashIcon}
          label={t.settings.clearHistory}
          onPress={() => {
            haptic.warning();
            clear();
          }}
        />
      </Section>

      {updates.enabled ? (
        <Section label={t.settings.updatesSection} footer={updateFooter}>
          <UpdateRow status={updates.status} onCheck={() => void checkForUpdate()} onRestart={restartOntoUpdate} />
        </Section>
      ) : null}

      <View style={styles.footer}>
        <View style={styles.privacy}>
          <ShieldIcon size={13} color={colors.icon.dim} strokeWidth={2} />
          <AppText variant="caption" tone="tertiary">
            {t.settings.privacy}
          </AppText>
        </View>
        {version ? (
          <AppText variant="meta" tone="tertiary">
            {format(t.settings.version, { version })}
          </AppText>
        ) : null}
        {updates.runningSince ? (
          <AppText variant="meta" tone="tertiary">
            {format(t.settings.runningUpdate, { date: updateDate.format(updates.runningSince) })}
          </AppText>
        ) : null}
      </View>
    </ScrollView>
  );
}

function Section({ label, footer, children }: { label?: string; footer?: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      {label ? (
        <AppText variant="label" tone="label" style={styles.sectionLabel}>
          {label}
        </AppText>
      ) : null}
      <View style={[styles.card, { backgroundColor: colors.surface.card, borderColor: colors.border.subtle }]}>
        {children}
      </View>
      {footer ? (
        <AppText variant="caption" tone="tertiary" style={styles.sectionFooter}>
          {footer}
        </AppText>
      ) : null}
    </View>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.border.subtle }]} />;
}

function Row({
  icon: Icon,
  label,
  value,
  tint,
  iconColor,
  trailing,
  chevron = false,
  busy = false,
  onPress,
}: {
  icon: ComponentType<IconProps>;
  label: string;
  value?: string;
  tint?: string;
  /** Colours the icon alone; `tint` colours the icon and the label. */
  iconColor?: string;
  trailing?: ReactNode;
  chevron?: boolean;
  /** Work under way: VoiceOver reads the row as one busy element. */
  busy?: boolean;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const content = (
    <>
      <Icon size={18} color={iconColor ?? tint ?? colors.icon.normal} />
      <AppText variant="body" color={tint} style={styles.flex} numberOfLines={2}>
        {label}
      </AppText>
      {value ? (
        <AppText variant="caption" tone="tertiary" numberOfLines={1}>
          {value}
        </AppText>
      ) : null}
      {trailing}
      {chevron ? <ChevronRightIcon size={16} color={colors.icon.dim} strokeWidth={2} /> : null}
    </>
  );

  if (!onPress) {
    return (
      <View style={styles.row} accessible={busy} accessibilityState={busy ? { busy } : undefined}>
        {content}
      </View>
    );
  }
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} onPress={onPress} pressedScale={0.99} style={styles.row}>
      {content}
    </PressableScale>
  );
}

/** One row that follows the update from the first tap to the restart. */
function UpdateRow({ status, onCheck, onRestart }: { status: UpdateStatus; onCheck: () => void; onRestart: () => void }) {
  const { colors } = useTheme();
  switch (status.kind) {
    case 'checking':
      return <Row icon={SpinningRotateIcon} label={t.settings.checkingForUpdate} busy />;
    case 'downloading':
      return (
        <Row
          icon={ArrowDownToLineIcon}
          label={t.settings.downloadingUpdate}
          value={
            status.progress === null
              ? undefined
              : format(t.settings.downloadProgress, { percent: String(Math.round(status.progress * 100)) })
          }
          busy
        />
      );
    case 'ready':
      return <Row icon={RotateIcon} label={t.settings.restartToUpdate} tint={colors.status.ok} onPress={onRestart} />;
    case 'up-to-date':
      return <Row icon={CheckIcon} iconColor={colors.status.ok} label={t.settings.upToDate} onPress={onCheck} />;
    default:
      return <Row icon={RotateIcon} label={t.settings.checkForUpdate} onPress={onCheck} />;
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
            <AppText variant="caption" tone={selected ? 'primary' : 'tertiary'} style={selected && styles.strong} numberOfLines={1}>
              {option.label}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 28, gap: 20 },
  section: { gap: 8 },
  sectionLabel: { paddingHorizontal: 4 },
  sectionFooter: { paddingHorizontal: 4 },
  card: { borderRadius: radius.card, borderWidth: 1, overflow: 'hidden' },
  pc: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  tile: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 2 },
  strong: { fontWeight: '600' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 44 },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 },
  choice: { padding: 14, gap: 10 },
  segmented: { flexDirection: 'row', borderRadius: 14, borderWidth: 1, padding: 4, gap: 4 },
  segment: { flex: 1, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  footer: { alignItems: 'center', gap: 6, paddingTop: 4 },
  privacy: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
