/**
 * Bench version of the device network: every call goes to the bench's fake group
 * (`bench/core.ts`), which answers as the desktop does. Nothing here talks to a real device.
 */
import { benchHost } from '@/platform/web-bench';

import type { ApprovalRequest, Joined, JournalEntry, OfferedCapability, Received, Status, TransferProgress } from './index';

export type {
  ApprovalRequest,
  DeviceKind,
  Joined,
  JournalEntry,
  Member,
  OfferedCapability,
  Received,
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
  addListener(event: 'onApprovalRequest', listener: (request: ApprovalRequest) => void): { remove: () => void };
  addListener(event: 'onApprovalClosed', listener: (event: { id: number }) => void): { remove: () => void };
  addListener(event: 'onDeviceJoined', listener: (joined: Joined) => void): { remove: () => void };
  addListener(event: 'onReceived', listener: (received: Received) => void): { remove: () => void };
  addListener(event: 'onTransferProgress', listener: (progress: TransferProgress) => void): { remove: () => void };
};

export const PasserCore = { available: true, module: proxy as unknown as Proxy };

export function isCoreInvitation(link: string): boolean {
  return link.startsWith('passer-core://join?');
}
