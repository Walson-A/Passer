import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Capability } from "../components/deviceUi";

type State = { id: string; caps: Capability[] | null; error?: string };

/**
 * What a member lets this PC call, as it last said (`devices_capabilities`,
 * read locally - no network). Asked again whenever that member answers anew,
 * which `answeredAt` tracks.
 */
export function useCapabilities(id: string | null, answeredAt: number | null) {
    const [state, setState] = useState<State | null>(null);
    useEffect(() => {
        if (!id) return;
        let alive = true;
        invoke<Capability[]>("devices_capabilities", { id })
            .then(caps => { if (alive) setState({ id, caps }); })
            .catch(e => { if (alive) setState({ id, caps: null, error: String(e) }); });
        return () => { alive = false; };
    }, [id, answeredAt]);
    return state?.id === id ? state : undefined;
}
