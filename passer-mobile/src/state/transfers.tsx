import { createContext, useContext, useRef, useState, type ReactNode } from 'react';

import { PasserClient, type TransferProgress, type UploadFile } from '@/core/client';
import { ping } from '@/core/endpoint';
import { PasserError, type PasserErrorKind } from '@/core/errors';
import { format, t } from '@/i18n';
import { announce } from '@/platform/accessibility';
import { copyImageFile, copyText } from '@/platform/clipboard';
import { fileTransport } from '@/platform/file-transport';
import { haptic } from '@/platform/haptics';
import {
  asClipboardImage,
  asPassboardFile,
  asUploadFile,
  clearOutgoing,
  finalizePulled,
  saveImageToPhotos,
  shareFile,
  stagePastedImage,
  type PickedPhoto,
} from '@/platform/media';
import type { PhotoDestination } from '@/platform/storage';

import { useConnection } from './connection';
import { useHistory, type Destination, type HistoryItem, type HistoryKind } from './history';
import { usePairings } from './pairings';

type Socket = 'clipboard' | 'passboard';

export type ActiveTransfer = {
  direction: 'up' | 'down';
  kind: HistoryKind;
  destination: Destination;
  title: string;
  /** Position in a multi-file batch. */
  index: number;
  count: number;
  /** Bytes; `total` is 0 when the size is unknown. */
  sent: number;
  total: number;
};

export type Outcome =
  | { kind: 'landed'; key: number; direction: 'up' | 'down'; socket: Socket | null; item: HistoryItem }
  | { kind: 'pulled-image'; key: number; direction: 'down'; fileUri: string; item: HistoryItem }
  | { kind: 'pulled-files'; key: number; direction: 'down'; fileUri: string; item: HistoryItem }
  | { kind: 'notice'; key: number; message: string }
  | { kind: 'failed'; key: number; error: PasserErrorKind; message: string };

type TransfersValue = {
  active: ActiveTransfer | null;
  outcome: Outcome | null;
  /** Photos picked on the home screen, waiting for the destination sheet. */
  pendingPhotos: PickedPhoto[];
  setPendingPhotos: (photos: PickedPhoto[]) => void;
  sendText: (text: string) => Promise<void>;
  sendPastedImage: (dataUri: string) => Promise<void>;
  sendPhotos: (photos: PickedPhoto[], destination: PhotoDestination) => Promise<void>;
  sendFiles: (files: UploadFile[]) => Promise<void>;
  pull: () => Promise<void>;
  saveImage: (fileUri: string) => Promise<void>;
  shareFiles: (fileUri: string) => Promise<void>;
  cancel: () => void;
  dismissOutcome: () => void;
};

const TransfersContext = createContext<TransfersValue | null>(null);

/** Only show a capsule for quick transfers if they take longer than this. */
const INDICATOR_DELAY_MS = 350;
/** Uploads and pulls check the PC first, so a sleeping PC fails in seconds rather than minutes. */
const PROBE_TIMEOUT_MS = 2_500;

function describeFailure(error: PasserError, pcName: string): string {
  switch (error.kind) {
    case 'unreachable':
      return format(t.transfer.unreachable, { name: pcName });
    case 'unauthorized':
      return format(t.home.unauthorizedTitle, { name: pcName });
    case 'pc-failed':
      return t.transfer.pcBusy;
    case 'wrong-pc':
      return t.pair.wrongPcTitle;
    case 'not-passer':
      return t.pair.notPasserTitle;
    default:
      return t.transfer.failed;
  }
}

function totalSize(files: UploadFile[]): number | null {
  return files.every((file) => file.size !== null)
    ? files.reduce((sum, file) => sum + (file.size ?? 0), 0)
    : null;
}

export function TransfersProvider({ children }: { children: ReactNode }) {
  const { pc } = usePairings();
  const { connection, reportUnauthorized, retry } = useConnection();
  const { record } = useHistory();
  const [active, setActive] = useState<ActiveTransfer | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [pendingPhotos, setPendingPhotos] = useState<PickedPhoto[]>([]);
  const running = useRef<AbortController | null>(null);
  const lastKey = useRef(0);

  const nextKey = () => {
    lastKey.current += 1;
    return lastKey.current;
  };

  const notify = (message: string) => {
    setOutcome({ kind: 'notice', key: nextKey(), message });
    announce(message);
  };

  const fail = (error: PasserErrorKind, message: string) => {
    haptic.error();
    setOutcome({ kind: 'failed', key: nextKey(), error, message });
    announce(message);
  };

  /** One transfer at a time; failures become a designed outcome, never raw text. */
  const run = async (
    work: (client: PasserClient, pcKey: string, signal: AbortSignal) => Promise<void>,
    { probe = false }: { probe?: boolean } = {},
  ) => {
    if (!pc) return;
    if (running.current) {
      // The running transfer's capsule stays on screen; the tap is refused with a felt and spoken cue.
      haptic.warning();
      announce(t.transfer.busy);
      return;
    }
    if (connection.status !== 'online') {
      fail('unreachable', format(t.transfer.unreachable, { name: pc.name }));
      return;
    }

    const controller = new AbortController();
    running.current = controller;
    setOutcome(null);
    const client = new PasserClient(connection.endpoint, connection.token, fileTransport);

    try {
      if (probe) await ping(connection.endpoint.baseUrl, PROBE_TIMEOUT_MS, controller.signal);
      await work(client, pc.key, controller.signal);
    } catch (error) {
      const failure =
        error instanceof PasserError
          ? error
          : new PasserError('protocol', error instanceof Error ? error.message : 'Transfer failed');
      if (failure.kind === 'cancelled' || controller.signal.aborted) {
        notify(t.transfer.cancelled);
      } else {
        if (failure.kind === 'unauthorized') reportUnauthorized();
        if (failure.kind === 'unreachable') retry();
        fail(failure.kind, describeFailure(failure, pc.name));
      }
    } finally {
      running.current = null;
      setActive(null);
      clearOutgoing();
    }
  };

  const land = (item: HistoryItem, socket: Socket | null, direction: 'up' | 'down') => {
    haptic.success();
    setOutcome({ kind: 'landed', key: nextKey(), direction, socket, item });
    if (pc) announce(format(direction === 'up' ? t.transfer.sentTo : t.transfer.receivedFrom, { name: pc.name }));
  };

  /** Uploads files one by one, reporting progress across the whole batch. */
  const upload = async (
    client: PasserClient,
    signal: AbortSignal,
    files: UploadFile[],
    destination: 'pc-clipboard' | 'passboard',
    kind: HistoryKind,
  ) => {
    const total = totalSize(files) ?? 0;
    let done = 0;
    for (const [index, file] of files.entries()) {
      const before = done;
      setActive({ direction: 'up', kind, destination, title: file.name, index, count: files.length, sent: before, total });
      const onProgress = ({ sent, total: requestTotal }: TransferProgress) => {
        // Multipart framing makes the request slightly larger than the file itself.
        const ratio = requestTotal > 0 ? Math.min(1, sent / requestTotal) : 0;
        const fileBytes = file.size ?? 0;
        setActive((current) => (current ? { ...current, sent: before + Math.round(ratio * fileBytes) } : current));
      };
      if (destination === 'pc-clipboard') {
        await client.pushImage(file, onProgress, signal);
      } else {
        await client.pushFile(file, onProgress, signal);
      }
      done += file.size ?? 0;
    }
  };

  const stageAll = async (items: UploadFile[], prepare: (item: UploadFile) => Promise<UploadFile>) => {
    const staged: UploadFile[] = [];
    for (const item of items) staged.push(await prepare(item));
    return staged;
  };

  const sendText = (text: string) =>
    run(async (client, pcKey, signal) => {
      if (text.length === 0) return;
      const indicator = setTimeout(
        () =>
          setActive({
            direction: 'up',
            kind: 'text',
            destination: 'pc-clipboard',
            title: text.trim(),
            index: 0,
            count: 1,
            sent: 0,
            total: 0,
          }),
        INDICATOR_DELAY_MS,
      );
      try {
        await client.pushText(text, signal);
      } finally {
        clearTimeout(indicator);
      }
      const item = record({ pcKey, direction: 'sent', kind: 'text', destination: 'pc-clipboard', title: text.trim(), size: null });
      land(item, 'clipboard', 'up');
    });

  const sendPastedImage = (dataUri: string) =>
    run(
      async (client, pcKey, signal) => {
        const file = stagePastedImage(dataUri);
        await upload(client, signal, [file], 'pc-clipboard', 'image');
        const item = record({ pcKey, direction: 'sent', kind: 'image', destination: 'pc-clipboard', title: t.transfer.pastedImage, size: file.size });
        land(item, 'clipboard', 'up');
      },
      { probe: true },
    );

  const sendPhotos = (photos: PickedPhoto[], destination: PhotoDestination) =>
    run(
      async (client, pcKey, signal) => {
        if (photos.length === 0) return;
        if (destination === 'clipboard') {
          const file = await asClipboardImage(photos[0]);
          await upload(client, signal, [file], 'pc-clipboard', 'image');
          const item = record({ pcKey, direction: 'sent', kind: 'image', destination: 'pc-clipboard', title: photos[0].name, size: file.size });
          land(item, 'clipboard', 'up');
          return;
        }
        const files = await stageAll(photos, asPassboardFile);
        await upload(client, signal, files, 'passboard', 'image');
        const item = record({
          pcKey,
          direction: 'sent',
          kind: files.length > 1 ? 'files' : 'image',
          destination: 'passboard',
          title: files.length > 1 ? format(t.transfer.photosCount, { count: files.length }) : files[0].name,
          size: totalSize(files),
        });
        land(item, 'passboard', 'up');
      },
      { probe: true },
    );

  const sendFiles = (picked: UploadFile[]) =>
    run(
      async (client, pcKey, signal) => {
        if (picked.length === 0) return;
        const files = await stageAll(picked, asUploadFile);
        await upload(client, signal, files, 'passboard', 'file');
        const item = record({
          pcKey,
          direction: 'sent',
          kind: files.length > 1 ? 'files' : 'file',
          destination: 'passboard',
          title: files.length > 1 ? format(t.transfer.filesCount, { count: files.length }) : files[0].name,
          size: totalSize(files),
        });
        land(item, 'passboard', 'up');
      },
      { probe: true },
    );

  const pull = () =>
    run(
      async (client, pcKey, signal) => {
        setActive({
          direction: 'down',
          kind: 'text',
          destination: 'iphone-clipboard',
          title: t.transfer.receiving,
          index: 0,
          count: 1,
          sent: 0,
          total: 0,
        });
        const result = await client.pull(signal);

        if (result.kind === 'text') {
          if (result.text.length === 0) {
            haptic.warning();
            notify(t.transfer.pcClipboardEmpty);
            return;
          }
          await copyText(result.text);
          const item = record({ pcKey, direction: 'received', kind: 'text', destination: 'iphone-clipboard', title: result.text.trim(), size: null });
          land(item, null, 'down');
          return;
        }

        if (result.kind === 'image') {
          const file = await finalizePulled(result.fileUri, 'png');
          await copyImageFile(file.uri);
          const item = record({ pcKey, direction: 'received', kind: 'image', destination: 'iphone-clipboard', title: t.transfer.imageFromPc, size: file.size });
          haptic.success();
          setOutcome({ kind: 'pulled-image', key: nextKey(), direction: 'down', fileUri: file.uri, item });
          if (pc) announce(format(t.transfer.receivedFrom, { name: pc.name }));
          return;
        }

        const file = await finalizePulled(result.fileUri, 'zip');
        const item = record({ pcKey, direction: 'received', kind: 'files', destination: 'files', title: file.name, size: file.size });
        haptic.success();
        setOutcome({ kind: 'pulled-files', key: nextKey(), direction: 'down', fileUri: file.uri, item });
        if (pc) announce(format(t.transfer.receivedFrom, { name: pc.name }));
        try {
          await shareFile(file.uri, { mimeType: 'application/zip', uti: 'public.zip-archive' });
        } catch {
          // The files arrived; if the share sheet can't open, the Share button stays on the home screen.
        }
      },
      { probe: true },
    );

  const saveImage = async (fileUri: string) => {
    try {
      if (await saveImageToPhotos(fileUri)) {
        haptic.success();
        notify(t.transfer.savedToPhotos);
      }
    } catch {
      fail('protocol', t.transfer.failed);
    }
  };

  const shareFiles = async (fileUri: string) => {
    try {
      await shareFile(fileUri, { mimeType: 'application/zip', uti: 'public.zip-archive' });
    } catch {
      fail('protocol', t.transfer.failed);
    }
  };

  const cancel = () => running.current?.abort();

  const dismissOutcome = () => setOutcome(null);

  return (
    <TransfersContext.Provider
      value={{
        active,
        outcome,
        pendingPhotos,
        setPendingPhotos,
        sendText,
        sendPastedImage,
        sendPhotos,
        sendFiles,
        pull,
        saveImage,
        shareFiles,
        cancel,
        dismissOutcome,
      }}
    >
      {children}
    </TransfersContext.Provider>
  );
}

export function useTransfers(): TransfersValue {
  const value = useContext(TransfersContext);
  if (!value) throw new Error('useTransfers must be used inside TransfersProvider');
  return value;
}
