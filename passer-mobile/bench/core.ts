import { base64Size } from '@/core/device-calls';
import type { BenchLogKind } from '@/platform/web-bench';

import type { ApprovalRequest, Joined, JournalEntry, Member, OfferedCapability, Received, Status } from '../modules/passer-core';
import { GROUP, type PcClipboard } from './fixtures';
import type { RegimeName } from './state';

/**
 * The device network the bench's phone belongs to: passer-core's surface, answering as the
 * desktop's `passer-app/src-tauri/src/devices.rs` does (capability names, limits, refusals),
 * with the regime deciding who answers. Errors carry the core's codes in their text, as the
 * native bridge does, so the app's classification is exercised for real.
 */

/** `MAX_FILE_BYTES` in devices.rs. */
const MAX_FILE_BYTES = 700 * 1024;

type Listener = (payload: never) => void;

export type BenchCoreEvent = 'approval' | 'approval-agent' | 'received-text' | 'received-file' | 'joined';

export function createFakeCore({
  regime,
  pcClipboard,
  log,
  sizes,
}: {
  regime: RegimeName;
  pcClipboard: () => Promise<PcClipboard>;
  log: (kind: BenchLogKind, message: string) => void;
  /** The size of each fixture the pickers hand over, by URI. */
  sizes: Map<string, number>;
}) {
  const listeners = new Map<string, Set<Listener>>();
  const emit = (event: string, payload: unknown) =>
    listeners.get(event)?.forEach((listener) => (listener as (value: unknown) => void)(payload));

  const now = () => Math.round(Date.now() / 1000);
  const me: Member = {
    id: GROUP.phone.id,
    shortId: GROUP.phone.id.slice(0, 10),
    name: GROUP.phone.name,
    approver: regime === 'manager',
    thisDevice: true,
    kind: 'phone',
    os: 'ios',
    osVersion: '18.2',
    appVersion: '1.1.0',
    coreVersion: '0.3.0',
    answeredAt: null,
  };
  const pc: Member = {
    id: GROUP.pc.id,
    shortId: GROUP.pc.id.slice(0, 10),
    name: GROUP.pc.name,
    approver: true,
    thisDevice: false,
    kind: 'desktop',
    os: 'windows',
    osVersion: '10.0.26100',
    appVersion: '1.0.0',
    coreVersion: '0.3.0',
    answeredAt: regime === 'asleep' ? now() - 2 * 3600 : now() - 20,
  };
  const ipad: Member = {
    id: GROUP.ipad.id,
    shortId: GROUP.ipad.id.slice(0, 10),
    name: GROUP.ipad.name,
    approver: false,
    thisDevice: false,
    kind: 'tablet',
    os: 'ios',
    osVersion: '18.1',
    appVersion: '1.1.0',
    coreVersion: '0.2.0',
    answeredAt: now() - 2 * 3600 - 600,
  };

  /** What each member lets this phone ask for, as `memberCapabilities` reports it (the desktop's `devices.rs` on `dev`). */
  const offers = (member: Member): OfferedCapability[] => {
    if (member.id === pc.id) {
      const list: OfferedCapability[] = [
        { name: 'clipboard.read', title: 'Read the PC clipboard', description: 'Returns the text copied on this PC.', effect: 'sensitive', needsApproval: true },
        { name: 'clipboard.write', title: 'Put text on the PC clipboard', description: "Replaces the text on this PC's clipboard.", effect: 'write', needsApproval: false },
        { name: 'device.info', title: 'Device info', description: 'Name, kind, system and versions.', effect: 'read', needsApproval: false },
        { name: 'file.receive', title: 'Send a file to the PC', description: 'Saves a small file (under 700 KB) into the Passboard folder.', effect: 'write', needsApproval: false },
      ];
      // A PC on an older desktop has no streams: the app falls back to one call per file.
      if (regime !== 'old-pc') {
        list.push({ name: 'file.drop', title: 'Drop a file on the PC', description: 'Receives a file of any size, as a stream, into the Passboard folder.', effect: 'write', needsApproval: false });
      }
      return list;
    }
    if (member.id === ipad.id) {
      return [
        { name: 'clipboard.write', title: 'Put text on the phone clipboard', description: "Replaces the text on this phone's clipboard.", effect: 'write', needsApproval: false },
        { name: 'file.receive', title: 'Send a file to the phone', description: 'Saves a small file (under 700 KB) in Passer on this phone.', effect: 'write', needsApproval: false },
      ];
    }
    return [];
  };

  const journal: JournalEntry[] = [
    { seq: 4, at: now() - 120, outgoing: true, peerId: pc.id, peerShortId: pc.shortId, peerName: pc.name, agent: null, capability: 'clipboard.read', target: null, decision: 'ask', approved: true, outcome: 'ok' },
    { seq: 3, at: now() - 540, outgoing: false, peerId: pc.id, peerShortId: pc.shortId, peerName: pc.name, agent: 'Claude', capability: 'clipboard.write', target: null, decision: 'allow', approved: null, outcome: 'ok' },
    { seq: 2, at: now() - 2_400, outgoing: true, peerId: pc.id, peerShortId: pc.shortId, peerName: pc.name, agent: null, capability: 'file.drop', target: null, decision: 'allow', approved: null, outcome: 'ok' },
    { seq: 1, at: now() - 7_400, outgoing: true, peerId: ipad.id, peerShortId: ipad.shortId, peerName: ipad.name, agent: null, capability: 'clipboard.write', target: null, decision: 'allow', approved: null, outcome: 'unreachable' },
  ];

  let group: string | null = regime === 'first-launch' ? null : GROUP.name;
  let members: Member[] = regime === 'first-launch' ? [] : regime === 'alone' ? [me] : [pc, ipad, me];
  let running = group !== null;
  const slow = regime === 'slow';

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, slow ? ms * 3 : ms));
  const status = (): Status => ({ deviceId: me.id, group, running, members: [...members] });

  const find = (query: string) => {
    const member = members.find((m) => m.id === query || m.name.toLowerCase() === query.toLowerCase());
    if (!member) throw new Error(`invalid: no member named "${query}"`);
    return member;
  };

  /** Whether a member answers: the iPad is never open; the PC sleeps in the asleep regime. */
  const answers = (member: Member) => member.id === pc.id && regime !== 'asleep';

  const core = {
    open: async () => {
      await wait(450);
      if (regime === 'broken') throw new Error('storage error: the device key could not be read from the Keychain');
      return status();
    },
    status: async () => status(),
    createGroup: async (groupName: string) => {
      await wait(500);
      group = groupName;
      members = [me];
      running = true;
      log('pc', `Groupe « ${groupName} » créé sur ce téléphone`);
    },
    join: async () => {
      await wait(1_400);
      group = GROUP.name;
      members = [pc, ipad, me];
      running = true;
      log('pc', `Rejoint « ${GROUP.name} » ; code ${GROUP.sas}`);
      return { groupName: GROUP.name, sas: GROUP.sas };
    },
    start: async () => {
      running = true;
    },
    stop: async () => {
      running = false;
      log('pc', 'Nœud arrêté');
    },
    invite: async (minutes: number, asApprover: boolean) => {
      await wait(300);
      log('pc', `Invitation créée (${minutes} min, ${asApprover ? 'gère les appareils' : 'envoie et reçoit'})`);
      return GROUP.invitation;
    },
    call: async (device: string, capability: string, inputJson: string) => {
      const member = find(device);
      const input = JSON.parse(inputJson || '{}') as Record<string, unknown>;
      if (!answers(member)) {
        await wait(2_000);
        throw new Error('network error: connection timed out');
      }
      await wait(250);
      switch (capability) {
        case 'device.info':
          return JSON.stringify(GROUP.pcInfo);
        case 'clipboard.write': {
          const text = String(input.text ?? '');
          log('pc', `Presse-papiers du PC : « ${text.slice(0, 80)} »`);
          return JSON.stringify({ ok: true });
        }
        case 'file.receive': {
          const size = base64Size(String(input.data_base64 ?? ''));
          await wait(Math.min(2_000, size / 300));
          if (size > MAX_FILE_BYTES) throw new Error('module_error: file too large for this version (700 KB maximum)');
          log('pc', `Passboard du PC : ${String(input.name)} (${Math.round(size / 1024)} Ko)`);
          return JSON.stringify({ saved: true, size });
        }
        case 'clipboard.read': {
          // Sensitive: the PC's user is asked first, and answers after a few seconds.
          log('pc', 'Le PC demande à son utilisateur d’autoriser la lecture');
          await wait(2_600);
          if (regime === 'refuses') {
            log('pc', 'Refusé sur le PC');
            throw new Error('denied: the user refused this request');
          }
          const content = await pcClipboard();
          log('pc', 'Autorisé une fois sur le PC');
          // devices.rs reads text only; anything else reads as empty.
          return JSON.stringify({ text: content.kind === 'text' ? content.text : '' });
        }
        default:
          throw new Error(`unknown_capability: no such capability on this device`);
      }
    },
    sendFile: async (device: string, capability: string, inputJson: string, uri: string, transferId: string) => {
      const member = find(device);
      if (!answers(member)) {
        await wait(2_000);
        throw new Error('network error: connection timed out');
      }
      if (!offers(member).some((offer) => offer.name === capability)) throw new Error('unknown_capability: no such capability on this device');
      const name = String((JSON.parse(inputJson) as { name?: string }).name ?? 'file');
      // The bench's picks carry their size in the fixtures or the URI (`media.web.ts`).
      const marked = /#bench-size=(\d+)$/.exec(uri);
      const total = marked ? Number(marked[1]) : (sizes.get(uri) ?? 1_000_000);
      const steps = 8;
      for (let step = 1; step <= steps; step += 1) {
        await wait(220);
        emit('onTransferProgress', { id: transferId, done: Math.round((total * step) / steps), total });
      }
      log('pc', `Passboard du PC (flux) : ${name} (${Math.round(total / 1024)} Ko)`);
      return JSON.stringify({ saved: true, size: total, name });
    },
    fetchFile: async () => {
      throw new Error('unknown_capability: no such capability on this device');
    },
    refreshMembers: async () => {
      await wait(300);
      if (regime !== 'asleep') pc.answeredAt = now();
      return regime === 'asleep' ? 0 : 1;
    },
    memberCapabilities: async (id: string) => offers(find(id)),
    journal: async (limit: number, id: string | null) => journal.filter((entry) => id === null || entry.peerId === id).slice(0, limit),
    removeDevice: async (id: string) => {
      await wait(400);
      const member = find(id);
      members = members.filter((m) => m.id !== member.id);
      log('pc', `${member.name} retiré du groupe`);
    },
    stopAllSessions: async () => {
      await wait(200);
      log('pc', 'Activité à distance arrêtée');
    },
    answerApproval: (id: number, allow: boolean) => {
      log('pc', `Demande ${id} : ${allow ? 'autorisée une fois' : 'refusée'}`);
      return true;
    },
    addListener(event: string, listener: Listener) {
      const set = listeners.get(event) ?? new Set();
      set.add(listener);
      listeners.set(event, set);
      return { remove: () => set.delete(listener) };
    },
  };

  let nextRequest = 1;

  /** What another device does: ask for approval, send something, join through an invitation. */
  const trigger = (event: BenchCoreEvent) => {
    if (event === 'approval' || event === 'approval-agent') {
      const request: ApprovalRequest = {
        id: nextRequest++,
        requester: event === 'approval' ? ipad.name : pc.name,
        requesterId: (event === 'approval' ? ipad.id : pc.id).slice(0, 10),
        agent: event === 'approval-agent' ? 'Claude' : null,
        title: 'Read the PC clipboard',
        capability: 'clipboard.read',
        target: null,
        minutes: 10,
        expiresInSecs: 55,
      };
      emit('onApprovalRequest', request);
      setTimeout(() => emit('onApprovalClosed', { id: request.id }), 55_000);
    } else if (event === 'received-text') {
      const received: Received = {
        kind: 'text',
        text: 'Réunion déplacée à 15 h 30, salle Pasteur. Pense à prendre le devis signé.',
        from: pc.name,
        fromId: pc.id.slice(0, 10),
        agent: null,
      };
      emit('onReceived', received);
    } else if (event === 'received-file') {
      const received: Received = {
        kind: 'file',
        name: 'Plan d’accès salle Pasteur.pdf',
        uri: 'file:///bench/Documents/Passer/Plan%20d%E2%80%99acc%C3%A8s%20salle%20Pasteur.pdf',
        size: 412_880,
        from: pc.name,
        fromId: pc.id.slice(0, 10),
        agent: null,
      };
      emit('onReceived', received);
    } else {
      const joined: Joined = { name: 'Pixel de Camille', id: 'c4d3e2f1a0', sas: '318 529'.replace(' ', '') };
      members = [
        ...members,
        {
          id: `${joined.id}${'0'.repeat(54)}`,
          shortId: joined.id,
          name: joined.name,
          approver: false,
          thisDevice: false,
          kind: 'phone',
          os: 'android',
          osVersion: '15',
          appVersion: '1.1.0',
          coreVersion: '0.3.0',
          answeredAt: now(),
        },
      ];
      emit('onDeviceJoined', joined);
    }
  };

  return { core, trigger };
}

export type FakeCore = ReturnType<typeof createFakeCore>;
