/**
 * Bench version of the device network: a fake group with a PC, so the Devices screen
 * can be seen in a browser. Nothing here talks to a real device.
 */
import type { ApprovalRequest, Joined, Member, Status } from './index';

export type { ApprovalRequest, Joined, Member, Status } from './index';

type Listener = (payload: never) => void;
const listeners = new Map<string, Set<Listener>>();

let joined = false;
const pc: Member = { id: 'pc'.padEnd(64, '0'), shortId: '9cfff8cf59', name: 'WALSON-HP', approver: true, thisDevice: false };
const me: Member = { id: 'me'.padEnd(64, '1'), shortId: '25eca2f067', name: 'iPhone', approver: false, thisDevice: true };

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
