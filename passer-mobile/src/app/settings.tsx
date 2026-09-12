import * as Application from 'expo-application';
import { useRouter } from 'expo-router';
import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { Linking, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ChevronRightIcon,
  LaptopIcon,
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
import { haptic } from '@/platform/haptics';
import type { PhotoDestination } from '@/platform/storage';
import { useHistory } from '@/state/history';
import { usePairings } from '@/state/pairings';
import { useSettings } from '@/state/settings';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';

/** Destructive actions arm on the first tap and disarm after this long, as on the desktop. */
const DISARM_MS = 4_000;

const pairedDate = new Intl.DateTimeFormat(language, { day: 'numeric', month: 'long', year: 'numeric' });

export default function Settings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { pc, forget } = usePairings();
  const { settings, updateSettings } = useSettings();
  const { clear } = useHistory();
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), DISARM_MS);
    return () => clearTimeout(timer);
  }, [armed]);

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
      </View>
    </ScrollView>
  );
}

function Section({ label, children }: { label?: string; children: ReactNode }) {
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
  trailing,
  chevron = false,
  onPress,
}: {
  icon: ComponentType<IconProps>;
  label: string;
  value?: string;
  tint?: string;
  trailing?: ReactNode;
  chevron?: boolean;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const content = (
    <>
      <Icon size={18} color={tint ?? colors.icon.normal} />
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

  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} onPress={onPress} pressedScale={0.99} style={styles.row}>
      {content}
    </PressableScale>
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
