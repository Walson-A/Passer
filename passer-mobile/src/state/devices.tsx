import * as Device from 'expo-device';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { CAPABILITIES, classifyCallError, type CoreCall } from '@/core/device-calls';
import { memberKind } from '@/core/devices';
import { format, t } from '@/i18n';
import { announce } from '@/platform/accessibility';
import { haptic } from '@/platform/haptics';
import { storage } from '@/platform/storage';

import {
  PasserCore,
  type Joined,
  type JournalEntry,
  type Member,
  type OfferedCapability,
  type Received,
  type Status,
} from '../../modules/passer-core';
import { useHistory } from './history';

/**
 * The device network (passer-core) as the app sees it: this phone's group, its members,
 * whether each one answers, the one Send sends to, and what other devices send here.
 *
 * The Rust core does the work and decides every permission; this provider keeps the
 * node running while the app is open.
 */

/** Whether a member answers. passer-core has no presence yet, so it is probed with `device.info`, as on the desktop. */
export type Reach = 'checking' | 'reachable' | 'unreachable';

export type Phase = 'loading' | 'ready' | 'failed';

/** Something another device just sent here, until the user has seen it. */
export type ReceivedNotice = Received & { key: number };

type DevicesValue = {
  /** False in a binary built before the module: the screens ask for an app update. */
  available: boolean;
  phase: Phase;
  loadError: string | null;
  status: Status | null;
  me: Member | null;
  /** Every member but this phone, managers first. */
  others: Member[];
  reach: Record<string, Reach>;
  /** The device Send sends to. */
  target: Member | null;
  setTarget: (id: string) => void;
  /** Checks one member again, or every one. */
  probe: (id?: string) => void;
  /** Transfers report what they learned, so a failed send marks the device unreachable at once. */
  report: (id: string, reachable: boolean) => void;
  received: ReceivedNotice | null;
  dismissReceived: () => void;
  /** A device that joined through one of this phone's invitations, until its code was compared. */
  joinedHere: Joined | null;
  dismissJoinedHere: () => void;
  reload: () => void;
  join: (link: string) => Promise<{ groupName: string; sas: string }>;
  createGroup: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  stopAllSessions: () => Promise<void>;
  invite: (asApprover: boolean) => Promise<string>;
  /** Stops this phone's node, after a code that didn't match. */
  disconnect: () => Promise<void>;
  call: CoreCall;
  /**
   * What each member lets this phone ask for, as it last said (`memberCapabilities`). Missing
   * until known, and for a member on an older core: the screens then offer every command.
   */
  offers: Record<string, OfferedCapability[] | undefined>;
  /** This phone's calls with a member (or all), newest first, never their content. */
  journal: (id: string | null, limit?: number) => Promise<JournalEntry[]>;
  /** Streams the file at `uri` to an upload capability (`file.drop`), reporting bytes as they go. */
  sendFile: (
    device: string,
    capability: string,
    input: object,
    uri: string,
    onProgress: (done: number, total: number | null) => void,
  ) => Promise<string>;
};

const DevicesContext = createContext<DevicesValue | null>(null);

const core = PasserCore.module;

/** A member that doesn't answer device.info within this long counts as unreachable. */
const PROBE_TIMEOUT_MS = 8_000;
/** While the app is in front, the Send destination is checked this often. */
const PROBE_EVERY_MS = 30_000;
/** The desktop's invitations last 10 minutes; the phone's too. */
const INVITE_MINUTES = 10;

/** The name other devices see; iOS gives a generic one unless the app has the entitlement. */
export function thisDeviceName(): string {
  return Device.deviceName ?? Device.modelName ?? 'Phone';
}

/** Native errors arrive as plain messages; keep the first line for the UI. */
export function errorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.split('\n')[0];
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('network error: timed out')), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

/** Computers first (they are what people send to), then managers, then by name. */
function rank(member: Member): number {
  const kind = memberKind(member);
  return (kind === 'laptop' || kind === 'desktop' ? 0 : 2) + (member.approver ? 0 : 1);
}

let transfers = 0;

export function DevicesProvider({ children }: { children: ReactNode }) {
  const { record } = useHistory();
  const [phase, setPhase] = useState<Phase>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [reach, setReach] = useState<Record<string, Reach>>({});
  const [targetId, setTargetId] = useState<string | null>(null);
  const [received, setReceived] = useState<ReceivedNotice | null>(null);
  const [joinedHere, setJoinedHere] = useState<Joined | null>(null);
  const [offers, setOffers] = useState<Record<string, OfferedCapability[] | undefined>>({});
  const receivedKey = useRef(0);
  const recordRef = useRef(record);
  recordRef.current = record;

  const others = useMemo(
    () =>
      (status?.members ?? [])
        .filter((member) => !member.thisDevice)
        .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)),
    [status],
  );
  const me = status?.members.find((member) => member.thisDevice) ?? null;
  const target = others.find((member) => member.id === targetId) ?? others[0] ?? null;

  const othersRef = useRef(others);
  othersRef.current = others;
  const targetRef = useRef(target);
  targetRef.current = target;

  const report = useCallback((id: string, reachable: boolean) => {
    setReach((current) => ({ ...current, [id]: reachable ? 'reachable' : 'unreachable' }));
  }, []);

  const probeOne = useCallback(
    async (id: string) => {
      if (!core) return;
      // A device already known keeps its state while it is checked again, so the screen doesn't flicker.
      setReach((current) => (current[id] ? current : { ...current, [id]: 'checking' }));
      try {
        await withTimeout(core.call(id, CAPABILITIES.deviceInfo, '{}'), PROBE_TIMEOUT_MS);
        report(id, true);
      } catch (error) {
        // A device that answers with a refusal is there all the same.
        const kind = classifyCallError(error).kind;
        report(id, kind !== 'unreachable' && kind !== 'failed');
      }
    },
    [report],
  );

  const probe = useCallback(
    (id?: string) => {
      const ids = id ? [id] : othersRef.current.map((member) => member.id);
      ids.forEach((one) => void probeOne(one));
    },
    [probeOne],
  );

  /** Opens the device and, once it belongs to a group, keeps its node running. */
  const wake = useCallback(async () => {
    if (!core) {
      setPhase('ready');
      return;
    }
    try {
      let current = await core.open();
      if (current.group && !current.running) {
        await core.start(null);
        current = await core.status();
      }
      setStatus(current);
      setLoadError(null);
      setPhase('ready');
      othersRef.current = current.members.filter((member) => !member.thisDevice);
      probe();
      // Ask the members again what they are and offer; the core answers from its cache meanwhile.
      if (current.running && core.refreshMembers) {
        void core
          .refreshMembers()
          .then(() => core.status())
          .then(setStatus)
          .catch(() => {});
      }
    } catch (error) {
      setLoadError(errorMessage(error));
      setPhase((currentPhase) => (currentPhase === 'ready' ? 'ready' : 'failed'));
    }
  }, [probe]);

  const refresh = useCallback(async () => {
    if (!core) return;
    setStatus(await core.status());
  }, []);

  useEffect(() => {
    void storage.loadTarget().then((id) => {
      if (id) setTargetId((current) => current ?? id);
    });
  }, []);

  useEffect(() => {
    if (!core) {
      setPhase('ready');
      return;
    }
    void wake();
    const subscriptions = [
      core.addListener('onDeviceJoined', (device) => {
        haptic.success();
        setJoinedHere(device);
        // Learn what the newcomer is and offers.
        void (core.refreshMembers ? core.refreshMembers() : Promise.resolve(0))
          .then(refresh)
          .catch(() => {});
      }),
      core.addListener('onReceived', (event) => {
        receivedKey.current += 1;
        setReceived({ ...event, key: receivedKey.current });
        // The event carries the sender's short id; the screens key devices by the full one.
        const sender = othersRef.current.find((member) => member.id.startsWith(event.fromId));
        const senderId = sender?.id ?? event.fromId;
        if (sender) report(sender.id, true);
        haptic.success();
        if (event.kind === 'text') {
          recordRef.current({
            pcKey: senderId,
            peer: event.from,
            direction: 'received',
            kind: 'text',
            destination: 'iphone-clipboard',
            title: event.text.trim(),
            size: null,
          });
          announce(format(t.received.text, { name: event.from }));
        } else {
          recordRef.current({
            pcKey: senderId,
            peer: event.from,
            direction: 'received',
            kind: 'file',
            destination: 'files',
            title: event.name,
            size: event.size,
            fileUri: event.uri,
          });
          announce(format(t.received.file, { name: event.from }));
        }
      }),
      AppState.addEventListener('change', (state) => {
        if (state === 'active') void wake();
      }),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [refresh, report, wake]);

  // What each member offers, once the list is known and whenever it changes.
  const memberIds = others.map((member) => member.id).join(',');
  useEffect(() => {
    if (!core?.memberCapabilities) return;
    let active = true;
    for (const member of othersRef.current) {
      core
        .memberCapabilities(member.id)
        .then((list) => {
          if (active) setOffers((current) => ({ ...current, [member.id]: list.length > 0 ? list : undefined }));
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [memberIds]);

  // While the app is in front, the Send destination is checked now and then.
  useEffect(() => {
    if (!core || !target) return;
    const timer = setInterval(() => {
      if (AppState.currentState === 'active' && targetRef.current) void probeOne(targetRef.current.id);
    }, PROBE_EVERY_MS);
    return () => clearInterval(timer);
  }, [probeOne, target]);

  const call = useCallback<CoreCall>(
    async (device, capability, inputJson) => {
      if (!core) throw new Error('unavailable');
      try {
        const output = await core.call(device, capability, inputJson);
        report(device, true);
        return output;
      } catch (error) {
        if (classifyCallError(error).kind === 'unreachable') report(device, false);
        throw error;
      }
    },
    [report],
  );

  const value = useMemo<DevicesValue>(
    () => ({
      available: PasserCore.available,
      phase,
      loadError,
      status,
      me,
      others,
      reach,
      target,
      setTarget: (id) => {
        setTargetId(id);
        void storage.saveTarget(id);
        void probeOne(id);
      },
      probe,
      report,
      received,
      dismissReceived: () => setReceived(null),
      joinedHere,
      dismissJoinedHere: () => setJoinedHere(null),
      reload: () => {
        setPhase((current) => (current === 'failed' ? 'loading' : current));
        void wake();
      },
      join: async (link) => {
        if (!core) throw new Error('unavailable');
        const result = await core.join(link, thisDeviceName());
        await wake();
        return result;
      },
      createGroup: async () => {
        if (!core) throw new Error('unavailable');
        await core.createGroup(t.devices.defaultGroup, thisDeviceName());
        await wake();
      },
      remove: async (id) => {
        if (!core) throw new Error('unavailable');
        await core.removeDevice(id);
        await refresh();
      },
      stopAllSessions: async () => {
        if (!core) throw new Error('unavailable');
        await core.stopAllSessions();
      },
      invite: async (asApprover) => {
        if (!core) throw new Error('unavailable');
        return core.invite(INVITE_MINUTES, asApprover);
      },
      disconnect: async () => {
        await core?.stop();
        await refresh().catch(() => {});
      },
      call,
      offers,
      journal: async (id, limit = 30) => (core?.journal ? core.journal(limit, id) : []),
      sendFile: async (device, capability, input, uri, onProgress) => {
        if (!core?.sendFile) throw new Error('unknown_capability: this build has no streams');
        transfers += 1;
        const transferId = `send-${Date.now().toString(36)}-${transfers}`;
        const subscription = core.addListener('onTransferProgress', (progress) => {
          if (progress.id === transferId) onProgress(progress.done, progress.total);
        });
        try {
          const output = await core.sendFile(device, capability, JSON.stringify(input), uri, transferId);
          report(device, true);
          return output;
        } catch (error) {
          if (classifyCallError(error).kind === 'unreachable') report(device, false);
          throw error;
        } finally {
          subscription.remove();
        }
      },
    }),
    [phase, loadError, status, me, others, reach, target, probe, probeOne, report, received, joinedHere, wake, refresh, call, offers],
  );

  return <DevicesContext.Provider value={value}>{children}</DevicesContext.Provider>;
}

export function useDevices(): DevicesValue {
  const value = useContext(DevicesContext);
  if (!value) throw new Error('useDevices must be used inside DevicesProvider');
  return value;
}

/** The device's role, in the desktop's words. */
export function roleOf(member: Member): string {
  return member.approver ? t.devices.manages : t.devices.sendsReceives;
}
