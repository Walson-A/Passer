import { getDocumentAsync } from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { launchImageLibraryAsync, UIImagePickerPreferredAssetRepresentationMode } from 'expo-image-picker';
import { requestPermissionsAsync, saveToLibraryAsync } from 'expo-media-library/legacy';
import { isAvailableAsync, shareAsync } from 'expo-sharing';

import type { UploadFile } from '@/core/client';
import { safeName, timestamp, withExtension } from '@/utils/file-names';

import type { PickedPhoto } from './media-types';

export type { PickedPhoto } from './media-types';

/** `File.size` is 0 for a missing file; the UI shows an unknown size instead. */
function sizeOf(file: File): number | null {
  return file.exists ? file.size : null;
}

const OUTGOING = 'outgoing';

/** Each staged file gets its own folder, so two picks with the same name never overwrite each other. */
function stagingFolder(): Directory {
  const folder = new Directory(Paths.cache, OUTGOING, `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
  folder.create({ intermediates: true });
  return folder;
}

/**
 * Multipart uploads name the part after the file on disk, so outgoing files are
 * staged under the exact name the PC should show.
 */
async function stage(uri: string, name: string, mimeType: string): Promise<UploadFile> {
  const source = new File(uri);
  if (source.name === name) return { uri, name, mimeType, size: sizeOf(source) };
  const target = new File(stagingFolder(), name);
  await source.copy(target);
  return { uri: target.uri, name, mimeType, size: sizeOf(target) };
}

/** Removes staged copies once a transfer is over. */
export function clearOutgoing(): void {
  const folder = new Directory(Paths.cache, OUTGOING);
  try {
    if (folder.exists) folder.delete();
  } catch {
    // A leftover copy in the cache is harmless; iOS reclaims the cache on its own.
  }
}

export async function pickPhotos(): Promise<PickedPhoto[]> {
  const result = await launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: 0,
    quality: 1,
    exif: false,
    // Originals for the Passboard folder; clipboard sends are converted below.
    preferredAssetRepresentationMode: UIImagePickerPreferredAssetRepresentationMode.Current,
  });
  if (result.canceled) return [];
  return result.assets.map((asset, index) => ({
    uri: asset.uri,
    name: safeName(asset.fileName ?? '', `Photo ${index + 1}.jpg`),
    mimeType: asset.mimeType ?? 'image/jpeg',
    size: asset.fileSize ?? null,
    width: asset.width,
    height: asset.height,
  }));
}

export async function pickFiles(): Promise<UploadFile[]> {
  const result = await getDocumentAsync({ multiple: true, copyToCacheDirectory: true, type: '*/*' });
  if (result.canceled) return [];
  return result.assets.map((asset, index) => ({
    uri: asset.uri,
    name: safeName(asset.name, `File ${index + 1}`),
    mimeType: asset.mimeType ?? 'application/octet-stream',
    size: asset.size ?? null,
  }));
}

/** A photo as it should land in the Passboard folder: the original file, under its own name. */
export function asPassboardFile(photo: UploadFile): Promise<UploadFile> {
  return stage(photo.uri, photo.name, photo.mimeType);
}

/** Any other file, staged under its own name. */
export function asUploadFile(file: UploadFile): Promise<UploadFile> {
  return stage(file.uri, file.name, file.mimeType);
}

/**
 * A photo as the PC clipboard can take it. The PC decodes JPEG and PNG but not
 * HEIC, and iOS's own "compatible" conversion is not guaranteed, so anything
 * else is re-encoded as JPEG here.
 */
export async function asClipboardImage(photo: UploadFile): Promise<UploadFile> {
  if (photo.mimeType === 'image/png' || photo.mimeType === 'image/jpeg') {
    return stage(photo.uri, withExtension(photo.name, photo.mimeType === 'image/png' ? 'png' : 'jpg'), photo.mimeType);
  }
  const image = await ImageManipulator.manipulate(photo.uri).renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.92 });
  return stage(saved.uri, withExtension(photo.name, 'jpg'), 'image/jpeg');
}

/** The image the native paste button handed over, as a file ready to upload. */
export function stagePastedImage(dataUri: string): UploadFile {
  const prefix = /^data:(image\/[\w.+-]+);base64,/i.exec(dataUri);
  const isJpeg = prefix?.[1].toLowerCase() === 'image/jpeg';
  const name = `Passer ${timestamp()}.${isJpeg ? 'jpg' : 'png'}`;
  const file = new File(stagingFolder(), name);
  file.write(prefix ? dataUri.slice(prefix[0].length) : dataUri, { encoding: 'base64' });
  return { uri: file.uri, name, mimeType: isJpeg ? 'image/jpeg' : 'image/png', size: sizeOf(file) };
}

/** `/pull` sets no file name, so received content is named after the moment it arrived. */
export async function finalizePulled(
  fileUri: string,
  extension: 'png' | 'zip',
): Promise<{ uri: string; name: string; size: number | null }> {
  const name = `Passer ${timestamp()}.${extension}`;
  const folder = new Directory(Paths.cache, 'received');
  if (!folder.exists) folder.create({ intermediates: true });
  const target = new File(folder, name);
  if (target.exists) target.delete();
  await new File(fileUri).move(target);
  return { uri: target.uri, name, size: sizeOf(target) };
}

/** Saves with add-only access: Passer never asks to read the photo library. */
export async function saveImageToPhotos(fileUri: string): Promise<boolean> {
  const permission = await requestPermissionsAsync(true);
  if (!permission.granted) return false;
  await saveToLibraryAsync(fileUri);
  return true;
}

export async function shareFile(fileUri: string, type: { mimeType: string; uti: string }): Promise<void> {
  if (await isAvailableAsync()) {
    await shareAsync(fileUri, { mimeType: type.mimeType, UTI: type.uti });
  }
}
