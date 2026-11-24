import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DeviceGlyph } from '@/components/device-glyph';
import { ClipboardDownIcon, FileIcon, SendIcon } from '@/components/icons';
import { ReachLine } from '@/components/reach-line';
import { AppText } from '@/components/ui/app-text';
import { StatusScrim } from '@/components/ui/status-scrim';
import { Button } from '@/components/ui/button';
import { Disc } from '@/components/ui/disc';
import { BackHeader } from '@/components/ui/header';
import { Group, Row } from '@/components/ui/list';
import { Notice } from '@/components/ui/notice';
import { kindOf } from '@/core/devices';
import { format, t } from '@/i18n';
import { announce } from '@/platform/accessibility';
import { haptic } from '@/platform/haptics';
import { pickFiles } from '@/platform/media';
import { errorMessage, roleOf, useDevices } from '@/state/devices';
import { useTransfers } from '@/state/transfers';
import { useTheme } from '@/theme/theme';
import { deviceName } from '@/utils/format';

/**
 * One device: drawn large (the desktop Showroom's stage, kept to a phone's scale), whether
 * it answers, what it can do, and the commands it answers to. Removing it is here too,
 * for a phone that manages devices.
 */
export default function DeviceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const devices = useDevices();
  const transfers = useTransfers();
  const { status, me, reach, target } = devices;
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const member = status?.members.find((one) => one.id === id) ?? null;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/devices'));

  if (!member) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.ground, paddingTop: insets.top }]}>
        <BackHeader label={t.devices.title} onBack={back} />
      </View>
    );
  }

  const isMe = member.thisDevice;
  const isTarget = target?.id === member.id;
  const reachable = reach[member.id] !== 'unreachable';
  const kind = isMe ? 'phone' : kindOf(member.name);

  const useAsTarget = () => {
    devices.setTarget(member.id);
    haptic.select();
    router.navigate('/');
  };

  const remove = async () => {
    try {
      await devices.remove(member.id);
      haptic.success();
      announce(format(t.device.removed, { name: member.name }));
      back();
    } catch (error) {
      haptic.error();
      setProblem(errorMessage(error));
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ backgroundColor: colors.ground }}
        contentContainerStyle={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom + 110 }]}
      >
        <BackHeader label={t.devices.title} onBack={back} />

        <View style={styles.stage}>
          <View style={[styles.halo, { backgroundColor: colors.surface.raised }]} />
          <DeviceGlyph id={member.id} name={member.name} kind={kind} size={200} dim={!isMe && !reachable} />
        </View>

        <View style={styles.identity}>
          <AppText variant="largeTitle" style={styles.center} accessibilityRole="header">
            {isMe ? t.status.thisPhone : member.name}
          </AppText>
          {isMe ? (
            <>
              <AppText variant="headline" style={styles.center}>
                {deviceName(member.name)}
              </AppText>
              <AppText variant="subhead" tone="secondary" style={styles.center}>
                {t.device.thisPhoneBody}
              </AppText>
            </>
          ) : (
            <>
              <View style={styles.centerRow}>
                <ReachLine reach={reach[member.id]} />
              </View>
              {isTarget ? (
                <AppText variant="footnote" tone="secondary" style={styles.center}>
                  {t.device.selected}
                </AppText>
              ) : null}
            </>
          )}
        </View>

        {!isMe ? (
          <>
            <View style={styles.discs}>
              <Disc icon={SendIcon} label={t.device.sendHere} onPress={useAsTarget} disabled={!reachable} />
              <Disc
                icon={FileIcon}
                label={t.send.file}
                onPress={async () => {
                  devices.setTarget(member.id);
                  const files = await pickFiles();
                  if (files.length > 0) {
                    router.navigate('/');
                    void transfers.sendFiles(files);
                  }
                }}
                disabled={!reachable || transfers.active !== null}
              />
              <Disc
                icon={ClipboardDownIcon}
                label={t.send.theirClipboard}
                locked
                lockedLabel={t.send.asksFirst}
                onPress={() => {
                  devices.setTarget(member.id);
                  router.navigate('/');
                  void transfers.pull();
                }}
                disabled={!reachable || transfers.active !== null}
              />
            </View>
          </>
        ) : null}

        <Group header={t.device.details}>
          <Row title={t.device.role} detail={roleOf(member)} />
          <Row
            title={t.device.id}
            subtitle={
              <AppText variant="subhead" tone="secondary" selectable style={styles.mono}>
                {member.id}
              </AppText>
            }
          />
        </Group>

        {problem ? <Notice tone="error" title={t.devices.failed} detail={problem} onClose={() => setProblem(null)} /> : null}

        {!isMe ? (
          me?.approver ? (
            confirming ? (
              <Notice tone="warn" title={format(t.device.removeTitle, { name: member.name })} body={t.device.removeBody}>
                <View style={styles.confirm}>
                  <Button label={t.common.cancel} tone="quiet" grow onPress={() => setConfirming(false)} />
                  <Button label={t.device.removeConfirm} tone="destructive" grow onPress={() => void remove()} />
                </View>
              </Notice>
            ) : (
              <Group>
                <Row title={t.device.remove} tone="destructive" onPress={() => setConfirming(true)} />
              </Group>
            )
          ) : (
            <AppText variant="footnote" tone="secondary" style={styles.note}>
              {t.device.cantRemove}
            </AppText>
          )
        ) : null}
      </ScrollView>
      <StatusScrim />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 22 },
  stage: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  halo: { position: 'absolute', width: 230, height: 230, borderRadius: 115, opacity: 0.6 },
  identity: { gap: 6, paddingHorizontal: 20, alignItems: 'center' },
  center: { textAlign: 'center' },
  centerRow: { flexDirection: 'row', justifyContent: 'center' },
  discs: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 12, gap: 8 },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), fontSize: 13 },
  confirm: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  note: { paddingHorizontal: 32 },
});
