import type { ComponentType, ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { CheckIcon, InfoIcon, XIcon, type IconProps } from '@/components/icons';
import { t } from '@/i18n';
import { useTheme } from '@/theme/theme';

import { AppText } from './app-text';
import { Button } from './button';
import { PressableScale } from './pressable-scale';

export type NoticeTone = 'ok' | 'error' | 'warn' | 'info' | 'busy';

type Action = { label: string; onPress: () => void; tone?: 'navy' | 'quiet' | 'primary' | 'plain' };

/**
 * Every state that needs words: a transfer that landed, a refusal, a device that isn't
 * answering, a wait for someone's approval. Plain sentence first; never raw error text alone.
 */
export function Notice({
  tone,
  title,
  body,
  detail,
  actions = [],
  onClose,
  icon,
  children,
}: {
  tone: NoticeTone;
  title: string;
  body?: string;
  /** Raw detail under the sentence, for someone who wants to know more. */
  detail?: string;
  actions?: Action[];
  onClose?: () => void;
  icon?: ComponentType<IconProps>;
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const accent = {
    ok: colors.status.ok,
    error: colors.status.error,
    warn: colors.status.warn,
    info: colors.link,
    busy: colors.text.secondary,
  }[tone];
  const wash = {
    ok: colors.status.okWash,
    error: colors.status.errorWash,
    warn: colors.status.warnWash,
    info: colors.surface.raised,
    busy: colors.surface.raised,
  }[tone];
  const Icon = icon ?? (tone === 'ok' ? CheckIcon : InfoIcon);

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.duration(260)}
      exiting={reduceMotion ? undefined : FadeOut.duration(160)}
      accessibilityRole={tone === 'error' || tone === 'warn' ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
      style={[styles.card, { backgroundColor: colors.group.cell, borderColor: colors.border.subtle }]}
    >
      <View style={styles.top}>
        <View style={[styles.badge, { backgroundColor: wash }]}>
          {tone === 'busy' ? <ActivityIndicator color={accent} /> : <Icon size={20} color={accent} strokeWidth={2.2} />}
        </View>
        <View style={styles.text}>
          <AppText variant="headline">{title}</AppText>
          {body ? (
            <AppText variant="subhead" tone="secondary">
              {body}
            </AppText>
          ) : null}
          {detail ? (
            <AppText variant="meta" tone="tertiary" selectable>
              {detail}
            </AppText>
          ) : null}
        </View>
        {onClose ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t.common.close}
            onPress={onClose}
            hitSlop={8}
            style={styles.close}
          >
            <XIcon size={18} color={colors.text.tertiary} strokeWidth={2} />
          </PressableScale>
        ) : null}
      </View>
      {children}
      {actions.length ? (
        <View style={styles.actions}>
          {actions.map((action) => (
            <Button key={action.label} label={action.label} onPress={action.onPress} tone={action.tone ?? 'quiet'} grow />
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}

/** A whole screen with nothing to show yet: what it will hold, and how to get there. */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: ComponentType<IconProps>;
  title: string;
  body: string;
  action?: Action;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.surface.raised }]}>
        <Icon size={30} color={colors.text.secondary} strokeWidth={1.6} />
      </View>
      <AppText variant="heading" style={styles.center} accessibilityRole="header">
        {title}
      </AppText>
      <AppText variant="callout" tone="secondary" style={styles.center}>
        {body}
      </AppText>
      {action ? (
        <View style={styles.emptyAction}>
          <Button label={action.label} onPress={action.onPress} tone={action.tone ?? 'navy'} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, borderRadius: 22, borderWidth: 1, padding: 16, gap: 14 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  badge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 3, paddingTop: 1 },
  close: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginRight: -6, marginTop: -4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  empty: { alignItems: 'center', gap: 10, paddingHorizontal: 32, paddingVertical: 40 },
  emptyIcon: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  center: { textAlign: 'center' },
  emptyAction: { marginTop: 12, alignSelf: 'stretch' },
});
