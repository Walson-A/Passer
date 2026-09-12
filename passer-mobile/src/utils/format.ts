import { format, language, t } from '@/i18n';

/** French writes "Ko" and "Mo". Sizes are decimal, like the Files app. */
const UNITS = language === 'fr' ? ['o', 'Ko', 'Mo', 'Go'] : ['B', 'KB', 'MB', 'GB'];
const NBSP = '\u00A0';

const numbers = new Intl.NumberFormat(language, { maximumFractionDigits: 1 });
const shortDate = new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' });

export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < UNITS.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return `${numbers.format(unit === 0 ? Math.round(value) : value)}${NBSP}${UNITS[unit]}`;
}

export function formatRelative(at: number, now: number = Date.now()): string {
  const minutes = Math.floor((now - at) / 60_000);
  if (minutes < 1) return t.transfer.justNow;
  if (minutes < 60) return format(t.transfer.minutesAgo, { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return format(t.transfer.hoursAgo, { count: hours });
  if (hours < 48) return t.transfer.yesterday;
  return shortDate.format(at);
}
