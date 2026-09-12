import { getDocumentAsync } from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { launchImageLibraryAsync, UIImagePickerPreferredAssetRepresentationMode } from 'expo-image-picker';
import { requestPermissionsAsync, saveToLibraryAsync } from 'expo-media-library/legacy';
import { isAvailableAsync, shareAsync } from 'expo-sharing';

import type { UploadFile } from '@/core/client';

export type PickedPhoto = UploadFile & { width: number; height: number };

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** `2026-09-12 14.32.05`: sortable, and legal in Windows file names. */
function timestamp(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}.${pad(date.getMinutes())}.${pad(date.getSeconds())}`;
}

function directory(name: string): Directory {
  const folder = new Directory(Paths.cache, name);
  if (!folder.exists) folder.create({ intermediates: true });
  return folder;
}

/** Characters Windows refuses in file names, plus control characters. */
const UNSAFE_FILE_NAME = /[\\/:*?"<>|\x00-\x1f]/g;

/** The PC keeps only the base name, so separators and reserved characters are replaced here. */
function safeName(name: string, fallback: string): string {
  const cleaned = name.replace(UNSAFE_FILE_NAME, ' ').trim();
  return cleaned || fallback;
}

function withExtension(name: string, extension: string): string {
  const stem = name.replace(/\.[^.]+$/, '');
  return `${stem}.${extension}`;
}

/**
 * Multipart uploads name the part after the file on disk, so outgoing files are
 * staged in the cache under the exact name the PC should show.
 */
function stage(uri: string, name: string, mimeType: string): UploadFile {
  const source = new File(uri);
  if (source.name === name) return { uri, name, mimeType, size: source.size ?? null };
  const target = new File(directory('outgoing'), name);
  if (target.exists) target.delete();
  source.copy(target);
  return { uri: target.uri, name, mimeType, size: target.size ?? null };
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
export function asPassboardFile(photo: UploadFile): UploadFile {
  return stage(photo.uri, photo.name, photo.mimeType);
}

/** Any other file, staged under its own name. */
export function asUploadFile(file: UploadFile): UploadFile {
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
  const file = new File(directory('outgoing'), name);
  if (file.exists) file.delete();
  file.write(prefix ? dataUri.slice(prefix[0].length) : dataUri, { encoding: 'base64' });
  return { uri: file.uri, name, mimeType: isJpeg ? 'image/jpeg' : 'image/png', size: file.size ?? null };
}

/** `/pull` sets no file name, so received content is named after the moment it arrived. */
export function finalizePulled(fileUri: string, extension: 'png' | 'zip'): { uri: string; name: string; size: number | null } {
  const name = `Passer ${timestamp()}.${extension}`;
  const target = new File(directory('received'), name);
  if (target.exists) target.delete();
  new File(fileUri).move(target);
  return { uri: target.uri, name, size: target.size ?? null };
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
