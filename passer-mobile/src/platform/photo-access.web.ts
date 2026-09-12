import { benchHost } from './web-bench';

export type PhotoAccess = 'all' | 'limited' | 'denied' | 'undetermined';

/** Bench stand-in (see `web-bench.ts`): access starts undecided and is granted on request. */
let access: PhotoAccess = 'undetermined';

export async function readPhotoAccess(): Promise<PhotoAccess> {
  return access;
}

export async function requestPhotoAccess(): Promise<PhotoAccess> {
  access = 'all';
  benchHost().log('photos', 'Accès aux photos accordé');
  return access;
}
