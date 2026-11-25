import { useEffect, useRef } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ClockIcon, ShieldIcon } from '@/components/icons';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { format, t } from '@/i18n';
import { announce } from '@/platform/accessibility';
import { haptic } from '@/platform/haptics';
import { look } from '@/platform/look';
import { useDevices } from '@/state/devices';
import { useTheme } from '@/theme/theme';
import { deviceName } from '@/utils/format';

import type { ApprovalRequest } from '../../modules/passer-core';
import { CountdownRing, useSecondsLeft } from './countdown-ring';
import { DeviceGlyph } from './device-glyph';

export type QueuedRequest = ApprovalRequest & { arrivedAt: number };

/** A capability's title in this language, when it is one Passer devices declare; otherwise as the device wrote it. */
function titleOf(request: ApprovalRequest): string {
  return t.approval.titles[request.title] ?? request.title;
}

/**
 * Another device asks this phone's user for something sensitive. One request at a time,
 * answered in reading order, as on the desktop: who, what, on what, how far a yes goes,
 * how long is left. A yes covers this request only; no answer is a no.
 *
 * A sheet rising from the bottom on iOS, a centred dialog on Android. Every string in it
 * comes from another device and is shown as plain text, wrapped rather than cut.
 */
export function ApprovalPrompt({
  request,
  waiting,
  onAnswer,
}: {
  request: QueuedRequest | null;
  waiting: number;
  onAnswer: (request: QueuedRequest, allow: boolean) => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const deadline = request ? request.arrivedAt + request.expiresInSecs * 1000 : 0;
  const seconds = useSecondsLeft(deadline);
  const shown = useRef<number | null>(null);
  // The request carries a short id; the drawing's colours come from the full one, as everywhere else.
  const members = useDevices().status?.members ?? [];

  useEffect(() => {
    if (!request || shown.current === request.id) return;
    shown.current = request.id;
    haptic.warning();
    announce(`${t.approval.heading}. ${request.requester}. ${titleOf(request)}`);
  }, [request]);

  if (!request) return null;

  const who = request.agent ? format(t.approval.agentOn, { agent: request.agent, name: request.requester }) : deviceName(request.requester);
  const ios = look === 'ios';

  const body = (
    <ScrollView
      bounces={false}
      contentContainerStyle={styles.content}
      accessibilityViewIsModal
      accessibilityLabel={t.approval.heading}
    >
      {ios ? <View style={[styles.grabber, { backgroundColor: colors.grabber }]} /> : null}
      <View style={styles.headingRow}>
        <View style={styles.heading}>
          <ShieldIcon size={18} color={colors.lock} strokeWidth={2.2} />
          <AppText variant="label" color={colors.lock} style={styles.headingText}>
            {t.approval.heading}
          </AppText>
        </View>
        <CountdownRing seconds={seconds} total={request.expiresInSecs} />
      </View>

      <View style={styles.who}>
        <DeviceGlyph
          id={members.find((member) => member.id.startsWith(request.requesterId))?.id ?? request.requesterId}
          name={request.requester}
          size={52}
        />
        <View style={styles.flex}>
          <AppText variant="headline">{who}</AppText>
          <AppText variant="subhead" tone="secondary">
            {t.approval.oneOfYours} · <AppText variant="subhead" tone="secondary" style={styles.mono}>{request.requesterId}</AppText>
          </AppText>
        </View>
      </View>

      <View style={[styles.what, { backgroundColor: colors.surface.raised, borderColor: colors.border.subtle }]}>
        <View style={styles.whatTop}>
          <AppText variant="label" tone="tertiary">
            {t.approval.wantsTo}
          </AppText>
          <AppText variant="heading">{titleOf(request)}</AppText>
          {request.target ? (
            <AppText variant="subhead" tone="secondary">
              {format(t.approval.on, { target: request.target })}
            </AppText>
          ) : null}
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border.subtle }]} />
        <View style={styles.scope}>
          <ClockIcon size={18} color={colors.text.secondary} strokeWidth={2} />
          <AppText variant="subhead" tone="secondary" style={styles.flex}>
            <AppText variant="subhead" style={styles.strong}>
              {t.approval.scopeTitle}
            </AppText>{' '}
            {request.minutes > 0 ? format(t.approval.scopeBody, { minutes: request.minutes }) : t.approval.scopeBodyShort}
          </AppText>
        </View>
      </View>

      <View style={[styles.actions, !ios && styles.actionsAndroid]}>
        <Button label={t.approval.deny} tone="quiet" grow={ios} onPress={() => onAnswer(request, false)} />
        <Button label={t.approval.allow} tone="navy" grow={ios} onPress={() => onAnswer(request, true)} />
      </View>
      <AppText variant="footnote" tone="secondary" style={styles.center}>
        {t.approval.noAnswer}
        {waiting > 0 ? ` ${format(waiting === 1 ? t.approval.queued : t.approval.queuedMany, { count: waiting })}.` : ''}
      </AppText>
    </ScrollView>
  );

  return (
    <Modal
      transparent
      statusBarTranslucent
      animationType={ios ? 'slide' : 'fade'}
      onRequestClose={() => onAnswer(request, false)}
    >
      <View style={[styles.scrim, { backgroundColor: colors.scrim }, ios ? styles.scrimSheet : styles.scrimDialog]}>
        <View
          style={[
            ios ? styles.sheet : styles.dialog,
            { backgroundColor: colors.surface.sheet, borderColor: colors.border.raised },
            ios && { paddingBottom: insets.bottom + 12 },
          ]}
        >
          {body}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1 },
  scrimSheet: { justifyContent: 'flex-end' },
  scrimDialog: { justifyContent: 'center', paddingHorizontal: 20 },
  sheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, borderWidth: 1, borderBottomWidth: 0, maxHeight: '92%' },
  dialog: { borderRadius: 28, maxHeight: '86%' },
  content: { padding: 20, gap: 16 },
  grabber: { width: 36, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: -8 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  headingText: { flexShrink: 1 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  flex: { flex: 1 },
  mono: { fontVariant: ['tabular-nums'], fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },
  what: { borderRadius: 18, borderWidth: 1 },
  whatTop: { padding: 16, gap: 4 },
  divider: { height: StyleSheet.hairlineWidth },
  scope: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14 },
  strong: { fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  actionsAndroid: { justifyContent: 'flex-end' },
  center: { textAlign: 'center' },
});
