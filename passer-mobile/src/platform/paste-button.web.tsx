import type { AcceptedContentType, ClipboardPasteButtonProps } from 'expo-clipboard';
import { useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { language } from '@/i18n';

import { benchHost, type IphoneClipboard } from './web-bench';

export const isPasteButtonAvailable = true;

/** iOS labels the control in the system language; the app cannot change the word. */
const LABEL = { en: 'Paste', fr: 'Coller' } as const;

const RADIUS: Record<NonNullable<ClipboardPasteButtonProps['cornerStyle']>, number> = {
  capsule: 999,
  large: 14,
  medium: 10,
  small: 7,
  fixed: 0,
  dynamic: 10,
};

function accepts(types: AcceptedContentType[], content: IphoneClipboard): boolean {
  if (content.kind === 'image') return types.includes('image');
  if (content.kind === 'text') {
    if (types.includes('plain-text')) return true;
    return types.includes('url') && /^[a-z][a-z0-9+.-]*:\/\/\S+$/i.test(content.text.trim());
  }
  return false;
}

/** SF Symbol `doc.on.clipboard`, the glyph iOS draws in the control. */
function PasteSymbol({ color }: { color: string }) {
  return (
    <Svg width={17} height={20} viewBox="0 0 17 20" fill="none">
      <Rect x={4.8} y={1} width={11.2} height={14.2} rx={2.6} stroke={color} strokeWidth={1.7} />
      <Path d="M1.8 5.4v9.8a3.8 3.8 0 0 0 3.8 3.8h6.6" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

/**
 * Bench stand-in for Apple's `UIPasteControl` (see `web-bench.ts`), drawn after
 * the real control. Like iOS, it is greyed out while the clipboard holds nothing
 * it accepts, and it hands over the clipboard without asking.
 */
export function PasteButton({
  onPress,
  acceptedContentTypes = ['plain-text'],
  displayMode = 'iconAndLabel',
  cornerStyle = 'capsule',
  backgroundColor,
  foregroundColor,
  style,
}: ClipboardPasteButtonProps) {
  const { clipboard } = benchHost();
  const content = useSyncExternalStore(clipboard.subscribe, clipboard.read, clipboard.read);
  const enabled = accepts(acceptedContentTypes, content);
  const color = typeof foregroundColor === 'string' ? foregroundColor : '#FFFFFF';
  const label = LABEL[language];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={() => {
        if (content.kind === 'text') onPress({ type: 'text', text: content.text });
        if (content.kind === 'image') {
          onPress({ type: 'image', data: content.dataUri, size: { width: content.width, height: content.height } });
        }
      }}
      style={[
        styles.control,
        style,
        {
          backgroundColor: typeof backgroundColor === 'string' ? backgroundColor : '#0A84FF',
          borderRadius: RADIUS[cornerStyle ?? 'capsule'],
          opacity: enabled ? 1 : 0.4,
        },
      ]}
    >
      {displayMode !== 'labelOnly' ? <PasteSymbol color={color} /> : null}
      {displayMode !== 'iconOnly' ? <Text style={[styles.label, { color }]}>{label}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  control: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, overflow: 'hidden' },
  label: { fontSize: 17, fontWeight: '600', letterSpacing: -0.2 },
});
