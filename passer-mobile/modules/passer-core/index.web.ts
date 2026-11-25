/**
 * Bench version of the device network: every call goes to the bench's fake group
 * (`bench/core.ts`), which answers as the desktop does. Nothing here talks to a real device.
 */
import { benchHost } from '@/platform/web-bench';

import type {
  ApprovalRequest,
  Joined,
  JournalEntry,
  OfferedCapability,
  Received,
  ScreenNativeEvent,
  Status,
  TransferProgress,
} from './index';
import { BenchScreenView } from './screen-view.web';

export type {
  ApprovalRequest,
  DeviceKind,
  Joined,
  JournalEntry,
  Member,
  OfferedCapability,
  Received,
  ScreenNativeEvent,
  Status,
  TransferProgress,
} from './index';

type Listener = (payload: never) => void;

const proxy = {
  open: () => benchHost().core.open(),
  status: () => benchHost().core.status(),
  createGroup: (groupName: string, _deviceName: string) => benchHost().core.createGroup(groupName),
  join: (_link: string, _deviceName: string) => benchHost().core.join(),
  start: (_coord: string | null) => benchHost().core.start(),
  stop: () => benchHost().core.stop(),
  invite: (minutes: number, asApprover: boolean) => benchHost().core.invite(minutes, asApprover),
  call: (device: string, capability: string, inputJson: string) => benchHost().core.call(device, capability, inputJson),
  removeDevice: (id: string) => benchHost().core.removeDevice(id),
  stopAllSessions: () => benchHost().core.stopAllSessions(),
  sendFile: (device: string, capability: string, inputJson: string, uri: string, transferId: string) =>
    benchHost().core.sendFile(device, capability, inputJson, uri, transferId),
  fetchFile: (device: string, capability: string, inputJson: string, uri: string, transferId: string) =>
    benchHost().core.fetchFile(device, capability, inputJson, uri, transferId),
  refreshMembers: () => benchHost().core.refreshMembers(),
  memberCapabilities: (id: string) => benchHost().core.memberCapabilities(id),
  journal: (limit: number, id: string | null) => benchHost().core.journal(limit, id),
  screenAvailable: () => true,
  screenOpen: (device: string, capability: string, inputJson: string, sessionId: string) =>
    benchHost().core.screenOpen(device, capability, inputJson, sessionId),
  screenSend: (sessionId: string, json: string) => benchHost().core.screenSend(sessionId, json),
  screenClose: (sessionId: string) => benchHost().core.screenClose(sessionId),
  answerApproval: (id: number, allow: boolean) => benchHost().core.answerApproval(id, allow),
  addListener: (event: string, listener: Listener) =>
    benchHost().core.addListener(event, listener),
};

type Proxy = {
  open(): Promise<Status>;
  status(): Promise<Status>;
  createGroup(groupName: string, deviceName: string): Promise<void>;
  join(link: string, deviceName: string): Promise<{ groupName: string; sas: string }>;
  start(coord: string | null): Promise<void>;
  stop(): Promise<void>;
  invite(minutes: number, asApprover: boolean): Promise<string>;
  call(device: string, capability: string, inputJson: string): Promise<string>;
  removeDevice(id: string): Promise<void>;
  stopAllSessions(): Promise<void>;
  sendFile(device: string, capability: string, inputJson: string, uri: string, transferId: string): Promise<string>;
  fetchFile(device: string, capability: string, inputJson: string, uri: string, transferId: string): Promise<string>;
  refreshMembers(): Promise<number>;
  memberCapabilities(id: string): Promise<OfferedCapability[]>;
  journal(limit: number, id: string | null): Promise<JournalEntry[]>;
  answerApproval(id: number, allow: boolean): boolean;
  screenAvailable?(): boolean;
  screenOpen?(device: string, capability: string, inputJson: string, sessionId: string): Promise<void>;
  screenSend?(sessionId: string, json: string): void;
  screenClose?(sessionId: string): void;
  addListener(event: 'onScreenEvent', listener: (event: ScreenNativeEvent) => void): { remove: () => void };
  addListener(event: 'onApprovalRequest', listener: (request: ApprovalRequest) => void): { remove: () => void };
  addListener(event: 'onApprovalClosed', listener: (event: { id: number }) => void): { remove: () => void };
  addListener(event: 'onDeviceJoined', listener: (joined: Joined) => void): { remove: () => void };
  addListener(event: 'onReceived', listener: (received: Received) => void): { remove: () => void };
  addListener(event: 'onTransferProgress', listener: (progress: TransferProgress) => void): { remove: () => void };
};

export const PasserCore = { available: true, module: proxy as unknown as Proxy };

/** The bench can always show a (drawn) screen. */
export function screenSupported(): boolean {
  return true;
}

export const ScreenView = BenchScreenView;

export function isCoreInvitation(link: string): boolean {
  return link.startsWith('passer-core://join?');
}
