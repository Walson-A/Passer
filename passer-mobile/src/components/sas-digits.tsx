import { StyleSheet, View } from 'react-native';

import { sasGroups } from '@/core/devices';
import { useTheme } from '@/theme/theme';

import { AppText } from './ui/app-text';

/** The six digits to compare, in two groups of three, each in its own cell, as on the PC. */
export function SasDigits({ sas }: { sas: string }) {
  const { colors } = useTheme();
  const [first, second] = sasGroups(sas);
  const spoken = `${first.split('').join(' ')}, ${second.split('').join(' ')}`;
  return (
    <View style={styles.row} accessible accessibilityRole="text" accessibilityLabel={spoken}>
      {[first, second].map((group, groupIndex) => (
        <View key={groupIndex} style={styles.group}>
          {group.split('').map((digit, index) => (
            <View
              key={index}
              style={[styles.cell, { backgroundColor: colors.digit.background, borderColor: colors.digit.border }]}
            >
              <AppText variant="digits" color={colors.digit.text} style={styles.digit}>
                {digit}
              </AppText>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 16, flexWrap: 'wrap' },
  group: { flexDirection: 'row', gap: 6 },
  cell: { minWidth: 46, minHeight: 60, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  digit: { fontVariant: ['tabular-nums'] },
});
