import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ChevronRightIcon } from '@/components/icons';
import { haptic } from '@/platform/haptics';
import { look } from '@/platform/look';
import { useTheme } from '@/theme/theme';

import { AppText } from './app-text';

/**
 * A section of rows: an inset grouped list on iOS (Settings, Find My), a plain Material
 * list with a section title on Android. Headers and footers explain, rows act.
 */
export function Group({ header, footer, children }: { header?: string; footer?: ReactNode; children: ReactNode }) {
  const { colors } = useTheme();
  const rows = Children.toArray(children).filter(isValidElement);
  const ios = look === 'ios';
  return (
    <View style={styles.section}>
      {header ? (
        <AppText
          variant="footnote"
          accessibilityRole="header"
          color={ios ? colors.group.header : colors.link}
          style={[ios ? styles.iosHeader : styles.androidHeader, ios && styles.upper]}
        >
          {header}
        </AppText>
      ) : null}
      <View style={ios ? [styles.iosCard, { backgroundColor: colors.group.cell }] : null}>
        {rows.map((row, index) => (
          <Fragment key={row.key ?? index}>
            {index > 0 && ios ? <View style={[styles.separator, { backgroundColor: colors.group.separator }]} /> : null}
            {row}
          </Fragment>
        ))}
      </View>
      {footer ? (
        typeof footer === 'string' ? (
          <AppText variant="footnote" tone="secondary" style={ios ? styles.iosFooter : styles.androidFooter}>
            {footer}
          </AppText>
        ) : (
          <View style={ios ? styles.iosFooter : styles.androidFooter}>{footer}</View>
        )
      ) : null}
    </View>
  );
}

type RowProps = {
  title: string;
  subtitle?: ReactNode;
  /** Drawn before the text: an icon or a device. */
  leading?: ReactNode;
  /** A short value on the right ("Allowed", "On"). */
  detail?: string;
  /** A control on the right, such as a switch. */
  trailing?: ReactNode;
  onPress?: () => void;
  /** A row that opens something shows the chevron on iOS. */
  chevron?: boolean;
  tone?: 'default' | 'link' | 'destructive';
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  numberOfLines?: number;
};

export function Row({
  title,
  subtitle,
  leading,
  detail,
  trailing,
  onPress,
  chevron = false,
  tone = 'default',
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  numberOfLines = 2,
}: RowProps) {
  const { colors } = useTheme();
  const color = tone === 'link' ? colors.link : tone === 'destructive' ? colors.status.error : colors.text.primary;
  const content = (
    <>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.text}>
        <AppText variant="callout" color={color} numberOfLines={numberOfLines}>
          {title}
        </AppText>
        {typeof subtitle === 'string' ? (
          <AppText variant="subhead" tone="secondary" numberOfLines={3}>
            {subtitle}
          </AppText>
        ) : (
          subtitle
        )}
      </View>
      {detail ? (
        <AppText variant="callout" tone="secondary" numberOfLines={1} style={styles.detail}>
          {detail}
        </AppText>
      ) : null}
      {trailing}
      {chevron && look === 'ios' ? <ChevronRightIcon size={16} color={colors.text.tertiary} strokeWidth={2.2} /> : null}
    </>
  );

  if (!onPress) {
    return (
      <View style={[styles.row, look === 'android' && styles.androidRow]} accessible accessibilityLabel={accessibilityLabel}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        haptic.select();
        onPress();
      }}
      android_ripple={{ color: colors.group.separator }}
      style={({ pressed }) => [
        styles.row,
        look === 'android' && styles.androidRow,
        pressed && look === 'ios' && { backgroundColor: colors.group.separator },
        disabled && styles.disabled,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: 0 },
  upper: { textTransform: 'uppercase' },
  iosHeader: { paddingHorizontal: 36, paddingBottom: 8 },
  androidHeader: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, fontWeight: '500' },
  iosCard: { marginHorizontal: 16, borderRadius: 18, overflow: 'hidden' },
  iosFooter: { paddingHorizontal: 36, paddingTop: 8 },
  androidFooter: { paddingHorizontal: 16, paddingTop: 4 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 10 },
  androidRow: { minHeight: 56, paddingVertical: 12, gap: 16 },
  leading: { alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  detail: { maxWidth: '45%' },
  disabled: { opacity: 0.45 },
});
