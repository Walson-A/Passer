import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CheckIcon, LaptopIcon, ScanIcon, ShieldIcon, SmartphoneIcon, TrashIcon, XIcon } from '@/components/icons';
import { AppText } from '@/components/ui/app-text';
import { PressableScale } from '@/components/ui/pressable-scale';
import { PrimaryButton } from '@/components/ui/primary-button';
import { format, t } from '@/i18n';
import { announce } from '@/platform/accessibility';
import { haptic } from '@/platform/haptics';
import { errorMessage, useDevices } from '@/state/devices';
import { takePendingLink } from '@/state/pending-link';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';

import { isCoreInvitation, type Member } from '../../modules/passer-core';

/** Destructive actions arm on the first tap and disarm after this long, as in Settings. */
const DISARM_MS = 4_000;

type Joining = { kind: 'joining' } | { kind: 'joined'; groupName: string; sas: string } | { kind: 'failed'; message: string };

export default function Devices() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const devices = useDevices();
  const { status } = devices;
  const [joining, setJoining] = useState<Joining | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const started = useRef(false);

  // A code scanned on the scanner arrives here, out of the route.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const link = takePendingLink();
    if (!link || !isCoreInvitation(link)) return;
    setJoining({ kind: 'joining' });
    devices
      .join(link)
      .then((result) => {
        haptic.success();
        announce(format(t.devices.joinedTitle, { name: result.groupName }));
        setJoining({ kind: 'joined', ...result });
      })
      .catch((error: unknown) => {
        haptic.error();
        setJoining({ kind: 'failed', message: errorMessage(error) });
      });
  }, [devices]);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(null), DISARM_MS);
    return () => clearTimeout(timer);
  }, [armed]);

  const run = async (work: () => Promise<void>) => {
    try {
      await work();
      haptic.success();
    } catch (error) {
      haptic.error();
      setJoining({ kind: 'failed', message: errorMessage(error) });
    }
  };

  const removeMember = (member: Member) => {
    if (armed !== member.id) {
      haptic.warning();
      setArmed(member.id);
      return;
    }
    setArmed(null);
    void run(() => devices.remove(member.id));
  };

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
      <View style={styles.titleRow}>
        <AppText variant="title" accessibilityRole="header" style={styles.flex}>
          {status?.group ?? t.devices.title}
        </AppText>
        {status?.group ? <OnlineBadge online={status.running} /> : null}
      </View>

      {joining ? <JoinBanner joining={joining} onClose={() => setJoining(null)} /> : null}
      {devices.joined ? (
        <Banner
          tone="ok"
          title={format(t.devices.deviceJoinedTitle, { name: devices.joined.name })}
          body={format(t.devices.joinedBody, { sas: devices.joined.sas })}
          onClose={devices.dismissJoined}
        />
      ) : null}

      {!devices.available ? (
        <Intro title={t.devices.unavailableTitle} body={t.devices.unavailableBody} />
      ) : !status?.group ? (
        joining?.kind === 'joining' ? null : (
          <>
            <Intro title={t.devices.introTitle} body={t.devices.introBody} />
            <View style={styles.actions}>
              <PrimaryButton icon={ScanIcon} label={t.devices.scan} onPress={() => router.push('/scan')} />
              <PrimaryButton
                tone="quiet"
                label={t.devices.createHere}
                onPress={() => void run(() => devices.createGroup(t.devices.defaultGroup))}
              />
            </View>
          </>
        )
      ) : (
        <>
          <Card>
            {status.members.map((member, index) => (
              <View key={member.id}>
                {index > 0 ? <Divider /> : null}
                <MemberRow
                  member={member}
                  armed={armed === member.id}
                  onRemove={member.thisDevice ? undefined : () => removeMember(member)}
                />
              </View>
            ))}
          </Card>
          <View style={styles.section}>
            <Card>
              <PressableScale
                accessibilityRole="button"
                onPress={() => void run(devices.stopAllSessions)}
                pressedScale={0.99}
                style={styles.row}
              >
                <ShieldIcon size={18} color={colors.status.error} />
                <AppText variant="body" color={colors.status.error} style={styles.flex}>
                  {t.devices.stopSessions}
                </AppText>
              </PressableScale>
            </Card>
            <AppText variant="caption" tone="tertiary" style={styles.footer}>
              {t.devices.stopSessionsHint}
            </AppText>
          </View>
        </>
      )}
    </ScrollView>
  );
}

function MemberRow({ member, armed, onRemove }: { member: Member; armed: boolean; onRemove?: () => void }) {
  const { colors } = useTheme();
  const Icon = member.kind === 'phone' || member.kind === 'tablet' ? SmartphoneIcon : LaptopIcon;
  const system = osLabel(member);
  const detail = [member.thisDevice ? t.devices.thisDevice : null, member.approver ? t.devices.approver : null, system ?? member.shortId]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={styles.row}>
      <Icon size={18} color={colors.icon.normal} />
      <View style={styles.flex}>
        <AppText variant="body" numberOfLines={1}>
          {member.name}
        </AppText>
        <AppText variant="caption" tone="tertiary" numberOfLines={1}>
          {detail}
        </AppText>
      </View>
      {onRemove ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={format(armed ? t.devices.removeConfirm : t.devices.remove, { name: member.name })}
          onPress={onRemove}
          style={[styles.remove, armed && { backgroundColor: colors.status.errorWash }]}
        >
          {armed ? (
            <AppText variant="caption" color={colors.status.error}>
              {format(t.devices.removeConfirm, { name: '' }).trim()}
            </AppText>
          ) : (
            <TrashIcon size={16} color={colors.icon.dim} />
          )}
        </PressableScale>
      ) : null}
    </View>
  );
}

/** `Windows 10.0.26100`, `iOS 18.2`: what the member said about itself, if anything. */
function osLabel(member: Member): string | null {
  if (!member.os) return null;
  const names: Record<string, string> = { windows: 'Windows', macos: 'macOS', ios: 'iOS', android: 'Android', linux: 'Linux' };
  return [names[member.os] ?? member.os, member.osVersion].filter(Boolean).join(' ');
}

function JoinBanner({ joining, onClose }: { joining: Joining; onClose: () => void }) {
  if (joining.kind === 'joining') return <Banner tone="busy" title={t.devices.joining} />;
  if (joining.kind === 'failed') {
    return <Banner tone="error" title={format(t.devices.failed, { message: joining.message })} onClose={onClose} />;
  }
  return (
    <Banner
      tone="ok"
      title={format(t.devices.joinedTitle, { name: joining.groupName })}
      body={format(t.devices.joinedBody, { sas: joining.sas })}
      onClose={onClose}
    />
  );
}

function Banner({ tone, title, body, onClose }: { tone: 'ok' | 'error' | 'busy'; title: string; body?: string; onClose?: () => void }) {
  const { colors } = useTheme();
  const wash = tone === 'ok' ? colors.status.okWash : tone === 'error' ? colors.status.errorWash : colors.surface.raised;
  return (
    <View accessibilityRole="alert" style={[styles.banner, { backgroundColor: wash, borderColor: colors.border.subtle }]}>
      {tone === 'busy' ? (
        <ActivityIndicator color={colors.text.secondary} />
      ) : tone === 'ok' ? (
        <CheckIcon size={18} color={colors.status.ok} strokeWidth={2} />
      ) : null}
      <View style={styles.flex}>
        <AppText variant="body">{title}</AppText>
        {body ? (
          <AppText variant="caption" tone="secondary">
            {body}
          </AppText>
        ) : null}
      </View>
      {onClose ? (
        <PressableScale accessibilityRole="button" accessibilityLabel={t.common.close} onPress={onClose} style={styles.close}>
          <XIcon size={16} color={colors.icon.dim} strokeWidth={2} />
        </PressableScale>
      ) : null}
    </View>
  );
}

function OnlineBadge({ online }: { online: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.badge}>
      <View style={[styles.dot, { backgroundColor: online ? colors.status.ok : colors.icon.dim }]} />
      <AppText variant="caption" tone="tertiary">
        {online ? t.devices.online : t.devices.offline}
      </AppText>
    </View>
  );
}

function Intro({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.intro}>
      <AppText variant="body" style={styles.strong}>
        {title}
      </AppText>
      <AppText variant="body" tone="secondary">
        {body}
      </AppText>
    </View>
  );
}

function Card({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return <View style={[styles.card, { backgroundColor: colors.surface.card, borderColor: colors.border.subtle }]}>{children}</View>;
}

function Divider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.border.subtle }]} />;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 28, gap: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, gap: 2 },
  strong: { fontWeight: '600' },
  intro: { gap: 6, paddingHorizontal: 4 },
  actions: { gap: 10 },
  section: { gap: 8 },
  footer: { paddingHorizontal: 4 },
  card: { borderRadius: radius.card, borderWidth: 1, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 44 },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 8 },
  remove: { minWidth: 44, minHeight: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.card, borderWidth: 1 },
  close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
