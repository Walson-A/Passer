import { useEffect } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ShieldIcon } from '@/components/icons';
import { AppText } from '@/components/ui/app-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { format, t } from '@/i18n';
import { haptic } from '@/platform/haptics';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';

import type { ApprovalRequest } from '../../modules/passer-core';

/**
 * Another device asks this phone's user for something sensitive (reading the clipboard,
 * a longer session). Shown over any screen; no answer before the core's deadline is a no.
 */
export function ApprovalPrompt({
  request,
  onAnswer,
}: {
  request: ApprovalRequest | null;
  onAnswer: (request: ApprovalRequest, allow: boolean) => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (request) haptic.warning();
  }, [request]);

  if (!request) return null;

  const details = [
    request.agent ? format(t.devices.approveAgent, { agent: request.agent }) : null,
    request.minutes > 0 ? format(t.devices.approveFor, { minutes: request.minutes }) : null,
  ].filter(Boolean);

  return (
    <Modal transparent animationType="fade" onRequestClose={() => onAnswer(request, false)}>
      <View style={[styles.scrim, { backgroundColor: colors.scrim, paddingBottom: insets.bottom + 16 }]}>
        <View
          accessibilityViewIsModal
          style={[styles.card, { backgroundColor: colors.surface.sheet, borderColor: colors.border.raised }]}
        >
          <View style={styles.heading}>
            <ShieldIcon size={20} color={colors.status.warn} strokeWidth={2} />
            <AppText variant="caption" tone="secondary" numberOfLines={1} style={styles.flex}>
              {format(t.devices.approveTitle, { name: request.requester })}
            </AppText>
          </View>
          <AppText variant="title" accessibilityRole="header">
            {request.title}
          </AppText>
          {request.target ? (
            <AppText variant="body" tone="secondary" numberOfLines={3}>
              {request.target}
            </AppText>
          ) : null}
          {details.length ? (
            <AppText variant="caption" tone="tertiary">
              {details.join(' · ')}
            </AppText>
          ) : null}
          <View style={styles.actions}>
            <View style={styles.flex}>
              <PrimaryButton tone="quiet" label={t.devices.deny} onPress={() => onAnswer(request, false)} />
            </View>
            <View style={styles.flex}>
              <PrimaryButton label={t.devices.allow} onPress={() => onAnswer(request, true)} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 12 },
  card: { borderRadius: radius.sheet, borderWidth: 1, padding: 20, gap: 10 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
});
