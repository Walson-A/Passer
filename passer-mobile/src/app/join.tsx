import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CheckIcon, ScanIcon, ShieldIcon, XIcon } from '@/components/icons';
import { SasDigits } from '@/components/sas-digits';
import { AppText } from '@/components/ui/app-text';
import { StatusScrim } from '@/components/ui/status-scrim';
import { Button } from '@/components/ui/button';
import { format, t } from '@/i18n';
import { announce } from '@/platform/accessibility';
import { haptic } from '@/platform/haptics';
import { errorMessage, useDevices } from '@/state/devices';
import { takePendingLink } from '@/state/pending-link';
import { useTheme } from '@/theme/theme';

type Phase =
  | { step: 'joining' }
  | { step: 'failed'; body: string; detail: string }
  | { step: 'compare'; group: string; sas: string }
  | { step: 'mismatch' };

/** The core's join errors, in words: an expired or used invitation, a phone already in a group, no answer. */
function explain(detail: string): string {
  const text = detail.toLowerCase();
  if (/already/.test(text)) return t.join.alreadyIn;
  if (/expired|invitation|used|invalid|ticket/.test(text)) return t.join.expired;
  if (/network|timed out|connect|unreachable/.test(text)) return t.join.network;
  return t.join.other;
}

/**
 * Joining your devices with the code the PC showed, then comparing the six digits on both
 * screens. A match is the only proof that the phone joined your PC and not someone else's.
 */
export default function Join() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const devices = useDevices();
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>({ step: 'joining' });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const link = takePendingLink();
    if (!link) {
      setPhase({ step: 'failed', body: t.join.expired, detail: '' });
      return;
    }
    devices
      .join(link)
      .then((result) => {
        haptic.success();
        announce(`${t.join.compareTitle}. ${result.sas.split('').join(' ')}`);
        setPhase({ step: 'compare', group: result.groupName, sas: result.sas });
      })
      .catch((error: unknown) => {
        haptic.error();
        const detail = errorMessage(error);
        setPhase({ step: 'failed', body: explain(detail), detail });
      });
  }, [devices]);

  const finish = () => router.replace('/');

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ backgroundColor: colors.ground }}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 20 }]}
      >
        {phase.step === 'joining' ? (
          <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(240)} style={styles.center}>
            <ActivityIndicator size="large" color={colors.text.secondary} />
            <AppText variant="heading" accessibilityRole="header" style={styles.text}>
              {t.join.joiningTitle}
            </AppText>
            <AppText variant="callout" tone="secondary" style={styles.text}>
              {t.join.joiningBody}
            </AppText>
          </Animated.View>
        ) : phase.step === 'failed' ? (
          <>
            <View style={styles.center}>
              <View style={[styles.badge, { backgroundColor: colors.status.errorWash }]}>
                <XIcon size={30} color={colors.status.error} strokeWidth={2.4} />
              </View>
              <AppText variant="heading" accessibilityRole="header" style={styles.text}>
                {t.join.failedTitle}
              </AppText>
              <AppText variant="callout" tone="secondary" style={styles.text}>
                {phase.body}
              </AppText>
              {phase.detail ? (
                <AppText variant="meta" tone="tertiary" selectable style={styles.text}>
                  {phase.detail}
                </AppText>
              ) : null}
            </View>
            <View style={styles.actions}>
              <Button label={t.join.scanAgain} icon={ScanIcon} onPress={() => router.replace('/scan')} />
              <Button
                label={t.common.close}
                tone="quiet"
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))}
              />
            </View>
          </>
        ) : phase.step === 'compare' ? (
          <>
            <View style={styles.center}>
              <Animated.View
                entering={reduceMotion ? undefined : ZoomIn.springify().damping(14)}
                style={[styles.badge, { backgroundColor: colors.status.okWash }]}
              >
                <CheckIcon size={30} color={colors.status.ok} strokeWidth={2.4} />
              </Animated.View>
              <AppText variant="largeTitle" accessibilityRole="header" style={styles.text}>
                {t.join.compareTitle}
              </AppText>
              <AppText variant="callout" tone="secondary" style={styles.text}>
                {format(t.join.compareBody, { group: phase.group })}
              </AppText>
            </View>
            <SasDigits sas={phase.sas} />
            <View style={styles.actions}>
              <Button label={t.join.same} onPress={finish} />
              <Button
                label={t.join.different}
                tone="destructive"
                onPress={() => {
                  haptic.warning();
                  void devices.disconnect();
                  setPhase({ step: 'mismatch' });
                }}
              />
              <AppText variant="footnote" tone="secondary" style={styles.text}>
                {t.join.differentHint}
              </AppText>
            </View>
          </>
        ) : (
          <>
            <View style={styles.center}>
              <View style={[styles.badge, { backgroundColor: colors.status.warnWash }]}>
                <ShieldIcon size={30} color={colors.status.warn} strokeWidth={2.2} />
              </View>
              <AppText variant="heading" accessibilityRole="header" style={styles.text}>
                {t.join.mismatchTitle}
              </AppText>
              <AppText variant="callout" tone="secondary" style={styles.text}>
                {t.join.mismatchBody}
              </AppText>
            </View>
            <View style={styles.actions}>
              <Button label={t.join.understood} tone="quiet" onPress={finish} />
            </View>
          </>
        )}
      </ScrollView>
      <StatusScrim />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, gap: 28, paddingHorizontal: 20 },
  center: { alignItems: 'center', gap: 12 },
  text: { textAlign: 'center' },
  badge: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  actions: { gap: 10, marginTop: 'auto' },
});
