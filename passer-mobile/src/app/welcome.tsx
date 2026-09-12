import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import type { ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LaptopIcon, ScanIcon, ShieldIcon, WifiIcon, type IconProps } from '@/components/icons';
import { AppText } from '@/components/ui/app-text';
import { PressableScale } from '@/components/ui/pressable-scale';
import { PrimaryButton } from '@/components/ui/primary-button';
import { t } from '@/i18n';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';

const icon = require('@/assets/images/splash-icon.png');

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: colors.ground, paddingTop: insets.top + 40, paddingBottom: insets.bottom + 12 },
      ]}
    >
      <Animated.View entering={FadeIn.duration(420)} style={styles.hero}>
        <Image source={icon} style={styles.mark} contentFit="contain" accessibilityIgnoresInvertColors />
        <AppText variant="pcName" accessibilityRole="header" style={styles.center}>
          {t.welcome.title}
        </AppText>
        <AppText variant="body" tone="secondary" style={[styles.center, styles.lede]}>
          {t.welcome.body}
        </AppText>
      </Animated.View>

      <View style={styles.steps}>
        <Step index={0} icon={LaptopIcon} title={t.welcome.stepPcTitle} body={t.welcome.stepPcBody} />
        <Step index={1} icon={WifiIcon} title={t.welcome.stepNetworkTitle} body={t.welcome.stepNetworkBody} />
      </View>

      <Animated.View entering={FadeInDown.delay(260).duration(360)} style={styles.actions}>
        <PrimaryButton label={t.welcome.scan} icon={ScanIcon} onPress={() => router.push('/scan')} />
        <PressableScale accessibilityRole="button" onPress={() => router.push('/manual')} style={styles.secondary}>
          <AppText variant="body" tone="secondary">
            {t.welcome.manual}
          </AppText>
        </PressableScale>
        <View style={styles.privacy}>
          <ShieldIcon size={13} color={colors.icon.dim} strokeWidth={2} />
          <AppText variant="caption" tone="tertiary">
            {t.welcome.privacy}
          </AppText>
        </View>
      </Animated.View>
    </View>
  );
}

function Step({
  index,
  icon: Icon,
  title,
  body,
}: {
  index: number;
  icon: ComponentType<IconProps>;
  title: string;
  body: string;
}) {
  const { colors } = useTheme();
  return (
    <Animated.View
      entering={FadeInDown.delay(120 + index * 90).duration(360)}
      style={[styles.step, { backgroundColor: colors.surface.card, borderColor: colors.border.subtle }]}
    >
      <View style={[styles.stepIcon, { backgroundColor: colors.surface.raised, borderColor: colors.border.raised }]}>
        <Icon size={18} color={colors.icon.normal} />
      </View>
      <View style={styles.stepText}>
        <AppText variant="body" style={styles.strong}>
          {title}
        </AppText>
        <AppText variant="caption" tone="secondary">
          {body}
        </AppText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 20 },
  hero: { alignItems: 'center', gap: 10 },
  mark: { width: 96, height: 96, marginBottom: 14 },
  center: { textAlign: 'center' },
  lede: { maxWidth: 320 },
  steps: { flex: 1, justifyContent: 'center', gap: 10 },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: radius.socket,
    borderWidth: 1,
  },
  stepIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { flex: 1, gap: 3 },
  strong: { fontWeight: '600' },
  actions: { gap: 6 },
  secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  privacy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6 },
});
