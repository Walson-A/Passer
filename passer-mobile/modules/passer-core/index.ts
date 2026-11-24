import { requireOptionalNativeModule, type NativeModule } from 'expo';

/**
 * The Passer device network (passer-core) on this phone.
 *
 * Optional on purpose: the app ships JavaScript updates over the air, and a binary
 * built before this module existed must not crash when it receives them. There,
 * `PasserCore.available` is false and the Devices screen explains that an update of the
 * app is needed.
 */

export type Member = {
  id: string;
  shortId: string;
  name: string;
  approver: boolean;
  thisDevice: boolean;
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

/**
 * Another device used one of this phone's capabilities (`clipboard.write`, `file.receive`).
 * The native side has already done the work: the text is on the clipboard, the file is saved.
 */
export type Received = { from: string; fromId: string; agent: string | null } & (
  | { kind: 'text'; text: string }
  | { kind: 'file'; name: string; uri: string; size: number }
);

type Events = {
  onApprovalRequest: (request: ApprovalRequest) => void;
  onApprovalClosed: (event: { id: number }) => void;
  onDeviceJoined: (joined: Joined) => void;
  onReceived: (received: Received) => void;
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
