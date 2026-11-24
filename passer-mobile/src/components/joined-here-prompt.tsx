import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic } from '@/platform/haptics';
import { format, t } from '@/i18n';
import { look } from '@/platform/look';
import { useDevices } from '@/state/devices';
import { useTheme } from '@/theme/theme';

import { SasDigits } from './sas-digits';
import { AppText } from './ui/app-text';
import { Button } from './ui/button';

/**
 * A device just joined through one of this phone's invitations: the same code must show on
 * both screens. "It's different" removes it at once, as on the desktop.
 */
export function JoinedHerePrompt() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { joinedHere, dismissJoinedHere, status, remove } = useDevices();
  if (!joinedHere) return null;

  const removeIt = () => {
    haptic.warning();
    const member = status?.members.find((one) => one.id.startsWith(joinedHere.id));
    if (member) void remove(member.id).catch(() => {});
    dismissJoinedHere();
  };

  return (
    <Modal transparent statusBarTranslucent animationType={look === 'ios' ? 'slide' : 'fade'} onRequestClose={dismissJoinedHere}>
      <View style={[styles.scrim, { backgroundColor: colors.scrim }, look === 'ios' ? styles.bottom : styles.middle]}>
        <View
          style={[
            look === 'ios' ? styles.sheet : styles.dialog,
            { backgroundColor: colors.surface.sheet, borderColor: colors.border.raised },
            look === 'ios' && { paddingBottom: insets.bottom + 12 },
          ]}
        >
          <ScrollView contentContainerStyle={styles.content} accessibilityViewIsModal>
            <AppText variant="heading" accessibilityRole="header">
              {format(t.join.deviceJoinedTitle, { name: joinedHere.name })}
            </AppText>
            <AppText variant="callout" tone="secondary">
              {t.join.deviceJoinedBody}
            </AppText>
            <SasDigits sas={joinedHere.sas} />
            <View style={styles.actions}>
              <Button label={t.join.same} onPress={dismissJoinedHere} />
              <Button label={t.join.removeIt} tone="destructive" onPress={removeIt} />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1 },
  bottom: { justifyContent: 'flex-end' },
  middle: { justifyContent: 'center', paddingHorizontal: 20 },
  sheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, borderWidth: 1, borderBottomWidth: 0, maxHeight: '90%' },
  dialog: { borderRadius: 28, maxHeight: '86%' },
  content: { padding: 22, gap: 16 },
  actions: { gap: 10, marginTop: 6 },
});
