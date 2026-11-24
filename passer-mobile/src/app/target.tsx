import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DeviceGlyph } from '@/components/device-glyph';
import { CheckIcon } from '@/components/icons';
import { ReachLine } from '@/components/reach-line';
import { AppText } from '@/components/ui/app-text';
import { Group, Row } from '@/components/ui/list';
import { t } from '@/i18n';
import { roleOf, useDevices } from '@/state/devices';
import { useTheme } from '@/theme/theme';
import { deviceName } from '@/utils/format';

/** Which device Send sends to. The choice is kept for next time. */
export default function TargetSheet() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { others, target, reach, setTarget } = useDevices();

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}>
      <AppText variant="heading" accessibilityRole="header" style={styles.title}>
        {t.send.chooseTitle}
      </AppText>
      <Group>
        {others.map((member) => (
          <Row
            key={member.id}
            title={deviceName(member.name)}
            leading={<DeviceGlyph id={member.id} name={member.name} kind={member.kind} size={44} dim={reach[member.id] === 'unreachable'} />}
            subtitle={<ReachLine reach={reach[member.id]} answeredAt={member.answeredAt} suffix={roleOf(member)} />}
            trailing={target?.id === member.id ? <CheckIcon size={20} color={colors.link} strokeWidth={2.6} /> : undefined}
            accessibilityLabel={target?.id === member.id ? `${member.name}, ${t.device.selected}` : member.name}
            onPress={() => {
              setTarget(member.id);
              router.back();
            }}
          />
        ))}
      </Group>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 28, gap: 16 },
  title: { paddingHorizontal: 20 },
});
