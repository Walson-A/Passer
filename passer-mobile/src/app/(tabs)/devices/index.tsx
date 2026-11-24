import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DeviceGlyph } from '@/components/device-glyph';
import { CircleStopIcon, InfoIcon, LockIcon, QrIcon } from '@/components/icons';
import { ReachLine } from '@/components/reach-line';
import { AppText } from '@/components/ui/app-text';
import { StatusScrim } from '@/components/ui/status-scrim';
import { LargeHeader } from '@/components/ui/header';
import { Group, Row } from '@/components/ui/list';
import { Notice } from '@/components/ui/notice';
import { format, t } from '@/i18n';
import { announce } from '@/platform/accessibility';
import { haptic } from '@/platform/haptics';
import { errorMessage, roleOf, useDevices } from '@/state/devices';
import { useTheme } from '@/theme/theme';
import { deviceName } from '@/utils/format';

/**
 * Devices: every member of the group, this phone included, each with its drawing and
 * whether it answers. A device opens its own page; adding one is for devices that manage.
 */
export default function DevicesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const devices = useDevices();
  const { phase, me, others, reach, status } = devices;
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; title: string; detail?: string } | null>(null);
  const [preview, setPreview] = useState(false);

  const managers = others.filter((member) => member.approver);
  const subtitle =
    others.length === 0
      ? t.devices.countNone
      : others.length === 1
        ? t.devices.countOne
        : format(t.devices.count, { count: others.length });

  const stop = async () => {
    try {
      await devices.stopAllSessions();
      haptic.success();
      announce(t.devices.stopped);
      setMessage({ tone: 'ok', title: t.devices.stopped });
    } catch (error) {
      haptic.error();
      setMessage({ tone: 'error', title: t.devices.failed, detail: errorMessage(error) });
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ backgroundColor: colors.ground }}
        contentContainerStyle={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom + 110 }]}
      >
        <LargeHeader title={t.devices.title} subtitle={phase === 'ready' && status?.group ? subtitle : undefined} />

        {phase === 'loading' ? (
          <View style={styles.skeleton} accessible accessibilityLabel={t.send.loadingTitle}>
            {[0, 1, 2].map((key) => (
              <View key={key} style={[styles.skeletonRow, { backgroundColor: colors.surface.raised }]} />
            ))}
          </View>
        ) : phase === 'failed' ? (
          <Notice
            tone="error"
            title={t.devices.loadFailedTitle}
            detail={devices.loadError ?? undefined}
            actions={[{ label: t.common.retry, onPress: devices.reload, tone: 'quiet' }]}
          />
        ) : (
          <>
            {message ? (
              <Notice tone={message.tone} title={message.title} detail={message.detail} onClose={() => setMessage(null)} />
            ) : null}

            <Group
              footer={
                me?.approver
                  ? undefined
                  : managers.length > 0
                    ? format(t.devices.addNeedsManager, { name: managers[0].name })
                    : undefined
              }
            >
              {others.map((member) => (
                <Row
                  key={member.id}
                  title={deviceName(member.name)}
                  leading={<DeviceGlyph id={member.id} name={member.name} kind={member.kind} size={48} dim={reach[member.id] === 'unreachable'} />}
                  subtitle={<ReachLine reach={reach[member.id]} answeredAt={member.answeredAt} suffix={roleOf(member)} />}
                  onPress={() => router.push(`/devices/${member.id}`)}
                  chevron
                />
              ))}
              {me ? (
                <Row
                  key={me.id}
                  title={t.status.thisPhone}
                  leading={<DeviceGlyph id={me.id} name={me.name} kind={me.kind} size={48} />}
                  subtitle={`${deviceName(me.name)} · ${roleOf(me)}`}
                  onPress={() => router.push(`/devices/${me.id}`)}
                  chevron
                />
              ) : null}
              {me?.approver ? (
                <Row
                  key="add"
                  title={t.devices.add}
                  tone="link"
                  leading={<QrIcon size={24} color={colors.link} strokeWidth={2} />}
                  onPress={() => router.push('/invite')}
                />
              ) : null}
            </Group>

            <Group footer={t.devices.stopHint}>
              <Row
                title={t.devices.stop}
                tone="destructive"
                leading={<CircleStopIcon size={22} color={colors.status.error} strokeWidth={2} />}
                onPress={() => void stop()}
              />
            </Group>

            <View style={styles.foot}>
              <View style={styles.footRow}>
                <LockIcon size={15} color={colors.text.secondary} strokeWidth={2} />
                <AppText variant="footnote" tone="secondary" style={styles.flex}>
                  {t.devices.encrypted}
                </AppText>
              </View>
              <Row
                title={t.devices.preview}
                leading={<InfoIcon size={18} color={colors.text.secondary} strokeWidth={2} />}
                onPress={() => setPreview((open) => !open)}
                accessibilityHint={t.devices.previewBody}
              />
              {preview ? (
                <AppText variant="footnote" tone="secondary" style={styles.previewText}>
                  {t.devices.previewBody}
                </AppText>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>
      <StatusScrim />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 24 },
  flex: { flex: 1 },
  skeleton: { marginHorizontal: 16, gap: 10 },
  skeletonRow: { height: 68, borderRadius: 18 },
  foot: { gap: 4, paddingHorizontal: 4 },
  footRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 32 },
  previewText: { paddingHorizontal: 32 },
});
