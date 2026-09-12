import { useEffect, type ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ClipboardIcon, FolderIcon, type IconProps } from '@/components/icons';
import { AppText } from '@/components/ui/app-text';
import { t } from '@/i18n';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';

export type SocketName = 'clipboard' | 'passboard';

export type SocketContent = { title: string; meta: string } | null;

type SocketsProps = {
  clipboard: SocketContent;
  passboard: SocketContent;
  /** The socket that received the latest transfer. */
  lit: SocketName | null;
  /** A socket with a transfer on its way in. */
  receiving: SocketName | null;
  /** Changes each time something lands, to flash the socket it landed in. */
  landing: { socket: SocketName; key: number } | null;
  dimmed: boolean;
};

/** The two places content can land on the PC, always visible so the destination is never a guess. */
export function Sockets({ clipboard, passboard, lit, receiving, landing, dimmed }: SocketsProps) {
  return (
    <View style={[styles.row, dimmed && styles.dimmed]}>
      <Socket
        name="clipboard"
        icon={ClipboardIcon}
        label={t.home.socketClipboard}
        content={clipboard}
        lit={lit === 'clipboard'}
        receiving={receiving === 'clipboard'}
        landingKey={landing?.socket === 'clipboard' ? landing.key : null}
      />
      <Socket
        name="passboard"
        icon={FolderIcon}
        label={t.home.socketPassboard}
        content={passboard}
        lit={lit === 'passboard'}
        receiving={receiving === 'passboard'}
        landingKey={landing?.socket === 'passboard' ? landing.key : null}
      />
    </View>
  );
}

type SocketProps = {
  name: SocketName;
  icon: ComponentType<IconProps>;
  label: string;
  content: SocketContent;
  lit: boolean;
  receiving: boolean;
  landingKey: number | null;
};

function Socket({ name, icon: Icon, label, content, lit, receiving, landingKey }: SocketProps) {
  const { colors } = useTheme();
  const flash = useSharedValue(0);

  useEffect(() => {
    if (landingKey === null) return;
    flash.set(
      withSequence(
        withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 900, easing: Easing.bezier(0.16, 1, 0.3, 1) }),
      ),
    );
  }, [landingKey, flash]);

  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.get() }));

  const accentColor = name === 'clipboard' ? colors.destination.clipboard : colors.destination.folder;
  const border = receiving ? colors.status.warnBorder : lit ? colors.status.okBorder : colors.border.subtle;
  const background = receiving ? colors.status.warnWashSoft : lit ? colors.status.okWashSoft : colors.surface.card;

  return (
    <View
      accessible
      accessibilityLabel={content ? `${label}: ${content.title}, ${content.meta}` : `${label}: ${t.home.socketEmpty}`}
      style={[styles.socket, { borderColor: border, backgroundColor: background }]}
    >
      <View style={styles.labelRow}>
        <Icon size={13} color={accentColor} strokeWidth={2} />
        <AppText variant="label" tone="label" numberOfLines={1}>
          {label}
        </AppText>
      </View>
      <AppText variant="body" numberOfLines={1} tone={content ? 'primary' : 'tertiary'}>
        {content ? content.title : t.home.socketEmpty}
      </AppText>
      <AppText variant="meta" tone="tertiary" numberOfLines={1} style={styles.meta}>
        {content?.meta ?? ' '}
      </AppText>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.flash,
          { borderColor: colors.status.ok, boxShadow: `0 0 18px ${colors.status.okWash}` },
          flashStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
  },
  dimmed: { opacity: 0.5 },
  socket: {
    flex: 1,
    minHeight: 76,
    borderRadius: radius.socket,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'space-between',
    gap: 2,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { fontVariant: ['tabular-nums'] },
  flash: { borderRadius: radius.socket, borderWidth: 1.5 },
});
