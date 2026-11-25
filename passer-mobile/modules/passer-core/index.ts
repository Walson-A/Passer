import { requireNativeView, requireOptionalNativeModule, type NativeModule } from 'expo';
import type { ComponentType } from 'react';
import { Platform, type ViewProps } from 'react-native';

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

/**
 * Another device used one of this phone's capabilities (`clipboard.write`, `file.receive`).
 * The native side has already done the work: the text is on the clipboard, the file is saved.
 */
export type Received = { from: string; fromId: string; agent: string | null } & (
  | { kind: 'text'; text: string }
  | { kind: 'file'; name: string; uri: string; size: number }
);

/** How far a `sendFile` or `fetchFile` has gone; `total` is known for uploads. */
export type TransferProgress = { id: string; done: number; total: number | null };

/**
 * What a screen session reports (`ScreenSession.swift`): a JSON event of the Vasistas
 * protocol, the pointer's new look, or the end of the stream. The video itself stays native.
 */
export type ScreenNativeEvent = {
  sessionId: string;
  json?: string;
  shape?: { width: number; height: number; hotX: number; hotY: number; rgba: string };
  closed?: boolean;
  error?: string | null;
};

type Events = {
  onApprovalRequest: (request: ApprovalRequest) => void;
  onApprovalClosed: (event: { id: number }) => void;
  onDeviceJoined: (joined: Joined) => void;
  onReceived: (received: Received) => void;
  onTransferProgress: (progress: TransferProgress) => void;
  onScreenEvent: (event: ScreenNativeEvent) => void;
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
  /**
   * Sends the file at `uri` to an upload capability of another member (e.g. `file.drop`
   * on the PC, with `{"name": "photo.jpg"}`). Progress arrives as `onTransferProgress`
   * events tagged `transferId`. Resolves with the target's answer (JSON).
   */
  sendFile(device: string, capability: string, inputJson: string, uri: string, transferId: string): Promise<string>;
  /** Gets a file from a download capability into `uri`, which appears only when complete. */
  fetchFile(device: string, capability: string, inputJson: string, uri: string, transferId: string): Promise<string>;
  /** Asks the other members what they are and offer; resolves with how many answered. */
  refreshMembers(): Promise<number>;
  memberCapabilities(id: string): Promise<OfferedCapability[]>;
  journal(limit: number, id: string | null): Promise<JournalEntry[]>;
  answerApproval(id: number, allow: boolean): boolean;
  /** Missing in builds before the screen; false while passer-core can't open streams for apps. */
  screenAvailable?(): boolean;
  /** Opens `screen.view` or `screen.control`; resolves once the other device accepted (up to 60 s). */
  screenOpen?(device: string, capability: string, inputJson: string, sessionId: string): Promise<void>;
  /** A viewer message of the Vasistas protocol, as JSON. */
  screenSend?(sessionId: string, json: string): void;
  screenClose?(sessionId: string): void;
}

const native = requireOptionalNativeModule<PasserCoreNative>('PasserCore');

export const PasserCore = {
  available: native != null,
  module: native,
};

/** The links an approver device shows as a QR code. */
/** Whether this build can show another device's screen. */
export function screenSupported(): boolean {
  try {
    return native?.screenAvailable?.() === true;
  } catch {
    return false;
  }
}

/** The native view drawing a screen session's video, letterboxed. Null where the build has none. */
export const ScreenView: ComponentType<ViewProps & { sessionId: string }> | null = (() => {
  if (Platform.OS !== 'ios' || !native?.screenAvailable) return null;
  try {
    return requireNativeView<ViewProps & { sessionId: string }>('PasserCore', 'PasserScreenView');
  } catch {
    return null;
  }
})();

export function isCoreInvitation(link: string): boolean {
  return link.startsWith('passer-core://join?');
}
