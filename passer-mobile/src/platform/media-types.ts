import type { UploadFile } from '@/core/client';

export type PickedPhoto = UploadFile & { width: number; height: number };
