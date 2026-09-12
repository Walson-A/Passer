import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { AppState, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ArrowDownToLineIcon, FileIcon, ImageIcon, PasteIcon, TextIcon } from '@/components/icons';
import { ActionButton } from '@/components/ui/action-button';
import { AppText } from '@/components/ui/app-text';
import { PressableScale } from '@/components/ui/pressable-scale';
import { format, t } from '@/i18n';
import { detectClipboard, onClipboardChange, type ClipboardContent } from '@/platform/clipboard';
import { haptic } from '@/platform/haptics';
import { isPasteButtonAvailable, PasteButton } from '@/platform/paste-button';
import { useTheme } from '@/theme/theme';
import { radius } from '@/theme/tokens';

const SIDE = 20;
const PASTE_HEIGHT = 60;

export type PadMode = 'ready' | 'searching' | 'paused';

type LaunchPadProps = {
  mode: PadMode;
  /** A transfer is running: the other actions wait for it. */
  busy: boolean;
  pcName: string;
  bottomInset: number;
  onPasteText: (text: string) => void;
  onPasteImage: (dataUri: string) => void;
  onPhoto: () => void;
  onFromPc: () => void;
  onFile: () => void;
};

/**
 * The bottom end of the conduit, in the thumb zone. The native paste control
 * is the hero: it is the only way to read the clipboard in one tap without
 * the iOS paste alert. Nothing overlaps it and nothing is drawn close to it.
 */
export function LaunchPad({
  mode,
  busy,
  pcName,
  bottomInset,
  onPasteText,
  onPasteImage,
  onPhoto,
  onFromPc,
  onFile,
}: LaunchPadProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const content = useClipboardContent();
  const ready = mode === 'ready';
  const controlWidth = width - SIDE * 2;

  const hint = !ready
    ? ''
    : content === 'image'
      ? t.home.hintImage
      : content === 'text'
        ? t.home.hintText
        : t.home.hintEmpty;

  return (
    <View style={[styles.pad, { paddingBottom: bottomInset + 10 }]}>
      <View style={styles.hint}>
        {ready && content === 'image' ? <ImageIcon size={13} color={colors.icon.dim} strokeWidth={2} /> : null}
        {ready && content === 'text' ? <TextIcon size={13} color={colors.icon.dim} strokeWidth={2} /> : null}
        <AppText variant="caption" tone="tertiary" numberOfLines={1}>
          {hint}
        </AppText>
      </View>

      {ready ? (
        <PasteControl width={controlWidth} onText={onPasteText} onImage={onPasteImage} />
      ) : (
        <View
          accessible
          accessibilityRole="text"
          style={[styles.placeholder, { width: controlWidth, borderColor: colors.border.dashed }]}
        >
          <AppText variant="body" tone="tertiary" numberOfLines={1}>
            {mode === 'searching' ? format(t.home.searching, { name: pcName }) : t.home.paused}
          </AppText>
        </View>
      )}

      <View style={styles.actions}>
        <View style={styles.action}>
          <ActionButton icon={ImageIcon} label={t.home.photo} onPress={onPhoto} disabled={!ready || busy} />
        </View>
        <View style={styles.action}>
          <ActionButton icon={ArrowDownToLineIcon} label={t.home.fromPc} onPress={onFromPc} disabled={!ready || busy} emphasis />
        </View>
        <View style={styles.action}>
          <ActionButton icon={FileIcon} label={t.home.file} onPress={onFile} disabled={!ready || busy} />
        </View>
      </View>
    </View>
  );
}

/** What the clipboard holds, refreshed when it changes or the app comes back to the front. */
function useClipboardContent(): ClipboardContent {
  const [content, setContent] = useState<ClipboardContent>('empty');

  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      detectClipboard()
        .then((next) => {
          if (mounted) setContent(next);
        })
        .catch(() => {
          if (mounted) setContent('empty');
        });
    };
    refresh();
    const clipboard = onClipboardChange(refresh);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      mounted = false;
      clipboard.remove();
      appState.remove();
    };
  }, []);

  return content;
}

function PasteControl({
  width,
  onText,
  onImage,
}: {
  width: number;
  onText: (text: string) => void;
  onImage: (dataUri: string) => void;
}) {
  const { colors } = useTheme();

  if (isPasteButtonAvailable) {
    return (
      <View style={styles.pasteSlot}>
        <PasteButton
          acceptedContentTypes={['plain-text', 'url', 'image']}
          imageOptions={{ format: 'png' }}
          backgroundColor={colors.paste.background}
          foregroundColor={colors.paste.foreground}
          cornerStyle="capsule"
          displayMode="iconAndLabel"
          style={{ width, height: PASTE_HEIGHT }}
          onPress={(data) => {
            if (data.type === 'image') onImage(data.data);
            else onText(data.text);
          }}
        />
      </View>
    );
  }

  // Android has no paste alert to design around, so a regular control reads the clipboard directly.
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t.home.paste}
      onPress={async () => {
        haptic.tap();
        if (await Clipboard.hasImageAsync()) {
          const image = await Clipboard.getImageAsync({ format: 'png' });
          if (image) onImage(image.data);
          return;
        }
        onText(await Clipboard.getStringAsync());
      }}
      style={[styles.pasteFallback, { width, backgroundColor: colors.paste.background }]}
    >
      <PasteIcon size={20} color={colors.paste.foreground} strokeWidth={2} />
      <AppText variant="title" color={colors.paste.foreground}>
        {t.home.paste}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: SIDE, paddingTop: 12, alignItems: 'center' },
  hint: { minHeight: 16, flexDirection: 'row', alignItems: 'center', gap: 6 },
  pasteSlot: { marginTop: 12, height: PASTE_HEIGHT },
  placeholder: {
    marginTop: 12,
    height: PASTE_HEIGHT,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  pasteFallback: {
    marginTop: 12,
    height: PASTE_HEIGHT,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actions: { marginTop: 14, flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  action: { flex: 1 },
});
