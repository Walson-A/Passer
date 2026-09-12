import type { UploadFile } from '@/core/client';
import { formatBytes } from '@/utils/format';
import { timestamp, withExtension } from '@/utils/file-names';

import type { PickedPhoto } from './media-types';
import { benchHost } from './web-bench';

export type { PickedPhoto } from './media-types';

/**
 * Bench stand-in for the Photos library, the document picker and the file
 * system (see `web-bench.ts`). Picks come from the bench's fixtures, files stay
 * where they are, and saving or sharing is written to the bench log.
 */

export function clearOutgoing(): void {}

export function pickPhotos(): Promise<PickedPhoto[]> {
  return benchHost().pickPhotos();
}

export function pickFiles(): Promise<UploadFile[]> {
  return benchHost().pickFiles();
}

export type LatestScreenshot = { photo: PickedPhoto; assetId: string };

export async function latestScreenshot(): Promise<LatestScreenshot | 'denied' | null> {
  const photo = await benchHost().latestScreenshot();
  return photo ? { photo, assetId: 'bench-screenshot' } : null;
}

export async function deletePhoto(_assetId: string): Promise<boolean> {
  benchHost().log('photos', 'iOS demande de confirmer la suppression, puis la capture est supprimée');
  return true;
}

export async function asPassboardFile(photo: UploadFile): Promise<UploadFile> {
  return photo;
}

export async function asUploadFile(file: UploadFile): Promise<UploadFile> {
  return file;
}

/** A browser cannot re-encode HEIC: the bench relabels the photo as the JPEG the phone would produce. */
export async function asClipboardImage(photo: UploadFile): Promise<UploadFile> {
  if (photo.mimeType === 'image/png' || photo.mimeType === 'image/jpeg') {
    return { ...photo, name: withExtension(photo.name, photo.mimeType === 'image/png' ? 'png' : 'jpg') };
  }
  return { ...photo, name: withExtension(photo.name, 'jpg'), mimeType: 'image/jpeg' };
}

export function stagePastedImage(dataUri: string): UploadFile {
  const prefix = /^data:(image\/[\w.+-]+);base64,/i.exec(dataUri);
  const isJpeg = prefix?.[1].toLowerCase() === 'image/jpeg';
  const base64 = prefix ? dataUri.slice(prefix[0].length) : dataUri;
  return {
    uri: dataUri,
    name: `Passer ${timestamp()}.${isJpeg ? 'jpg' : 'png'}`,
    mimeType: isJpeg ? 'image/jpeg' : 'image/png',
    size: Math.floor((base64.length * 3) / 4),
  };
}

export async function finalizePulled(
  fileUri: string,
  extension: 'png' | 'zip',
): Promise<{ uri: string; name: string; size: number | null }> {
  const blob = await fetch(fileUri).then((response) => response.blob());
  return { uri: fileUri, name: `Passer ${timestamp()}.${extension}`, size: blob.size };
}

export async function saveImageToPhotos(fileUri: string): Promise<boolean> {
  const blob = await fetch(fileUri).then((response) => response.blob());
  benchHost().log('photos', `Image enregistrée dans Photos (${formatBytes(blob.size)})`);
  return true;
}

export async function shareFile(_fileUri: string, type: { mimeType: string; uti: string }): Promise<void> {
  benchHost().log('share', `Feuille de partage ouverte (${type.uti})`);
}
