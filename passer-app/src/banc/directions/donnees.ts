/**
 * Fictional data for the big-window mockups. Fields marked `future` are not
 * provided by passer-core today (see "Device network" in docs/desktop/backend.md):
 * the mockups mark them with ✱ so nobody mistakes the picture for a promise.
 */

export type { Kind } from "../../components/DeviceRender";
import type { Kind } from "../../components/DeviceRender";

export interface Device {
    id: string;
    name: string;
    kind: Kind; // future: guessed from device.info
    os: string; // future: device.info, cached per member
    thisDevice?: boolean;
    approver: boolean;
    presence: "online" | "away" | "offline"; // future: per-member presence
    seen: string; // future
    battery?: number; // future, maybe out of scope
    screen: [string, string]; // render colours, like a product photo
}

export const DEVICES: Device[] = [
    { id: "b41e07b41e", name: "iPhone de Walson", kind: "phone", os: "iOS 26.1", approver: true, presence: "online", seen: "now", battery: 64, screen: ["#3b82f6", "#a855f7"] },
    { id: "7f3a9c7f3a", name: "WALSON-HP", kind: "laptop", os: "Windows 11", thisDevice: true, approver: true, presence: "online", seen: "now", screen: ["#0ea5e9", "#1e3a8a"] },
    { id: "e9d2c4e9d2", name: "MacBook Air", kind: "laptop", os: "macOS 16", approver: false, presence: "away", seen: "2 h ago", battery: 31, screen: ["#f97316", "#db2777"] },
    { id: "c0ffeec0ff", name: "PC du salon", kind: "desktop", os: "Windows 11", approver: false, presence: "offline", seen: "yesterday", screen: ["#10b981", "#0f766e"] },
];

export interface Agent {
    name: string;
    via: string;
    grants: string[];
}

export const AGENTS: Agent[] = [
    { name: "Claude", via: "iPhone de Walson", grants: ["Read the clipboard (asks)", "Send a file"] },
];

export type Item =
    | { kind: "image"; dir: "in" | "out"; name: string; size: string; at: string; hue: [string, string] }
    | { kind: "text"; dir: "in" | "out"; text: string; at: string }
    | { kind: "file"; dir: "in" | "out"; name: string; size: string; at: string }
    | { kind: "event"; text: string; detail: string; at: string; tone: "ok" | "ask" | "no" };

/** What passed between this PC and the iPhone today. */
export const THREAD: Item[] = [
    { kind: "text", dir: "out", text: "https://maps.app.goo.gl/2Kx8 — 14 rue des Lilas, 3e étage, code 4821B", at: "09:12" },
    { kind: "file", dir: "out", name: "Billet-train-Lyon.pdf", size: "212 KB", at: "09:13" },
    { kind: "event", text: "Claude read this PC's clipboard", detail: "Asked by Claude on iPhone de Walson · you allowed it once", at: "10:42", tone: "ask" },
    { kind: "image", dir: "in", name: "IMG_2041.HEIC", size: "2.4 MB", at: "11:05", hue: ["#fb923c", "#7c3aed"] },
    { kind: "image", dir: "in", name: "IMG_2042.HEIC", size: "2.1 MB", at: "11:05", hue: ["#22d3ee", "#1d4ed8"] },
    { kind: "text", dir: "in", text: "Pense à envoyer le devis à Martin avant 18 h", at: "11:31" },
    { kind: "event", text: "iPhone de Walson asked to read the clipboard", detail: "You refused · 11:48", at: "11:48", tone: "no" },
];

export interface Call {
    at: string;
    who: string;
    what: string;
    result: "done" | "allowed once" | "refused" | "expired";
}

/** The journal: what other devices did here (never the content). */
export const JOURNAL: Call[] = [
    { at: "11:48", who: "iPhone de Walson", what: "Read the clipboard", result: "refused" },
    { at: "11:05", who: "iPhone de Walson", what: "Send a file · 2 files", result: "done" },
    { at: "10:42", who: "Claude via iPhone", what: "Read the clipboard", result: "allowed once" },
    { at: "09:58", who: "MacBook Air", what: "Put text on the clipboard", result: "done" },
    { at: "Yesterday", who: "iPhone de Walson", what: "Read the clipboard", result: "expired" },
];

export type Rule = "allow" | "ask" | "never";

export interface Permission {
    title: string;
    detail: string;
    rule: Rule;
    sensitive?: boolean;
    soon?: boolean;
}

/** What iPhone de Walson may do on this PC (the policy, per device). */
export const PERMISSIONS: Permission[] = [
    { title: "Put text on the clipboard", detail: "Replaces what's copied on this PC", rule: "allow" },
    { title: "Send files", detail: "Saved in the Passboard folder", rule: "allow" },
    { title: "Read the clipboard", detail: "Sees what you copied on this PC", rule: "ask", sensitive: true },
    { title: "See the screen", detail: "With an indicator while it watches", rule: "never", sensitive: true, soon: true },
];
