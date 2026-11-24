import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LockIcon, ScanIcon } from '@/components/icons';
import { AppText } from '@/components/ui/app-text';
import { StatusScrim } from '@/components/ui/status-scrim';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { t } from '@/i18n';
import { haptic } from '@/platform/haptics';
import { errorMessage, useDevices } from '@/state/devices';
import { useTheme } from '@/theme/theme';

const icon = require('@/assets/images/splash-icon.png');

/**
 * First launch: what Passer does, and the one way in: the code on the PC. The three steps
 * say where the code is and what to check, because the six digits are what keep a
 * stranger's device out.
 */
export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const devices = useDevices();
  const reduceMotion = useReducedMotion();
  const [starting, setStarting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const startAlone = async () => {
    setStarting(true);
    setProblem(null);
    try {
      await devices.createGroup();
      haptic.success();
      router.replace('/devices');
    } catch (error) {
      haptic.error();
      setProblem(errorMessage(error));
    } finally {
      setStarting(false);
    }
  };

  const steps = [t.welcome.stepPc, t.welcome.stepScan, t.welcome.stepCompare];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ backgroundColor: colors.ground }}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
      >
        <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(420)} style={styles.hero}>
          <Image source={icon} style={styles.mark} contentFit="contain" accessibilityIgnoresInvertColors />
          <AppText variant="largeTitle" accessibilityRole="header" style={styles.center}>
            {t.welcome.title}
          </AppText>
          <AppText variant="callout" tone="secondary" style={styles.center}>
            {t.welcome.body}
          </AppText>
        </Animated.View>

        <View style={[styles.steps, { backgroundColor: colors.group.cell }]}>
          {steps.map((step, index) => (
            <View key={step} style={styles.step}>
              <View style={[styles.number, { backgroundColor: colors.navy.background, borderColor: colors.navy.border }]}>
                <AppText variant="footnote" color={colors.navy.text} style={styles.bold} maxFontSizeMultiplier={1.3}>
                  {index + 1}
                </AppText>
              </View>
              <AppText variant="callout" style={styles.flex}>
                {step}
              </AppText>
            </View>
          ))}
        </View>

        {problem ? <Notice tone="error" title={t.devices.failed} detail={problem} onClose={() => setProblem(null)} /> : null}

        <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(220).duration(360)} style={styles.actions}>
          <Button label={t.welcome.scan} icon={ScanIcon} onPress={() => router.push('/scan')} />
          <Button label={t.welcome.link} tone="quiet" onPress={() => router.push('/manual')} />
          <Button
            label={starting ? t.welcome.starting : t.welcome.alone}
            tone="plain"
            busy={starting}
            onPress={() => void startAlone()}
          />
        </Animated.View>

        <View style={styles.privacy}>
          <LockIcon size={14} color={colors.text.tertiary} strokeWidth={2} />
          <AppText variant="footnote" tone="tertiary" style={styles.flexShrink}>
            {t.welcome.privacy}
          </AppText>
        </View>
      </ScrollView>
      <StatusScrim />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, gap: 24 },
  hero: { alignItems: 'center', gap: 12, paddingHorizontal: 28 },
  mark: { width: 72, height: 72, marginBottom: 4 },
  center: { textAlign: 'center' },
  steps: { marginHorizontal: 16, borderRadius: 22, padding: 18, gap: 16 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  number: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  bold: { fontWeight: '700' },
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1, textAlign: 'center' },
  actions: { paddingHorizontal: 16, gap: 10, marginTop: 'auto' },
  privacy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 24 },
});
