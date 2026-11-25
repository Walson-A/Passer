import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { ScrollView, Share, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CheckIcon, CopyIcon, ShieldIcon } from '@/components/icons';
import { QrCode } from '@/components/qr-code';
import { useSecondsLeft } from '@/components/countdown-ring';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Group, Row } from '@/components/ui/list';
import { Notice } from '@/components/ui/notice';
import { clock } from '@/core/devices';
import { format, t } from '@/i18n';
import { haptic } from '@/platform/haptics';
import { errorMessage, useDevices } from '@/state/devices';
import { useTheme } from '@/theme/theme';

/** The desktop's invitations last 10 minutes; so do the phone's. */
const LIFETIME_MS = 10 * 60_000;

type Code = { link: string; until: number };

/**
 * Add a device, from a phone that manages devices. Two steps, as on the desktop, because
 * the role is part of the invitation: first what the new device may do, then a one-time
 * code with how long it lasts. Leaving the sheet drops the code.
 */
export default function Invite() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const devices = useDevices();
  const [manager, setManager] = useState(false);
  const [code, setCode] = useState<Code | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const left = useSecondsLeft(code?.until ?? 0);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2_000);
    return () => clearTimeout(timer);
  }, [copied]);

  const create = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const link = await devices.invite(manager);
      setCode({ link, until: Date.now() + LIFETIME_MS });
      haptic.success();
    } catch (error) {
      haptic.error();
      setProblem(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const expired = code !== null && left === 0;

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
      <AppText variant="heading" accessibilityRole="header" style={styles.pad}>
        {t.invite.title}
      </AppText>

      {problem ? <Notice tone="error" title={t.invite.failed} detail={problem} onClose={() => setProblem(null)} /> : null}

      {!code ? (
        <>
          <Group header={t.invite.roleTitle}>
            <Row
              title={t.invite.roleSend}
              subtitle={t.invite.roleSendBody}
              trailing={!manager ? <CheckIcon size={20} color={colors.link} strokeWidth={2.6} /> : undefined}
              onPress={() => setManager(false)}
              accessibilityLabel={`${t.invite.roleSend}${!manager ? ' ✓' : ''}`}
            />
            <Row
              title={t.invite.roleManage}
              subtitle={t.invite.roleManageBody}
              trailing={manager ? <CheckIcon size={20} color={colors.link} strokeWidth={2.6} /> : undefined}
              onPress={() => setManager(true)}
              accessibilityLabel={`${t.invite.roleManage}${manager ? ' ✓' : ''}`}
            />
          </Group>
          <View style={styles.pad}>
            <Button label={t.invite.next} tone="navy" busy={busy} onPress={() => void create()} />
          </View>
        </>
      ) : (
        <>
          <AppText variant="callout" tone="secondary" style={styles.pad}>
            {t.invite.scanThis}
          </AppText>
          <View style={[styles.qr, expired && styles.faded]}>
            <QrCode value={code.link} size={Math.min(width - 96, 260)} label={t.invite.title} />
          </View>
          <AppText
            variant="headline"
            color={expired ? colors.status.error : colors.text.secondary}
            style={styles.center}
            accessibilityLiveRegion="polite"
          >
            {expired ? t.invite.expired : format(t.invite.expiresIn, { time: clock(left) })}
          </AppText>
          <View style={[styles.warning, { backgroundColor: colors.status.warnWash }]}>
            <ShieldIcon size={18} color={colors.status.warn} strokeWidth={2.2} />
            <AppText variant="subhead" style={styles.flex}>
              {t.invite.secret}
            </AppText>
          </View>
          <View style={styles.actions}>
            {expired ? (
              <Button label={t.invite.newCode} tone="navy" busy={busy} onPress={() => void create()} />
            ) : (
              <>
                <Button
                  label={copied ? t.invite.copied : t.invite.copyLink}
                  icon={copied ? CheckIcon : CopyIcon}
                  tone="quiet"
                  onPress={() => {
                    void Clipboard.setStringAsync(code.link);
                    haptic.success();
                    setCopied(true);
                  }}
                />
                <Button label={t.invite.shareLink} tone="plain" onPress={() => void Share.share({ message: code.link })} />
              </>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 28, gap: 18 },
  pad: { paddingHorizontal: 20 },
  center: { textAlign: 'center', paddingHorizontal: 20 },
  qr: { alignItems: 'center' },
  faded: { opacity: 0.25 },
  warning: { marginHorizontal: 16, borderRadius: 16, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  flex: { flex: 1 },
  actions: { paddingHorizontal: 16, gap: 10 },
});
