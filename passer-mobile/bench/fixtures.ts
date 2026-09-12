import type { UploadFile } from '@/core/client';
import type { PairedPc } from '@/core/types';
import { format, t } from '@/i18n';
import type { PickedPhoto } from '@/platform/media-types';
import type { IphoneClipboard } from '@/platform/web-bench';
import type { HistoryItem } from '@/state/history';

import type { IphoneClipboardChoice, PcClipboardChoice } from './state';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * The PC the bench pairs with. Each value has the shape the desktop produces,
 * read in `passer-app/src-tauri/src`, not guessed.
 */
export const PC = {
  /** `device::display_name()`: COMPUTERNAME, here a Windows default name. */
  name: 'DESKTOP-4F7KQ2M',
  /** `device::mdns_host()`: the name lowercased, other characters than letters and digits as `-`, then `.local`. */
  host: 'desktop-4f7kq2m.local',
  ip: '192.168.1.42',
  /** `types::SERVER_PORT`. */
  port: 8000,
  /** `device::load_or_create_device_id()`: 16 alphanumerics. */
  id: 'h3K9sQ2mX7pL4vRt',
  /** `auth::generate_token()`: 32 alphanumerics. */
  token: 'Qm7Xc2Lr9Tz4Vb8Nk3Hs6Pw1Jd5Fy0Ga',
  /** `CARGO_PKG_VERSION` of passer-app. */
  version: '1.0.0',
};

/** Another Passer PC, answering at the paired PC's IP address in the "other PC" regime. */
export const OTHER_PC = {
  name: 'BUREAU-SALON',
  host: 'bureau-salon.local',
  id: 'Zp8Lw2Qe5Rt7Yu1B',
  token: 'Tn4Wq8Er2Ty6Ui0Op3As7Df1Gh5Jk9Lz',
  version: '1.0.0',
};

/** The token the paired PC expects once its pairing was reset, in the "refused" regime. */
export const ROTATED_TOKEN = 'Vx1Cb5Nm9Qw3Er7Ty2Ui6Op0As4Df8Gh';

function pairingQuery(): string {
  return new URLSearchParams({
    v: '1',
    name: PC.name,
    host: PC.host,
    ip: PC.ip,
    port: String(PC.port),
    token: PC.token,
    id: PC.id,
  }).toString();
}

/** The link the desktop's QR code carries. */
export function pairingLink(): string {
  return `passer://pair?${pairingQuery()}`;
}

/** The same link opened from outside the app, such as from the Camera app: the pairing route with its parameters. */
export function pairingRoute(): string {
  return `/pair?${pairingQuery()}`;
}

export function pairedPc(now: number): PairedPc {
  return {
    key: PC.id,
    id: PC.id,
    name: PC.name,
    host: PC.host,
    ip: PC.ip,
    port: PC.port,
    pairedAt: now - 9 * DAY,
    preferredAddress: 'host',
  };
}

/** A week of use, with the long names real files have. */
export function history(now: number): HistoryItem[] {
  const entry = (id: string, ago: number, item: Omit<HistoryItem, 'id' | 'at' | 'pcKey'>): HistoryItem => ({
    id,
    at: now - ago,
    pcKey: PC.id,
    ...item,
  });
  return [
    entry('bench-1', 2 * MINUTE, {
      direction: 'sent',
      kind: 'text',
      destination: 'pc-clipboard',
      title: 'https://www.figma.com/design/k8Q2vX/Passer-mobile?node-id=412-1873&t=Lh2c9QbWm3',
      size: null,
    }),
    entry('bench-2', 26 * MINUTE, {
      direction: 'sent',
      kind: 'file',
      destination: 'passboard',
      title: 'Facture octobre 2026 - Studio Lumen (version signée).pdf',
      size: 1_284_312,
    }),
    entry('bench-3', 70 * MINUTE, {
      direction: 'received',
      kind: 'text',
      destination: 'iphone-clipboard',
      title: 'Le code de la porte, c’est 4172B. Deuxième étage, à gauche en sortant de l’ascenseur.',
      size: null,
    }),
    entry('bench-4', 5 * HOUR, {
      direction: 'sent',
      kind: 'image',
      destination: 'pc-clipboard',
      title: 'IMG_4127.HEIC',
      size: 2_871_044,
    }),
    entry('bench-5', DAY + 3 * HOUR, {
      direction: 'received',
      kind: 'image',
      destination: 'iphone-clipboard',
      title: t.transfer.imageFromPc,
      size: 342_118,
    }),
    entry('bench-6', 3 * DAY, {
      direction: 'sent',
      kind: 'files',
      destination: 'passboard',
      title: format(t.transfer.photosCount, { count: 12 }),
      size: 38_512_990,
    }),
    entry('bench-7', 6 * DAY, {
      direction: 'received',
      kind: 'files',
      destination: 'files',
      title: 'Passer 2026-09-06 18.02.11.zip',
      size: 7_402_551,
    }),
  ];
}

function artwork(from: string, to: string, width: number, height: number): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/>` +
    `<stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="${width}" height="${height}" fill="url(#g)"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** What the photo picker hands over: HEIC originals, a JPEG and a screenshot, at their real sizes. */
export const PHOTOS: PickedPhoto[] = [
  { uri: artwork('#F2B880', '#C06C84', 4032, 3024), name: 'IMG_4127.HEIC', mimeType: 'image/heic', size: 2_871_044, width: 4032, height: 3024 },
  { uri: artwork('#6C8EAD', '#1F3A5F', 3024, 4032), name: 'IMG_4128.HEIC', mimeType: 'image/heic', size: 3_104_220, width: 3024, height: 4032 },
  { uri: artwork('#A8C686', '#40695B', 4032, 3024), name: 'IMG_4131.JPG', mimeType: 'image/jpeg', size: 4_512_870, width: 4032, height: 3024 },
  { uri: artwork('#E9E4DA', '#9A8F7E', 1179, 2556), name: 'IMG_4135.PNG', mimeType: 'image/png', size: 1_906_331, width: 1179, height: 2556 },
  { uri: artwork('#F6D365', '#FDA085', 4032, 3024), name: 'IMG_4140.HEIC', mimeType: 'image/heic', size: 2_640_118, width: 4032, height: 3024 },
];

const PLACEHOLDER_BYTES = 'data:application/octet-stream;base64,AA==';

/** What the document picker hands over. The bench never reads the bytes, only the name, type and size. */
export const FILES: UploadFile[] = [
  {
    uri: PLACEHOLDER_BYTES,
    name: 'Devis rénovation cuisine - Maison Tessier (v3 définitive).pdf',
    mimeType: 'application/pdf',
    size: 2_204_871,
  },
  { uri: PLACEHOLDER_BYTES, name: 'Plans RDC.dwg', mimeType: 'application/octet-stream', size: 14_880_302 },
];

/** A real 1×1 PNG. The size handed to the app is a screenshot's, as UIPasteControl reports it. */
const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAMAASsJTYQAAAAASUVORK5CYII=';

export function iphoneClipboard(choice: IphoneClipboardChoice): IphoneClipboard {
  switch (choice) {
    case 'link':
      return { kind: 'text', text: 'https://www.figma.com/design/k8Q2vX/Passer-mobile?node-id=412-1873' };
    case 'text':
      return { kind: 'text', text: 'Rendez-vous chez le notaire jeudi 18 à 10 h. Apporter le RIB et une pièce d’identité.' };
    case 'image':
      return { kind: 'image', dataUri: TINY_PNG, width: 1179, height: 2556 };
    case 'empty':
      return { kind: 'empty' };
  }
}

export type PcClipboard = { kind: 'text'; text: string } | { kind: 'image'; png: Blob } | { kind: 'files'; zip: Blob };

/** A real PNG drawn in the browser, grainy so it compresses like a screenshot rather than to nothing. */
function renderPng(width: number, height: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#1F3A5F');
    gradient.addColorStop(1, '#C06C84');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height);
    for (let index = 0; index < pixels.data.length; index += 4) {
      const grain = (Math.random() - 0.5) * 16;
      pixels.data[index] += grain;
      pixels.data[index + 1] += grain;
      pixels.data[index + 2] += grain;
    }
    context.putImageData(pixels, 0, 0);
  }
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ?? new Blob([], { type: 'image/png' })), 'image/png'));
}

/** A ZIP as large as the desktop's for a few copied files. The app stores and shares it without opening it. */
function zipOfSize(size: number): Blob {
  const endOfCentralDirectory = new Uint8Array(22);
  endOfCentralDirectory.set([0x50, 0x4b, 0x05, 0x06]);
  return new Blob([new Uint8Array(size - endOfCentralDirectory.length), endOfCentralDirectory], { type: 'application/zip' });
}

let screenshot: Promise<Blob> | null = null;

export async function pcClipboard(choice: PcClipboardChoice): Promise<PcClipboard> {
  switch (choice) {
    case 'text':
      return { kind: 'text', text: 'Réunion déplacée à 15 h 30, salle Pasteur. Pense à prendre le devis signé.' };
    case 'image':
      screenshot ??= renderPng(1280, 800);
      return { kind: 'image', png: await screenshot };
    case 'files':
      return { kind: 'files', zip: zipOfSize(7_402_551) };
    case 'empty':
      // `pull_clipboard` with nothing copied: `get_text()` falls back to an empty string.
      return { kind: 'text', text: '' };
  }
}
