import * as Device from 'expo-device';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { ApprovalPrompt } from '@/components/approval-prompt';
import {
  PasserCore,
  type ApprovalRequest,
  type JournalEntry,
  type Joined,
  type OfferedCapability,
  type Status,
} from '../../modules/passer-core';

/**
 * The device network (passer-core) as the app sees it: this phone's group, its members,
 * the approval requests other devices send, and the devices that just joined.
 *
 * The Rust core does the work; this provider keeps the node running while the app is
 * open and shows each approval request over whatever screen is up.
 */
type DevicesValue = {
  available: boolean;
  status: Status | null;
  /** A device that just joined through this phone, until the user has seen it. */
  joined: Joined | null;
  dismissJoined: () => void;
  refresh: () => Promise<void>;
  join: (link: string) => Promise<{ groupName: string; sas: string }>;
  createGroup: (groupName: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  stopAllSessions: () => Promise<void>;
  /** What a member lets this phone ask for, as it last said. */
  capabilities: (id: string) => Promise<OfferedCapability[]>;
  /** This phone's journal, newest first; only one member's lines when `id` is set. */
  journal: (id: string | null, limit?: number) => Promise<JournalEntry[]>;
};

const DevicesContext = createContext<DevicesValue | null>(null);

const core = PasserCore.module;

/** The name other devices see; iOS gives a generic one unless the app has the entitlement. */
export function thisDeviceName(): string {
  return Device.deviceName ?? Device.modelName ?? 'iPhone';
}

export function DevicesProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [joined, setJoined] = useState<Joined | null>(null);

  const refresh = useCallback(async () => {
    if (!core) return;
    setStatus(await core.status());
  }, []);

  /**
   * Opens the device and, once it belongs to a group, keeps its node running. Starting
   * asks the other members what they are; a node already running asks again here, since
   * the app comes back from the background.
   */
  const wake = useCallback(async () => {
    if (!core) return;
    let current = await core.open();
    if (current.group && !current.running) {
      await core.start(null);
      current = await core.status();
    } else if (current.running) {
      void core
        .refreshMembers()
        .then(() => core.status())
        .then(setStatus)
        .catch(() => {});
    }
    setStatus(current);
  }, []);

  useEffect(() => {
    if (!core) return;
    void wake().catch(() => {});
    const subscriptions = [
      core.addListener('onApprovalRequest', (request) => setRequests((list) => [...list, request])),
      core.addListener('onApprovalClosed', ({ id }) => setRequests((list) => list.filter((r) => r.id !== id))),
      core.addListener('onDeviceJoined', (device) => {
        setJoined(device);
        // Learn what the newcomer is and offers.
        void core
          .refreshMembers()
          .then(refresh)
          .catch(() => {});
      }),
      AppState.addEventListener('change', (state) => {
        if (state === 'active') void wake().catch(() => {});
      }),
    ];
    return () => subscriptions.forEach((s) => s.remove());
  }, [refresh, wake]);

  const value = useMemo<DevicesValue>(
    () => ({
      available: PasserCore.available,
      status,
      joined,
      dismissJoined: () => setJoined(null),
      refresh,
      join: async (link) => {
        if (!core) throw new Error('unavailable');
        const result = await core.join(link, thisDeviceName());
        await wake();
        return result;
      },
      createGroup: async (groupName) => {
        if (!core) throw new Error('unavailable');
        await core.createGroup(groupName, thisDeviceName());
        await wake();
      },
      remove: async (id) => {
        await core?.removeDevice(id);
        await refresh();
      },
      stopAllSessions: async () => {
        await core?.stopAllSessions();
      },
      capabilities: async (id) => (core ? core.memberCapabilities(id) : []),
      journal: async (id, limit = 50) => (core ? core.journal(limit, id) : []),
    }),
    [status, joined, refresh, wake],
  );

  const answer = (request: ApprovalRequest, allow: boolean) => {
    core?.answerApproval(request.id, allow);
    setRequests((list) => list.filter((r) => r.id !== request.id));
  };

  return (
    <DevicesContext.Provider value={value}>
      {children}
      <ApprovalPrompt request={requests[0] ?? null} onAnswer={answer} />
    </DevicesContext.Provider>
  );
}

export function useDevices(): DevicesValue {
  const value = useContext(DevicesContext);
  if (!value) throw new Error('useDevices must be used inside DevicesProvider');
  return value;
}

/** Native errors arrive as plain messages; keep the first line for the UI. */
export function errorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.split('\n')[0];
}
