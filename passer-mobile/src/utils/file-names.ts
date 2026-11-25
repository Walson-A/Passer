function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** `2026-09-12 14.32.05`: sortable, and legal in Windows file names. */
export function timestamp(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}.${pad(date.getMinutes())}.${pad(date.getSeconds())}`;
}

/** Characters Windows refuses in file names, plus control characters. */
const UNSAFE_FILE_NAME = /[\\/:*?"<>|\x00-\x1f]/g;

/** The PC keeps only the base name, so separators and reserved characters are replaced here. */
export function safeName(name: string, fallback: string): string {
  const cleaned = name.replace(UNSAFE_FILE_NAME, ' ').trim();
  return cleaned || fallback;
}

export function withExtension(name: string, extension: string): string {
  const stem = name.replace(/\.[^.]+$/, '');
  return `${stem}.${extension}`;
}
