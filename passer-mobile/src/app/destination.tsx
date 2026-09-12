import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState, type ComponentType } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronRightIcon, ClipboardIcon, FolderIcon, type IconProps } from '@/components/icons';
import { AppText } from '@/components/ui/app-text';
import { PressableScale } from '@/components/ui/pressable-scale';
import { format, t } from '@/i18n';
import { haptic } from '@/platform/haptics';
import type { PhotoDestination } from '@/platform/storage';
import { usePairings } from '@/state/pairings';
import { useSettings } from '@/state/settings';
import { useTransfers } from '@/state/transfers';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';

const THUMBNAILS = 4;

/**
 * Where a photo lands is the most confusing thing about Passer, so the choice
 * is made explicit, with the same names, icons and colours as the home screen's sockets.
 */
export default function Destination() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { pc } = usePairings();
  const { pendingPhotos, setPendingPhotos, sendPhotos } = useTransfers();
  const { updateSettings } = useSettings();
  const [remember, setRemember] = useState(false);
  // A local copy keeps the sheet's content stable while it animates closed.
  const [photos] = useState(pendingPhotos);

  if (!pc || photos.length === 0) return null;

  const count = photos.length;
  const extra = count - THUMBNAILS;

  const choose = (destination: PhotoDestination) => {
    haptic.select();
    if (remember) updateSettings({ photoDestination: destination });
    setPendingPhotos([]);
    router.back();
    void sendPhotos(photos, destination);
  };

  return (
    <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
      <AppText variant="title" accessibilityRole="header" numberOfLines={2}>
        {count > 1 ? format(t.destination.titleMany, { count, name: pc.name }) : format(t.destination.titleOne, { name: pc.name })}
      </AppText>

      <View style={styles.thumbnails} accessibilityElementsHidden>
        {photos.slice(0, THUMBNAILS).map((photo) => (
          <Image key={photo.uri} source={{ uri: photo.uri }} style={[styles.thumbnail, { backgroundColor: colors.surface.well }]} contentFit="cover" />
        ))}
        {extra > 0 ? (
          <View style={[styles.thumbnail, styles.more, { backgroundColor: colors.surface.raised, borderColor: colors.border.raised }]}>
            <AppText variant="body" tone="secondary">{`+${extra}`}</AppText>
          </View>
        ) : null}
      </View>

      <View style={styles.options}>
        <Option
          icon={ClipboardIcon}
          tint={colors.destination.clipboard}
          wash={colors.status.okWash}
          title={t.destination.clipboardTitle}
          body={count > 1 ? `${t.destination.clipboardBody} ${t.destination.clipboardOnlyOne}` : t.destination.clipboardBody}
          onPress={() => choose('clipboard')}
        />
        <Option
          icon={FolderIcon}
          tint={colors.destination.folder}
          wash={colors.destination.folderWash}
          title={t.destination.passboardTitle}
          body={t.destination.passboardBody}
          onPress={() => choose('passboard')}
        />
      </View>

      <View style={styles.remember}>
        <AppText variant="body" tone="secondary" style={styles.flex}>
          {t.destination.remember}
        </AppText>
        <Switch
          value={remember}
          onValueChange={(value) => {
            haptic.select();
            setRemember(value);
          }}
          trackColor={{ false: colors.toggleOff, true: colors.status.ok }}
          ios_backgroundColor={colors.toggleOff}
          accessibilityLabel={t.destination.remember}
        />
      </View>
    </View>
  );
}

function Option({
  icon: Icon,
  tint,
  wash,
  title,
  body,
  onPress,
}: {
  icon: ComponentType<IconProps>;
  tint: string;
  wash: string;
  title: string;
  body: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body}`}
      onPress={onPress}
      style={[styles.option, { backgroundColor: colors.surface.card, borderColor: colors.border.subtle }]}
    >
      <View style={[styles.optionIcon, { backgroundColor: wash }]}>
        <Icon size={20} color={tint} strokeWidth={2} />
      </View>
      <View style={styles.flex}>
        <AppText variant="body" style={styles.strong}>
          {title}
        </AppText>
        <AppText variant="caption" tone="secondary">
          {body}
        </AppText>
      </View>
      <ChevronRightIcon size={16} color={colors.icon.dim} strokeWidth={2} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: 20, paddingTop: 28, gap: 16 },
  thumbnails: { flexDirection: 'row', gap: 8 },
  thumbnail: { width: 56, height: 56, borderRadius: 12 },
  more: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  options: { gap: 10 },
  option: {
    minHeight: 84,
    borderRadius: radius.capsule,
    borderWidth: 1,
    paddingLeft: 12,
    paddingRight: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 3 },
  strong: { fontWeight: '600' },
  remember: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12 },
});
