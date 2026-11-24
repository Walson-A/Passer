import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { AppState, StyleSheet, View, useWindowDimensions } from 'react-native';

import { ImageIcon, PasteIcon, TextIcon } from '@/components/icons';
import { format, t } from '@/i18n';
import { detectClipboard, onClipboardChange, type ClipboardContent } from '@/platform/clipboard';
import { haptic } from '@/platform/haptics';
import { look } from '@/platform/look';
import { isPasteButtonAvailable, PasteButton } from '@/platform/paste-button';
import { useTheme } from '@/theme/theme';

import { AppText } from './ui/app-text';
import { PressableScale } from './ui/pressable-scale';

const CONTROL_HEIGHT = 62;

/**
 * "What you copied": a title that says what the big button does, what is on the clipboard
 * (found without reading it), and the button.
 *
 * On iOS the button is Apple's paste control: its label is the system's own ("Paste"), and
 * it is the only way to read the clipboard in one tap without the paste alert, so the title
 * above carries the meaning. Android has no such alert: a regular button says it in full.
 */
export function CopiedPanel({
  peer,
  disabled,
  onText,
  onImage,
}: {
  peer: string;
  disabled: boolean;
  onText: (text: string) => void;
  onImage: (dataUri: string) => void;
}) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const content = useClipboardContent();
  const hint =
    content === 'image'
      ? format(t.send.hintImage, { name: peer })
      : content === 'text'
        ? format(t.send.hintText, { name: peer })
        : t.send.hintEmpty;
  const HintIcon = content === 'image' ? ImageIcon : TextIcon;

  return (
    <View style={styles.panel}>
      <AppText variant="headline" accessibilityRole="header">
        {t.send.copied}
      </AppText>
      <View style={styles.hint}>
        {content !== 'empty' ? <HintIcon size={15} color={colors.text.secondary} strokeWidth={2} /> : null}
        <AppText variant="subhead" tone="secondary" style={styles.flex}>
          {hint}
        </AppText>
      </View>
      {isPasteButtonAvailable && look === 'ios' ? (
        <View style={[styles.slot, disabled && styles.disabled]} pointerEvents={disabled ? 'none' : 'auto'}>
          <PasteButton
            acceptedContentTypes={['plain-text', 'url', 'image']}
            imageOptions={{ format: 'png' }}
            backgroundColor={colors.paste.background}
            foregroundColor={colors.paste.foreground}
            cornerStyle="capsule"
            displayMode="iconAndLabel"
            style={{ width: width - 32, height: CONTROL_HEIGHT }}
            onPress={(data) => {
              if (data.type === 'image') onImage(data.data);
              else onText(data.text);
            }}
          />
        </View>
      ) : (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t.send.sendCopied}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={async () => {
            haptic.tap();
            if (await Clipboard.hasImageAsync()) {
              const image = await Clipboard.getImageAsync({ format: 'png' });
              if (image) onImage(image.data);
              return;
            }
            onText(await Clipboard.getStringAsync());
          }}
          style={[styles.fallback, { backgroundColor: colors.paste.background }, disabled && styles.disabled]}
        >
          <PasteIcon size={21} color={colors.paste.foreground} strokeWidth={2} />
          <AppText variant="headline" color={colors.paste.foreground} style={styles.center}>
            {t.send.sendCopied}
          </AppText>
        </PressableScale>
      )}
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

const styles = StyleSheet.create({
  panel: { paddingHorizontal: 16, gap: 8 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 20 },
  flex: { flex: 1 },
  slot: { marginTop: 6, height: CONTROL_HEIGHT },
  fallback: {
    marginTop: 6,
    minHeight: CONTROL_HEIGHT,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  center: { textAlign: 'center', flexShrink: 1 },
  disabled: { opacity: 0.4 },
});
