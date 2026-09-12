import { StyleSheet, View } from 'react-native';

import { ChevronDownIcon, LaptopIcon } from '@/components/icons';
import { AppText } from '@/components/ui/app-text';
import { PressableScale } from '@/components/ui/pressable-scale';
import { StatusDot } from '@/components/ui/status-dot';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';

export type NodeStatus = 'online' | 'searching' | 'offline' | 'unauthorized';

type PcNodeProps = {
  name: string;
  status: NodeStatus;
  statusText: string;
  onPressName: () => void;
  nameHint: string;
};

/** The top end of the conduit: which PC this iPhone talks to, and whether it answers. */
export function PcNode({ name, status, statusText, onPressName, nameHint }: PcNodeProps) {
  const { colors } = useTheme();
  const faded = status === 'offline' || status === 'unauthorized';
  const dotColor =
    status === 'online' ? colors.status.ok : status === 'unauthorized' ? colors.status.error : colors.status.warn;

  return (
    <View style={styles.node}>
      <View
        style={[
          styles.tile,
          {
            backgroundColor: colors.surface.raised,
            borderColor: colors.border.raised,
            boxShadow: colors.shadow.tile,
            opacity: faded ? 0.45 : 1,
          },
        ]}
      >
        <LaptopIcon size={26} color={colors.text.primary} strokeWidth={1.5} />
      </View>

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={name}
        accessibilityHint={nameHint}
        hitSlop={10}
        onPress={onPressName}
        style={[styles.nameRow, { opacity: faded ? 0.45 : 1 }]}
      >
        <AppText variant="pcName" numberOfLines={1} style={styles.name}>
          {name}
        </AppText>
        <ChevronDownIcon size={16} color={colors.icon.dim} strokeWidth={2} />
      </PressableScale>

      <View style={styles.statusRow} accessibilityLiveRegion="polite">
        <StatusDot
          color={dotColor}
          glow={status === 'online' ? colors.shadow.okGlow : undefined}
          pulsing={status === 'searching'}
        />
        <AppText variant="caption" tone={faded ? 'secondary' : 'tertiary'} numberOfLines={1}>
          {statusText}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  node: { alignItems: 'center' },
  tile: {
    width: 56,
    height: 56,
    borderRadius: radius.socket,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: {
    marginTop: 10,
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  name: { maxWidth: 280 },
  statusRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 24,
  },
});
