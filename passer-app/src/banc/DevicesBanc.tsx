import { useEffect, useState } from "react";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { emit } from "@tauri-apps/api/event";
import { Layout } from "../components/Layout";
import { Sidebar } from "../components/Sidebar";
import { Devices } from "../components/Devices";
import { ApprovalPrompt } from "../components/ApprovalPrompt";

/**
 * Bench for the Devices tab and the approval card (`/devices-banc.html`).
 *
 * Every state is rendered by the *real* components over a fake backend that
 * speaks the same contract as `devices.rs`: the `devices_*` commands and the
 * `approval-request` / `approval-closed` / `device-joined` events. States that
 * need a user action (an open invitation, an armed Remove) are reached by
 * scripted clicks, so they are the states a person really lands in.
 */

import type { Member } from "../components/deviceUi";

interface Status {
    device_id: string;
    group: string | null;
    running: boolean;
    development_network: boolean;
    members: Member[];
}

interface Driver {
    click: (label: RegExp, nth?: number) => void;
    type: (placeholder: RegExp, value: string) => void;
    emit: (event: string, payload: unknown) => Promise<void>;
    wait: (ms: number) => Promise<void>;
}

export interface Scenario {
    id: string;
    label: string;
    status: Status | "loading" | "error";
    /** Commands that fail, with the backend's error string. */
    fail?: Record<string, string>;
    steps?: (ui: Driver) => Promise<void>;
}

const NOW = Math.floor(Date.now() / 1000);

const member = (name: string, seed: string, approver: boolean, thisDevice = false, seenAgo: number | null = 20): Member => {
    const id = (seed.repeat(8) + "0123456789abcdef").slice(0, 52);
    const phone = /iphone|phone/i.test(name);
    const mac = /mac/i.test(name);
    return {
        id, short_id: id.slice(0, 10), name, approver, this_device: thisDevice,
        kind: phone ? "phone" : mac ? "laptop" : /hp|tour/i.test(name) ? "laptop" : "desktop",
        os: phone ? "ios" : mac ? "macos" : "windows",
        os_version: phone ? "26.1" : mac ? "16.0" : "10.0.26300",
        app_version: "1.0.0",
        core_version: "0.1.0",
        answered_at: thisDevice || seenAgo === null ? null : NOW - seenAgo,
    };
};

const PC = member("WALSON-TOUR", "7f3a9c", true, true);
const PHONE = member("iPhone de Walson", "b41e07", true);
const LAPTOP = member("MacBook Air", "e9d2c4", false);

const group = (members: Member[], extra: Partial<Status> = {}): Status => ({
    device_id: PC.id,
    group: "My devices",
    running: true,
    development_network: true,
    members,
    ...extra,
});

const NO_GROUP: Status = { device_id: PC.id, group: null, running: false, development_network: true, members: [] };

const INVITE = "passer://join?v=1&g=My%20devices&t=Zm9vYmFyYmF6cXV4cXV1eHF1dXhxdXV4cXV1eHF1dXg&r=https%3A%2F%2Fuse1-1.relay.n0.iroh-canary.iroh.link&n=6f2b8e1d4c";

const APPROVAL = {
    id: 1,
    requester: "iPhone de Walson",
    requester_id: PHONE.short_id,
    agent: null as string | null,
    title: "Read the PC clipboard",
    capability: "clipboard.read",
    target: null as string | null,
    minutes: 5,
    expires_in_secs: 55,
};

/** What the stage's "last from it" line reads in the bench. */
const BENCH_HISTORY = [
    { id: "h1", type: "image" as const, direction: "incoming" as const, target: "folder" as const, name: "IMG_2041.HEIC", status: "success" as const, timestamp: Date.now() - 120_000, device: "iPhone de Walson", deviceId: PHONE.id },
    { id: "h2", type: "file" as const, direction: "outgoing" as const, target: "folder" as const, name: "rapport-final.pdf", status: "success" as const, timestamp: Date.now() - 600_000, device: "MacBook Air", deviceId: LAPTOP.id },
];

export const SCENARIOS: Scenario[] = [
    { id: "loading", label: "Loading", status: "loading" },
    { id: "error", label: "Status failed", status: "error" },
    { id: "first", label: "No group yet", status: NO_GROUP },
    {
        id: "create-fail", label: "Start failed", status: NO_GROUP,
        fail: { devices_create_group: "could not write the group log" },
        steps: async ui => {
            ui.click(/start with this pc/i);
        },
    },
    {
        id: "join-sas", label: "Joined with a link", status: NO_GROUP,
        steps: async ui => {
            ui.click(/have an invitation/i);
            await ui.wait(150);
            ui.type(/link|paste/i, INVITE);
            await ui.wait(50);
            ui.click(/^\s*join\s*$/i);
        },
    },
    {
        id: "join-fail", label: "Join failed", status: NO_GROUP,
        fail: { devices_join: "invitation expired or already used" },
        steps: async ui => {
            ui.click(/have an invitation/i);
            await ui.wait(150);
            ui.type(/link|paste/i, "passer://join?v=1&t=old");
            await ui.wait(50);
            ui.click(/^\s*join\s*$/i);
        },
    },
    { id: "alone", label: "Group of one", status: group([PC]) },
    { id: "group", label: "Group, online", status: group([PC, PHONE, LAPTOP]) },
    { id: "unreachable", label: "A device not seen yet", status: group([PC, PHONE, member("PC du salon", "5a10a5", false, false, null)]),
        steps: async ui => { ui.click(/pc du salon/i); } },
    { id: "send-file", label: "A PC selected", status: group([PC, PHONE, LAPTOP]),
        steps: async ui => { ui.click(/macbook air/i); } },
    { id: "offline", label: "Group, offline", status: group([PC, PHONE, LAPTOP], { running: false }) },
    { id: "member", label: "This PC not an approver", status: group([{ ...PC, approver: false }, PHONE, LAPTOP]) },
    {
        id: "invite-choose", label: "Add a device: choose", status: group([PC, PHONE]),
        steps: async ui => {
            ui.click(/add a device/i);
        },
    },
    {
        id: "invite", label: "Invitation (QR)", status: group([PC, PHONE]),
        steps: async ui => {
            ui.click(/add a device/i);
            await ui.wait(150);
            ui.click(/show the code/i);
        },
    },
    {
        id: "invite-approver", label: "Invitation as approver", status: group([PC, PHONE]),
        steps: async ui => {
            ui.click(/add a device/i);
            await ui.wait(150);
            ui.click(/also add/i);
            await ui.wait(50);
            ui.click(/show the code/i);
        },
    },
    {
        id: "joined", label: "A device joined", status: group([PC, PHONE, LAPTOP]),
        steps: async ui => {
            await ui.emit("device-joined", { name: "MacBook Air", id: LAPTOP.short_id, sas: "482913" });
        },
    },
    {
        id: "remove", label: "Remove, armed", status: group([PC, PHONE, LAPTOP]),
        steps: async ui => {
            ui.click(/macbook air/i);
            await ui.wait(150);
            ui.click(/details and removal/i);
            await ui.wait(250);
            ui.click(/remove from my devices/i);
        },
    },
    {
        id: "files-all", label: "A PC's files, all", status: group([PC, PHONE, LAPTOP]),
        steps: async ui => {
            ui.click(/macbook air/i);
            await ui.wait(600);
            ui.click(/see all/i);
            await ui.wait(200);
            ui.type(/search by name/i, "img");
        },
    },
    {
        id: "invite-fail", label: "Action failed", status: group([PC, PHONE]),
        fail: { devices_invite: "the device network is not running" },
        steps: async ui => {
            ui.click(/add a device/i);
            await ui.wait(150);
            ui.click(/show the code/i);
        },
    },
    {
        id: "long", label: "Long names", status: group([
            { ...PC, name: "WORKSTATION-STUDIO-PRINCIPAL-2025" },
            member("Le téléphone personnel de Walson avec un nom vraiment très long", "c0ffee", true),
            member("ipad", "a11ce5", false),
            member("Raspberry Pi salon", "deadbe", false),
            member("Surface Pro de la maison", "f00d42", false),
        ]),
    },
    {
        id: "approval", label: "Approval, from a device", status: group([PC, PHONE]),
        steps: async ui => {
            await ui.emit("approval-request", APPROVAL);
        },
    },
    {
        id: "approval-agent", label: "Approval, through an agent", status: group([PC, PHONE]),
        steps: async ui => {
            await ui.emit("approval-request", {
                ...APPROVAL, id: 2, agent: "Claude", target: "Documents/Notes de réunion.txt", minutes: 30,
            });
        },
    },
    {
        id: "approval-long", label: "Approval, long text + queue", status: group([PC, PHONE]),
        steps: async ui => {
            await ui.emit("approval-request", {
                ...APPROVAL, id: 3,
                requester: "Le téléphone personnel de Walson avec un nom vraiment très long",
                agent: "Un assistant au nom à rallonge qui ne tient pas sur une ligne",
                target: "C:\\Users\\Walson\\Documents\\Projets\\Passer\\un-fichier-au-nom-tres-long-pour-voir.txt",
                minutes: 120,
                expires_in_secs: 9,
            });
            await ui.emit("approval-request", { ...APPROVAL, id: 4 });
        },
    },
];

function installBackend(scenario: Scenario) {
    let state: Status | null = scenario.status === "loading" || scenario.status === "error"
        ? null
        : structuredClone(scenario.status);

    mockWindows("main");
    mockIPC((cmd, args) => {
        const a = (args ?? {}) as Record<string, unknown>;
        if (scenario.fail?.[cmd]) return Promise.reject(scenario.fail[cmd]);
        switch (cmd) {
            case "devices_status":
                if (scenario.status === "loading") return new Promise(() => { });
                if (scenario.status === "error") return Promise.reject("could not open the device key");
                return structuredClone(state);
            case "devices_create_group":
                state = group([PC]);
                return null;
            case "devices_join":
                state = group([{ ...PC, approver: false }, PHONE, LAPTOP]);
                return "482913";
            case "devices_invite":
                return INVITE;
            case "devices_remove":
                if (state) state.members = state.members.filter(m => m.id !== a.id);
                return null;
            case "devices_stop_sessions":
                return null;
            case "devices_answer_approval":
                return true;
            case "devices_refresh":
                return state?.members.length ?? 0;
            case "devices_capabilities": {
                const m = state?.members.find(x => x.id === a.id);
                if (!m || m.os === "ios" || m.answered_at === null) return [];
                return [
                    { name: "device.info", title: "Device info", description: "", effect: "read", needs_approval: false },
                    { name: "clipboard.write", title: "Put text on the PC clipboard", description: "", effect: "write", needs_approval: false },
                    { name: "clipboard.read", title: "Read the PC clipboard", description: "", effect: "sensitive", needs_approval: true },
                    { name: "file.receive", title: "Send a file to the PC", description: "", effect: "write", needs_approval: false },
                    { name: "file.drop", title: "Send a file to the PC", description: "", effect: "write", needs_approval: false },
                    { name: "file.list", title: "List the PC's shared files", description: "", effect: "read", needs_approval: false },
                    { name: "file.get", title: "Get a shared file", description: "", effect: "read", needs_approval: false },
                ];
            }
            case "devices_journal": {
                const peer = state?.members.find(x => !x.this_device) ?? PHONE;
                return [
                    { seq: 5, at: NOW - 300, outgoing: false, peer_id: peer.id, peer_short_id: peer.short_id, peer_name: peer.name, agent: null, capability: "clipboard.read", target: null, decision: "ask", approved: false, outcome: "denied" },
                    { seq: 4, at: NOW - 1800, outgoing: true, peer_id: peer.id, peer_short_id: peer.short_id, peer_name: peer.name, agent: null, capability: "file.receive", target: null, decision: "allow", approved: null, outcome: "ok" },
                    { seq: 3, at: NOW - 3600, outgoing: false, peer_id: peer.id, peer_short_id: peer.short_id, peer_name: peer.name, agent: "Claude", capability: "clipboard.read", target: null, decision: "ask", approved: true, outcome: "ok" },
                    { seq: 2, at: NOW - 7200, outgoing: false, peer_id: peer.id, peer_short_id: peer.short_id, peer_name: peer.name, agent: null, capability: "clipboard.write", target: null, decision: "allow", approved: null, outcome: "ok" },
                ];
            }
            case "devices_send_clipboard":
            case "devices_send_file":
                return null;
            case "devices_list_files":
                return [
                    { name: "Rapport annuel 2026.pdf", size: 4_820_113, modified: NOW - 3600 },
                    { name: "Photos vacances.zip", size: 812_400_000, modified: NOW - 86400 * 2 },
                    { name: "budget.xlsx", size: 48_200, modified: NOW - 86400 * 9 },
                    ...["IMG_2041.HEIC", "IMG_2042.HEIC", "IMG_2050.HEIC", "anniversaire-léa.mp4", "facture-edf-octobre.pdf", "notes-réunion.txt",
                        "plan-appartement.png", "sauvegarde-contacts.zip", "CV-2026.docx"].map((name, i) => ({ name, size: 120_000 * (i + 3), modified: NOW - 3600 * (i + 3) })),
                ];
            case "space_files":
                return [{ name: "plan-week-end.txt", size: 17, modified: NOW - 600 }];
            case "devices_get_clipboard":
                return 42;
            default:
                return null;
        }
    }, { shouldMockEvents: true });
}

function buttonsMatching(label: RegExp): HTMLElement[] {
    const all = Array.from(document.querySelectorAll<HTMLElement>("button, [role=switch], [role=checkbox], label"));
    return all.filter(el => label.test(el.getAttribute("aria-label") ?? "") || label.test(el.textContent ?? ""));
}

const driver: Driver = {
    click(label, nth = 0) {
        const el = buttonsMatching(label)[nth];
        if (el) el.click();
        else console.warn("bench: nothing to click for", label);
    },
    type(placeholder, value) {
        const input = Array.from(document.querySelectorAll<HTMLInputElement>("input, textarea"))
            .find(i => placeholder.test(i.placeholder) || placeholder.test(i.getAttribute("aria-label") ?? ""));
        if (!input) return console.warn("bench: no field for", placeholder);
        const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
    },
    emit: (event, payload) => emit(event, payload),
    wait: ms => new Promise(r => setTimeout(r, ms)),
};

/** One scenario, laid out exactly as App.tsx lays out the Devices tab. */
export function DevicesFrame({ scenario }: { scenario: Scenario }) {
    // Installed during the first render, before any child effect calls invoke.
    useState(() => installBackend(scenario));

    useEffect(() => {
        const t = setTimeout(() => scenario.steps?.(driver), 400);
        return () => clearTimeout(t);
    }, [scenario]);

    return (
        <div className="w-screen h-screen bg-[radial-gradient(ellipse_at_30%_20%,#26324a_0%,#10131a_60%,#07080b_100%)]">
            <Layout>
                <Sidebar view="devices" onChange={() => { }} />
                <div className="relative flex-1 min-w-0 min-h-0">
                    <div className="view-layer" data-active>
                        <Devices active history={BENCH_HISTORY} onOpenPassboard={() => { }} onStage={() => { }} />
                    </div>
                </div>
                <ApprovalPrompt />
            </Layout>
        </div>
    );
}

/** Every scenario side by side, each in a frame the size of the real window (1180x760). */
export function DevicesBanc() {
    const [nonce, setNonce] = useState(0);
    return (
        <div className="p-6 text-white">
            <div className="flex items-center gap-4 mb-5">
                <h1 className="text-sm font-black uppercase tracking-[0.2em]">Devices bench</h1>
                <button
                    onClick={() => setNonce(n => n + 1)}
                    className="px-3 py-1 rounded-lg border border-white/15 text-[11px] text-white/70 hover:text-white cursor-pointer"
                >
                    Replay all
                </button>
            </div>
            <div className="flex flex-wrap gap-6">
                {SCENARIOS.map(s => (
                    <figure key={s.id} className="flex flex-col gap-2">
                        <figcaption className="text-[11px] font-bold text-white/60">
                            {s.label} <a className="text-white/30 hover:text-white/70" href={`?s=${s.id}`}>({s.id})</a>
                        </figcaption>
                        <iframe
                            key={`${s.id}-${nonce}`}
                            title={s.label}
                            src={`?s=${s.id}`}
                            width={1180}
                            height={760}
                            className="border-0 rounded-[32px]"
                        />
                    </figure>
                ))}
            </div>
        </div>
    );
}
