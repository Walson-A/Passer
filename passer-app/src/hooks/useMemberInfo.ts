import { useEffect, useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";

/** What a member says about itself (`device.info`, which every passer-core device answers). */
export interface MemberInfo {
    name: string;
    os: string;
    arch: string;
    version: string;
}

export type Probe =
    | { state: "loading" }
    | { state: "ok"; info: MemberInfo; at: number }
    | { state: "unreachable"; error: string; at: number };

/**
 * Asking a device for its info is also the only honest presence we have today:
 * passer-core gives no per-member presence yet, but a device that answers now is
 * reachable now. Answers are cached for a minute and shared by every component
 * that shows the same device (the strip, the stage, the details panel).
 */
const cache = new Map<string, Probe>();
const listeners = new Set<() => void>();
const FRESH_MS = 60_000;

function emit() {
    listeners.forEach(l => l());
}

export function probeMember(id: string, force = false) {
    const c = cache.get(id);
    if (c?.state === "loading") return;
    if (!force && c && Date.now() - c.at < FRESH_MS) return;
    cache.set(id, { state: "loading" });
    emit();
    invoke<MemberInfo>("devices_info", { id })
        .then(info => cache.set(id, { state: "ok", info, at: Date.now() }))
        .catch(e => cache.set(id, { state: "unreachable", error: String(e), at: Date.now() }))
        .finally(emit);
}

function subscribe(l: () => void) {
    listeners.add(l);
    return () => { listeners.delete(l); };
}

/** The member's probe, asked for when `enabled` (never for this PC itself). */
export function useMemberInfo(id: string | null, enabled: boolean): Probe | undefined {
    const probe = useSyncExternalStore(subscribe, () => (id ? cache.get(id) : undefined));
    useEffect(() => {
        if (id && enabled) probeMember(id);
    }, [id, enabled]);
    return probe;
}
