import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { parsePairingLink, type PairingParseError } from '@/core/pairing';
import { t } from '@/i18n';
import { useTheme } from '@/theme/theme';
import { radius, type as typeScale } from '@/theme/tokens';

const PROBLEM: Record<PairingParseError, string> = {
  'not-a-pairing-link': t.pair.invalidTitle,
  'newer-version': t.pair.newerTitle,
  'missing-token': t.pair.incompleteTitle,
  'missing-address': t.pair.incompleteTitle,
};

/** The fallback when the camera can't be used: the desktop can copy the same link the QR code carries. */
export default function Manual() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [link, setLink] = useState('');

  const trimmed = link.trim();
  const parsed = trimmed ? parsePairingLink(trimmed) : null;
  const problem = parsed && !parsed.ok ? PROBLEM[parsed.error] : null;

  const connect = () => {
    if (parsed?.ok) router.replace({ pathname: '/pair', params: { link: trimmed } });
  };

  return (
    <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.head}>
        <AppText variant="title" accessibilityRole="header">
          {t.manual.title}
        </AppText>
        <AppText variant="caption" tone="secondary">
          {t.manual.help}
        </AppText>
      </View>

      <TextInput
        value={link}
        onChangeText={setLink}
        placeholder={t.manual.placeholder}
        placeholderTextColor={colors.text.tertiary}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        keyboardType="url"
        returnKeyType="go"
        onSubmitEditing={connect}
        selectionColor={colors.accent}
        accessibilityLabel={t.manual.label}
        style={[
          styles.input,
          typeScale.body,
          {
            color: colors.text.primary,
            backgroundColor: colors.surface.well,
            borderColor: problem ? colors.status.error : colors.border.subtle,
          },
        ]}
      />
      {problem ? (
        <AppText variant="caption" color={colors.status.error} accessibilityRole="alert">
          {problem}
        </AppText>
      ) : null}

      <View style={styles.actions}>
        {Clipboard.isPasteButtonAvailable ? (
          <Clipboard.ClipboardPasteButton
            acceptedContentTypes={['plain-text', 'url']}
            displayMode="iconAndLabel"
            cornerStyle="capsule"
            backgroundColor={colors.surface.sheet}
            foregroundColor={colors.paste.background}
            style={styles.paste}
            onPress={(data) => {
              if (data.type === 'text') setLink(data.text);
            }}
          />
        ) : null}
        <View style={styles.connect}>
          <PrimaryButton label={t.manual.connect} onPress={connect} disabled={!parsed?.ok} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: 20, paddingTop: 28, gap: 12 },
  head: { gap: 6 },
  input: {
    minHeight: 52,
    borderRadius: radius.button,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  paste: { width: 132, height: 44 },
  connect: { flex: 1 },
});
