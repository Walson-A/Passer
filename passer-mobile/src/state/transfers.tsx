import { createContext, useContext, useRef, useState, type ReactNode } from 'react';

import { PasserClient, type TransferProgress, type UploadFile } from '@/core/client';
import {
  base64Size,
  CallFailure,
  classifyCallError,
  fitsOneCall,
  MAX_FILE_BYTES,
  readClipboardOf,
  sendFileTo,
  sendTextTo,
} from '@/core/device-calls';
import { ping } from '@/core/endpoint';
import { PasserError } from '@/core/errors';
import { format, t } from '@/i18n';
import { announce } from '@/platform/accessibility';
import { copyText } from '@/platform/clipboard';
import { fileTransport } from '@/platform/file-transport';
import { haptic } from '@/platform/haptics';
import {
  asClipboardImage,
  asPassboardFile,
  asUploadFile,
  clearOutgoing,
  fitPhoto,
  readBase64,
  stagePastedImage,
  type PickedPhoto,
} from '@/platform/media';
import type { PhotoDestination } from '@/platform/storage';

import type { Member } from '../../modules/passer-core';
import { useConnection } from './connection';
import { useDevices } from './devices';
import { useHistory, type Destination, type HistoryItem, type HistoryKind } from './history';
import { usePairings } from './pairings';

/**
 * Sending to the device chosen on Send, and fetching its clipboard.
 *
 * Everything goes through the device network (passer-core), so the other device's own
 * rules and approvals apply. Two things a single call can't carry yet use the direct
 * connection to the PC, when the user set one up for Shortcuts (Settings): files over
 * 700 KB, and images for the PC clipboard. Without it, photos are shrunk to fit and
 * larger files are refused with an explanation.
 */

export type ActiveTransfer = {
  direction: 'up' | 'down';
  kind: HistoryKind;
  title: string;
  peer: string;
  /** Position in a multi-file batch. */
  index: number;
  count: number;
  /** Bytes; `total` is 0 when the progress is unknown. */
  sent: number;
  total: number;
  /** The other device's user must allow it first. */
  waiting: boolean;
  /** Only uploads over the direct connection can stop halfway. */
  cancellable: boolean;
};

export type Outcome =
  | { kind: 'landed'; key: number; direction: 'up' | 'down'; message: string; note: string | null; item: HistoryItem }
  | { kind: 'notice'; key: number; message: string }
  | { kind: 'failed'; key: number; message: string; body: string | null };

type TransfersValue = {
  active: ActiveTransfer | null;
  outcome: Outcome | null;
  /** A direct connection to the Send destination is up (Settings › Direct connection). */
  direct: boolean;
  /** Photos picked on Send, waiting for the destination sheet (direct connection only). */
  pendingPhotos: PickedPhoto[];
  setPendingPhotos: (photos: PickedPhoto[]) => void;
  /** Each resolves to true when it went through, false when refused, failed or cancelled. */
  sendText: (text: string) => Promise<boolean>;
  sendPastedImage: (dataUri: string) => Promise<boolean>;
  sendPhotos: (photos: PickedPhoto[], destination?: PhotoDestination) => Promise<boolean>;
  sendFiles: (files: UploadFile[]) => Promise<boolean>;
  pull: () => Promise<boolean>;
  /** Fails with the usual message when the destination isn't reachable, before anything is read or picked. */
  ensureReachable: () => boolean;
  /** A notice on Send, for an action that ends before any transfer starts. */
  inform: (message: string) => void;
  cancel: () => void;
  dismissOutcome: () => void;
};

const TransfersContext = createContext<TransfersValue | null>(null);

/** Quick transfers only show progress if they take longer than this. */
const INDICATOR_DELAY_MS = 350;
/** Direct uploads check the PC first, so a sleeping PC fails in seconds rather than minutes. */
const PROBE_TIMEOUT_MS = 2_500;

class Cancelled extends Error {}

/** The direct (HTTP) pairing belongs to the same PC when the names match: both come from the PC's own name. */
function samePc(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function describe(error: unknown, name: string): string {
  if (error instanceof PasserError) {
    switch (error.kind) {
      case 'unreachable':
        return format(t.transfer.unreachable, { name });
      case 'pc-failed':
        return t.transfer.pcBusy;
      default:
        return t.transfer.failed;
    }
  }
  switch (classifyCallError(error).kind) {
    case 'denied':
      return format(t.transfer.denied, { name });
    case 'timeout':
      return format(t.transfer.timeout, { name });
    case 'too-large':
      return t.transfer.tooLarge;
    case 'unreachable':
      return format(t.transfer.unreachable, { name });
    case 'not-member':
      return t.transfer.notMember;
    case 'not-offered':
      return format(t.transfer.notOffered, { name });
    default:
      return t.transfer.failed;
  }
}

export function TransfersProvider({ children }: { children: ReactNode }) {
  const { target, call, reach, report, offers, sendFile, canStream } = useDevices();
  /** The destination takes files of any size as a stream (`file.drop`, desktop with passer-core streams). */
  // Streams need the PC to offer file.drop and this build to carry them: a build from before
  // mobile-v0.3.0, reached by an over-the-air update, sends one call per file instead.
  const streams =
    canStream && target ? (offers[target.id]?.some((offer) => offer.name === 'file.drop') ?? false) : false;
  const { pc } = usePairings();
  const { connection, reportUnauthorized, retry } = useConnection();
  const { record } = useHistory();
  const [active, setActive] = useState<ActiveTransfer | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [pendingPhotos, setPendingPhotos] = useState<PickedPhoto[]>([]);
  const running = useRef<AbortController | null>(null);
  const lastKey = useRef(0);

  const direct =
    target !== null && pc !== null && samePc(pc.name, target.name) && connection.status === 'online' ? connection : null;

  const nextKey = () => {
    lastKey.current += 1;
    return lastKey.current;
  };

  const notify = (message: string) => {
    setOutcome({ kind: 'notice', key: nextKey(), message });
    announce(message);
  };

  const fail = (message: string, body: string | null = null) => {
    haptic.error();
    setOutcome({ kind: 'failed', key: nextKey(), message, body });
    announce(body ? `${message}. ${body}` : message);
  };

  type Work = (to: Member, signal: AbortSignal) => Promise<void>;

  /** One transfer at a time; failures become a designed outcome, never raw text. */
  const run = async (work: Work): Promise<boolean> => {
    if (!target) return false;
    if (running.current) {
      // The running transfer stays on screen; the tap is refused with a felt and spoken cue.
      haptic.warning();
      announce(t.transfer.busy);
      return false;
    }
    const controller = new AbortController();
    running.current = controller;
    setOutcome(null);
    try {
      await work(target, controller.signal);
      return true;
    } catch (error) {
      if (
        error instanceof Cancelled ||
        controller.signal.aborted ||
        (error instanceof PasserError && error.kind === 'cancelled')
      ) {
        notify(t.transfer.cancelled);
      } else {
        if (error instanceof PasserError) {
          if (error.kind === 'unauthorized') reportUnauthorized();
          if (error.kind === 'unreachable') retry();
        }
        if (error instanceof CallFailure && error.kind === 'unreachable') report(target.id, false);
        const tooLarge = !(error instanceof PasserError) && classifyCallError(error).kind === 'too-large';
        fail(describe(error, target.name), tooLarge ? t.transfer.tooLargeBody : null);
      }
      return false;
    } finally {
      running.current = null;
      setActive(null);
      clearOutgoing();
    }
  };

  const land = (to: Member, item: HistoryItem, message: string, note: string | null = null) => {
    haptic.success();
    setOutcome({ kind: 'landed', key: nextKey(), direction: item.direction === 'sent' ? 'up' : 'down', message, note, item });
    announce(note ? `${message}. ${note}` : message);
    report(to.id, true);
  };

  const sentItem = (to: Member, kind: HistoryKind, destination: Destination, title: string, size: number | null) =>
    record({ pcKey: to.id, peer: to.name, direction: 'sent', kind, destination, title, size });

  const begin = (to: Member, patch: Partial<ActiveTransfer> & Pick<ActiveTransfer, 'kind' | 'title'>) =>
    setActive({
      direction: 'up',
      peer: to.name,
      index: 0,
      count: 1,
      sent: 0,
      total: 0,
      waiting: false,
      cancellable: false,
      ...patch,
    });

  /** Over the direct connection, uploads report their progress across the whole batch. */
  const uploadDirect = async (
    signal: AbortSignal,
    to: Member,
    files: UploadFile[],
    destination: 'pc-clipboard' | 'passboard',
    kind: HistoryKind,
  ) => {
    if (!direct) throw new PasserError('unreachable', 'no direct connection');
    const client = new PasserClient(direct.endpoint, direct.token, fileTransport);
    await ping(direct.endpoint.baseUrl, PROBE_TIMEOUT_MS, signal);
    const total = files.every((file) => file.size !== null) ? files.reduce((sum, file) => sum + (file.size ?? 0), 0) : 0;
    let done = 0;
    for (const [index, file] of files.entries()) {
      const before = done;
      begin(to, { kind, title: file.name, index, count: files.length, sent: before, total, cancellable: true });
      const onProgress = ({ sent, total: requestTotal }: TransferProgress) => {
        // Multipart framing makes the request slightly larger than the file itself.
        const ratio = requestTotal > 0 ? Math.min(1, sent / requestTotal) : 0;
        setActive((current) => (current ? { ...current, sent: before + Math.round(ratio * (file.size ?? 0)) } : current));
      };
      if (destination === 'pc-clipboard') await client.pushImage(file, onProgress, signal);
      else await client.pushFile(file, onProgress, signal);
      done += file.size ?? 0;
    }
  };

  /**
   * Through the device network as streams: any size, with progress across the batch. A batch
   * stops between files when cancelled.
   */
  const streamToGroup = async (signal: AbortSignal, to: Member, files: UploadFile[], kind: HistoryKind) => {
    const total = files.every((file) => file.size !== null) ? files.reduce((sum, file) => sum + (file.size ?? 0), 0) : 0;
    let done = 0;
    for (const [index, file] of files.entries()) {
      if (signal.aborted) throw new Cancelled();
      const before = done;
      begin(to, { kind, title: file.name, index, count: files.length, sent: before, total, cancellable: files.length > 1 });
      await sendFile(to.id, 'file.drop', { name: file.name }, file.uri, (sent, fileTotal) => {
        const size = file.size ?? fileTotal ?? 0;
        setActive((current) =>
          current ? { ...current, sent: before + Math.min(sent, size || sent), total: total || fileTotal || 0 } : current,
        );
      });
      done += file.size ?? 0;
    }
  };

  /** Through the device network, one call per file; a batch stops between files when cancelled. */
  const sendThroughGroup = async (signal: AbortSignal, to: Member, files: UploadFile[], kind: HistoryKind) => {
    for (const [index, file] of files.entries()) {
      if (signal.aborted) throw new Cancelled();
      begin(to, { kind, title: file.name, index, count: files.length, cancellable: files.length > 1 });
      await sendFileTo(call, to.id, file.name, await readBase64(file.uri));
    }
  };

  const sendText = (text: string) =>
    run(async (to) => {
      if (text.length === 0) return;
      const indicator = setTimeout(() => begin(to, { kind: 'text', title: text.trim() }), INDICATOR_DELAY_MS);
      try {
        await sendTextTo(call, to.id, text);
      } finally {
        clearTimeout(indicator);
      }
      land(to, sentItem(to, 'text', 'pc-clipboard', text.trim(), null), format(t.transfer.onClipboardOf, { name: to.name }));
    });

  const sendPastedImage = (dataUri: string) =>
    run(async (to, signal) => {
      const file = stagePastedImage(dataUri);
      if (direct) {
        // Only the direct connection can put an image on the PC clipboard today.
        await uploadDirect(signal, to, [file], 'pc-clipboard', 'image');
        land(
          to,
          sentItem(to, 'image', 'pc-clipboard', t.transfer.pastedImage, file.size),
          format(t.transfer.onClipboardOf, { name: to.name }),
        );
        return;
      }
      const base64 = dataUri.replace(/^data:[^;]+;base64,/, '');
      if (base64Size(base64) > MAX_FILE_BYTES) throw new CallFailure('too-large', 'pasted image over 700 KB');
      begin(to, { kind: 'image', title: t.transfer.pastedImage });
      await sendFileTo(call, to.id, file.name, base64);
      land(to, sentItem(to, 'image', 'passboard', file.name, file.size), format(t.transfer.inPasserFolderOf, { name: to.name }));
    });

  const sendPhotos = (photos: PickedPhoto[], destination: PhotoDestination = 'passboard') =>
    run(async (to, signal) => {
      if (photos.length === 0) return;
      if (direct) {
        if (destination === 'clipboard') {
          const file = await asClipboardImage(photos[0]);
          await uploadDirect(signal, to, [file], 'pc-clipboard', 'image');
          land(
            to,
            sentItem(to, 'image', 'pc-clipboard', photos[0].name, file.size),
            format(t.transfer.onClipboardOf, { name: to.name }),
          );
          return;
        }
        const files: UploadFile[] = [];
        for (const photo of photos) files.push(await asPassboardFile(photo));
        await uploadDirect(signal, to, files, 'passboard', 'image');
        land(to, photosItem(to, files), format(t.transfer.inPasserFolderOf, { name: to.name }));
        return;
      }
      if (streams) {
        // Originals, whatever their size: the PC keeps them in its Passer folder.
        await streamToGroup(signal, to, photos, 'image');
        land(to, photosItem(to, photos), format(t.transfer.inPasserFolderOf, { name: to.name }));
        return;
      }
      const files: UploadFile[] = [];
      let reduced = false;
      for (const photo of photos) {
        begin(to, { kind: 'image', title: photo.name, count: photos.length, index: files.length });
        const fitted = await fitPhoto(photo, MAX_FILE_BYTES);
        reduced ||= fitted.reduced;
        files.push(fitted.file);
      }
      await sendThroughGroup(signal, to, files, 'image');
      land(
        to,
        photosItem(to, files),
        format(t.transfer.inPasserFolderOf, { name: to.name }),
        reduced ? t.transfer.reduced : null,
      );
    });

  const photosItem = (to: Member, files: UploadFile[]) =>
    sentItem(
      to,
      files.length > 1 ? 'files' : 'image',
      'passboard',
      files.length > 1 ? format(t.transfer.photosCount, { count: files.length }) : files[0].name,
      files.every((file) => file.size !== null) ? files.reduce((sum, file) => sum + (file.size ?? 0), 0) : null,
    );

  const sendFiles = (picked: UploadFile[]) =>
    run(async (to, signal) => {
      if (picked.length === 0) return;
      if (streams) {
        await streamToGroup(signal, to, picked, 'file');
      } else {
        await sendInCalls(signal, to, picked);
      }
      const item = sentItem(
        to,
        picked.length > 1 ? 'files' : 'file',
        'passboard',
        picked.length > 1 ? format(t.transfer.filesCount, { count: picked.length }) : picked[0].name,
        picked.every((file) => file.size !== null) ? picked.reduce((sum, file) => sum + (file.size ?? 0), 0) : null,
      );
      land(to, item, format(t.transfer.inPasserFolderOf, { name: to.name }));
    });

  /** A destination without streams: one call per small file, the direct connection for larger ones. */
  const sendInCalls = async (signal: AbortSignal, to: Member, picked: UploadFile[]) => {
    const large = picked.filter((file) => !fitsOneCall(file.size));
    // Nothing leaves when part of the batch can't: a half-sent batch is harder to understand.
    if (large.length > 0 && !direct) throw new CallFailure('too-large', `${large.length} files over 700 KB`);
    const small = picked.filter((file) => fitsOneCall(file.size));
    if (small.length > 0) await sendThroughGroup(signal, to, small, 'file');
    if (large.length > 0) {
      const staged: UploadFile[] = [];
      for (const file of large) staged.push(await asUploadFile(file));
      await uploadDirect(signal, to, staged, 'passboard', 'file');
    }
  };

  const pull = () =>
    run(async (to) => {
      // The other device's user approves each read: the wait is shown as such.
      setActive({
        direction: 'down',
        kind: 'text',
        title: format(t.transfer.waitingApproval, { name: to.name }),
        peer: to.name,
        index: 0,
        count: 1,
        sent: 0,
        total: 0,
        waiting: true,
        cancellable: false,
      });
      const text = await readClipboardOf(call, to.id);
      if (text.length === 0) {
        haptic.warning();
        notify(format(t.transfer.pcClipboardEmpty, { name: to.name }));
        report(to.id, true);
        return;
      }
      await copyText(text);
      const item = record({
        pcKey: to.id,
        peer: to.name,
        direction: 'received',
        kind: 'text',
        destination: 'iphone-clipboard',
        title: text.trim(),
        size: null,
      });
      land(to, item, t.transfer.copiedHere);
    });

  const ensureReachable = () => {
    if (!target) return false;
    if (reach[target.id] !== 'unreachable') return true;
    fail(format(t.transfer.unreachable, { name: target.name }));
    return false;
  };

  return (
    <TransfersContext.Provider
      value={{
        active,
        outcome,
        direct: direct !== null,
        pendingPhotos,
        setPendingPhotos,
        sendText,
        sendPastedImage,
        sendPhotos,
        sendFiles,
        pull,
        ensureReachable,
        inform: notify,
        cancel: () => running.current?.abort(),
        dismissOutcome: () => setOutcome(null),
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
