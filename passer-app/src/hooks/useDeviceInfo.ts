import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface DeviceInfo {
    name: string;
    /** mDNS address of this machine, e.g. "walson-laptop.local". */
    host: string;
    ip: string;
    port: number;
}

/**
 * Addresses for this PC, resolved at runtime.
 *
 * These used to be hardcoded as `passer.local` in three separate components.
 * Each machine now advertises its own mDNS name, so anything that shows or
 * copies an address has to ask the backend for it - otherwise the UI would
 * hand out a name that no longer resolves.
 */
export function useDeviceInfo(): DeviceInfo | null {
    const [info, setInfo] = useState<DeviceInfo | null>(null);

    useEffect(() => {
        let alive = true;
        invoke<DeviceInfo>("get_device_info")
            .then(d => { if (alive) setInfo(d); })
            .catch(e => console.error("Failed to load device info", e));
        return () => { alive = false; };
    }, []);

    return info;
}
