import { requireOptionalNativeModule, type NativeModule } from 'expo';

/**
 * The Passer device network (passer-core) on this phone.
 *
 * Optional on purpose: the app ships JavaScript updates over the air, and a binary
 * built before this module existed must not crash when it receives them. There,
 * `PasserCore.available` is false and the Devices screen explains that an update of the
 * app is needed.
 */

export type DeviceKind = 'phone' | 'tablet' | 'laptop' | 'desktop' | 'unknown';

/**
 * A member of the group. `id`, `name` and `approver` come from the verified device log;
 * the rest is what the member last said about itself, for display only.
 */
export type Member = {
  id: string;
  shortId: string;
  name: string;
  approver: boolean;
  thisDevice: boolean;
  kind: DeviceKind;
  os: string | null;
  osVersion: string | null;
  appVersion: string | null;
  coreVersion: string | null;
  /** When it last answered this phone, in Unix seconds; null for this phone or never. */
  answeredAt: number | null;
};

/** Something another member lets this phone ask for. */
export type OfferedCapability = {
  name: string;
  title: string;
  description: string;
  effect: 'read' | 'write' | 'sensitive';
  needsApproval: boolean;
};

/** One line of this phone's journal: what was called, never what was sent. */
export type JournalEntry = {
  seq: number;
  at: number;
  outgoing: boolean;
  peerId: string;
  peerShortId: string;
  peerName: string;
  agent: string | null;
  capability: string;
  target: string | null;
  decision: string;
  approved: boolean | null;
  outcome: string;
};

export type Status = {
  deviceId: string;
  group: string | null;
  running: boolean;
  members: Member[];
};

/** Another device asks this phone's user to approve something sensitive. */
export type ApprovalRequest = {
  id: number;
  requester: string;
  requesterId: string;
  agent: string | null;
  title: string;
  capability: string;
  target: string | null;
  minutes: number;
  expiresInSecs: number;
};

export type Joined = { name: string; id: string; sas: string };

type Events = {
  onApprovalRequest: (request: ApprovalRequest) => void;
  onApprovalClosed: (event: { id: number }) => void;
  onDeviceJoined: (joined: Joined) => void;
};

declare class PasserCoreNative extends NativeModule<Events> {
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
  /** Asks the other members what they are and offer; resolves with how many answered. */
  refreshMembers(): Promise<number>;
  memberCapabilities(id: string): Promise<OfferedCapability[]>;
  journal(limit: number, id: string | null): Promise<JournalEntry[]>;
  answerApproval(id: number, allow: boolean): boolean;
}

const native = requireOptionalNativeModule<PasserCoreNative>('PasserCore');

export const PasserCore = {
  available: native != null,
  module: native,
};

/** The links an approver device shows as a QR code. */
export function isCoreInvitation(link: string): boolean {
  return link.startsWith('passer-core://join?');
}
