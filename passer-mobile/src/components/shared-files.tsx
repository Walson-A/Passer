import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { classifyCallError, listFilesOf, type SharedFile } from '@/core/device-calls';
import { format, t } from '@/i18n';
import { announce } from '@/platform/accessibility';
import { haptic } from '@/platform/haptics';
import { receivedFileUri, shareFile } from '@/platform/media';
import { errorMessage, useDevices } from '@/state/devices';
import { useHistory } from '@/state/history';
import { useTheme } from '@/theme/theme';
import { formatBytes, formatRelative } from '@/utils/format';

import type { Member } from '../../modules/passer-core';
import { FileIcon } from './icons';
import { AppText } from './ui/app-text';
import { Group, Row } from './ui/list';
import { Notice } from './ui/notice';

type Phase = { step: 'loading' } | { step: 'ready'; files: SharedFile[] } | { step: 'failed'; detail: string };

/**
 * What a device shares, as on the desktop's device page: its files (`file.list`), each with
 * *Get* (`file.get`, a stream). There is no shared folder for the whole group: each device
 * shares its own, reached through that device. Shown only when the device offers both and
 * this build carries streams.
 */
export function SharedFiles({ member }: { member: Member }) {
  const { colors } = useTheme();
  const devices = useDevices();
  const { record } = useHistory();
  const [phase, setPhase] = useState<Phase>({ step: 'loading' });
  const [getting, setGetting] = useState<{ name: string; percent: number } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const offered = devices.offers[member.id];
  const available =
    devices.canStream &&
    (offered?.some((offer) => offer.name === 'file.list') ?? false) &&
    (offered?.some((offer) => offer.name === 'file.get') ?? false);

  const { call } = devices;
  const load = useCallback(() => {
    setPhase({ step: 'loading' });
    listFilesOf(call, member.id)
      .then((files) => setPhase({ step: 'ready', files }))
      .catch((error: unknown) => setPhase({ step: 'failed', detail: classifyCallError(error).detail }));
  }, [call, member.id]);

  useEffect(() => {
    if (available) load();
  }, [available, load]);

  if (!available) return null;

  const get = async (file: SharedFile) => {
    if (getting) return;
    setProblem(null);
    setGetting({ name: file.name, percent: 0 });
    const uri = receivedFileUri(file.name);
    try {
      await devices.fetchFile(member.id, 'file.get', { name: file.name }, uri, (done, total) => {
        const size = total ?? file.size ?? 0;
        if (size > 0) setGetting({ name: file.name, percent: Math.min(100, Math.round((done / size) * 100)) });
      });
      record({
        pcKey: member.id,
        peer: member.name,
        direction: 'received',
        kind: 'file',
        destination: 'files',
        title: file.name,
        size: file.size,
        fileUri: uri,
      });
      haptic.success();
      announce(format(t.device.got, { file: file.name }));
      await shareFile(uri, { mimeType: 'application/octet-stream', uti: 'public.data' }).catch(() => {});
    } catch (error) {
      haptic.error();
      setProblem(errorMessage(error));
    } finally {
      setGetting(null);
    }
  };

  const title = format(t.device.shares, { name: member.name });

  if (phase.step === 'loading') {
    return (
      <View style={styles.loading} accessible accessibilityLabel={t.device.sharesLoading}>
        <ActivityIndicator color={colors.text.secondary} />
        <AppText variant="subhead" tone="secondary">
          {t.device.sharesLoading}
        </AppText>
      </View>
    );
  }

  if (phase.step === 'failed') {
    return (
      <Notice
        tone="error"
        title={t.device.sharesFailed}
        detail={phase.detail}
        actions={[{ label: t.common.retry, onPress: load, tone: 'quiet' }]}
      />
    );
  }

  return (
    <>
      {problem ? <Notice tone="error" title={t.devices.failed} detail={problem} onClose={() => setProblem(null)} /> : null}
      <Group
        header={title}
        footer={phase.files.length > 0 ? t.device.sharesFooter : format(t.device.sharesEmpty, { name: member.name })}
      >
        {phase.files.map((file) => {
          const busy = getting?.name === file.name;
          return (
            <Row
              key={file.name}
              title={file.name}
              leading={<FileIcon size={22} color={colors.destination.folder} strokeWidth={1.9} />}
              subtitle={[
                file.size !== null ? formatBytes(file.size) : null,
                file.modified ? formatRelative(file.modified * 1000) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              trailing={
                <AppText variant="callout" color={busy ? colors.text.secondary : colors.link} numberOfLines={1} style={styles.action}>
                  {busy ? format(t.device.getting, { percent: `${getting.percent} %` }) : t.device.get}
                </AppText>
              }
              disabled={getting !== null && !busy}
              accessibilityLabel={`${t.device.get} ${file.name}`}
              onPress={() => void get(file)}
            />
          );
        })}
      </Group>
    </>
  );
}

const styles = StyleSheet.create({
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 32 },
  action: { maxWidth: '45%' },
});
