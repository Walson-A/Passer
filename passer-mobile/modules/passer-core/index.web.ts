/**
 * Bench version of the device network: a fake group with a PC, so the Devices screen
 * can be seen in a browser. Nothing here talks to a real device.
 */
import type { ApprovalRequest, JournalEntry, Joined, Member, OfferedCapability, Status } from './index';

export type { ApprovalRequest, DeviceKind, JournalEntry, Joined, Member, OfferedCapability, Status } from './index';

type Listener = (payload: never) => void;
const listeners = new Map<string, Set<Listener>>();

let joined = false;
const minutesAgo = (m: number) => Math.round(Date.now() / 1000) - m * 60;

const pc: Member = {
  id: 'pc'.padEnd(64, '0'),
  shortId: '9cfff8cf59',
  name: 'WALSON-HP',
  approver: true,
  thisDevice: false,
  kind: 'laptop',
  os: 'windows',
  osVersion: '10.0.26100',
  appVersion: '1.0.0',
  coreVersion: '0.1.0',
  answeredAt: minutesAgo(3),
};
const me: Member = {
  id: 'me'.padEnd(64, '1'),
  shortId: '25eca2f067',
  name: 'iPhone',
  approver: false,
  thisDevice: true,
  kind: 'phone',
  os: 'ios',
  osVersion: '18.2',
  appVersion: '1.1.0',
  coreVersion: '0.1.0',
  answeredAt: null,
};

const pcOffers: OfferedCapability[] = [
  { name: 'clipboard.read', title: 'Read the PC clipboard', description: 'Returns the text on the PC clipboard.', effect: 'sensitive', needsApproval: true },
  { name: 'clipboard.write', title: 'Put text on the PC clipboard', description: 'Replaces the text on the PC clipboard.', effect: 'write', needsApproval: false },
  { name: 'device.info', title: 'Device info', description: 'Name, kind, system and versions.', effect: 'read', needsApproval: false },
  { name: 'file.receive', title: 'Send a file to the PC', description: 'Saves a small file in the Passboard folder.', effect: 'write', needsApproval: false },
];

const journal: JournalEntry[] = [
  { seq: 4, at: minutesAgo(2), outgoing: true, peerId: pc.id, peerShortId: pc.shortId, peerName: pc.name, agent: null, capability: 'clipboard.read', target: null, decision: 'none', approved: null, outcome: 'ok' },
  { seq: 3, at: minutesAgo(9), outgoing: false, peerId: pc.id, peerShortId: pc.shortId, peerName: pc.name, agent: 'claude', capability: 'device.info', target: null, decision: 'allow', approved: null, outcome: 'ok' },
  { seq: 2, at: minutesAgo(40), outgoing: true, peerId: pc.id, peerShortId: pc.shortId, peerName: pc.name, agent: null, capability: 'file.receive', target: null, decision: 'none', approved: null, outcome: 'ok' },
];

const status = (): Status => ({
  deviceId: me.id,
  group: joined ? 'My devices' : null,
  running: joined,
  members: joined ? [pc, me] : [],
});

const fake = {
  open: async () => status(),
  status: async () => status(),
  createGroup: async () => {
    joined = true;
  },
  join: async () => {
    joined = true;
    return { groupName: 'My devices', sas: '972066' };
  },
  start: async () => {},
  stop: async () => {},
  invite: async () => 'passer-core://join?v=1&bench=1',
  call: async (_device: string, capability: string, inputJson: string) => {
    if (capability === 'clipboard.read') return JSON.stringify({ text: 'Copied on the PC' });
    if (capability === 'device.info') return JSON.stringify({ name: 'WALSON-HP', os: 'windows', arch: 'x86_64', version: '0.1.0' });
    return JSON.stringify({ ok: true, echo: inputJson.length });
  },
  removeDevice: async () => {},
  stopAllSessions: async () => {},
  sendFile: async (_device: string, _capability: string, inputJson: string, _uri: string, transferId: string) => {
    const total = 3_000_000;
    for (const done of [1_000_000, 2_000_000, total]) {
      await new Promise((r) => setTimeout(r, 150));
      listeners.get('onTransferProgress')?.forEach((l) => (l as (p: { id: string; done: number; total: number }) => void)({ id: transferId, done, total }));
    }
    return JSON.stringify({ saved: true, size: total, name: JSON.parse(inputJson).name });
  },
  fetchFile: async () => JSON.stringify({ bytes: 1_000_000 }),
  refreshMembers: async () => (joined ? 1 : 0),
  memberCapabilities: async (id: string) => (joined && id === pc.id ? pcOffers : []),
  journal: async (limit: number, id: string | null) =>
    (joined ? journal : []).filter((e) => id == null || e.peerId === id).slice(0, limit),
  answerApproval: () => true,
  addListener(event: string, listener: Listener) {
    const set = listeners.get(event) ?? new Set();
    set.add(listener);
    listeners.set(event, set);
    return { remove: () => set.delete(listener) };
  },
};

export const PasserCore = { available: true, module: fake };

export function isCoreInvitation(link: string): boolean {
  return link.startsWith('passer-core://join?');
}

/** Bench only: simulate another device asking for something. */
export function benchApproval(request: ApprovalRequest) {
  listeners.get('onApprovalRequest')?.forEach((l) => (l as (r: ApprovalRequest) => void)(request));
}

export function benchJoined(j: Joined) {
  listeners.get('onDeviceJoined')?.forEach((l) => (l as (r: Joined) => void)(j));
}

// From the browser console (detail is a JSON string, so it also crosses into the page from
// a devtools or extension context):
//   dispatchEvent(new CustomEvent('passer-core-bench', { detail: JSON.stringify({ approval: {...} }) }))
//   dispatchEvent(new CustomEvent('passer-core-bench', { detail: JSON.stringify({ joined: {...} }) }))
if (typeof window !== 'undefined') {
  window.addEventListener('passer-core-bench', (event) => {
    const detail = (event as CustomEvent<string>).detail;
    const { approval, joined } = JSON.parse(detail) as { approval?: ApprovalRequest; joined?: Joined };
    if (approval) benchApproval(approval);
    if (joined) benchJoined(joined);
  });
}
