import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { HudCard, type TransferPayload } from "./HudCard";

/** What Rust hands back: the transfer, plus a number that changes per transfer. */
interface LastTransfer {
    seq: number;
    transfer: TransferPayload;
}

/** How often the HUD asks Rust whether something new arrived. */
const POLL_MS = 400;

/** How long a transfer stays on screen before the HUD retreats. */
const DISMISS_MS = 4000;

/** Must outlast the CSS exit animation. */
const EXIT_MS = 220;

/**
 * The corner HUD. Rendered into its own always-on-top window, so it only ever
 * shows what a transfer is doing while the main window is out of sight.
 *
 * Appearance lives in `HudCard`, which the bench (`/banc.html`) renders too.
 */
export function Hud() {
    const [item, setItem] = useState<TransferPayload | null>(null);
    const [exiting, setExiting] = useState(false);
    const dismissTimer = useRef<number | undefined>(undefined);
    const exitTimer = useRef<number | undefined>(undefined);

    useEffect(() => {
        const draw = (payload: TransferPayload) => {
            window.clearTimeout(dismissTimer.current);
            window.clearTimeout(exitTimer.current);

            // The newest transfer replaces whatever is showing and restarts the
            // clock; at this size a stack would read worse than simply
            // reporting the most recent thing.
            // Entry needs no flag: the keyframes run when the card is inserted.
            setExiting(false);
            setItem(payload);

            dismissTimer.current = window.setTimeout(() => {
                setExiting(true);
                exitTimer.current = window.setTimeout(() => {
                    invoke("hide_hud").catch(() => { });
                }, EXIT_MS);
            }, DISMISS_MS);
        };

        // Polled, not pushed. Events emitted from Rust never arrive in this
        // window - tried twice, immediately after `show()` and 250ms later, both
        // reporting success and neither received - while `invoke` in this
        // direction works. Asking is the only channel that actually carries.
        let lastSeq = 0;
        const poll = async () => {
            try {
                const latest = await invoke<LastTransfer | null>("get_last_transfer");
                if (latest && latest.seq !== lastSeq) {
                    lastSeq = latest.seq;
                    draw(latest.transfer);
                }
            } catch {
                /* window may be tearing down; the next tick will retry */
            }
        };

        poll();
        const pollTimer = window.setInterval(poll, POLL_MS);

        return () => {
            window.clearInterval(pollTimer);
            window.clearTimeout(dismissTimer.current);
            window.clearTimeout(exitTimer.current);
        };
    }, []);

    if (!item) return null;

    return (
        <HudCard
            payload={item}
            exiting={exiting}
            onClick={() => invoke("focus_main_window").catch(() => { })}
        />
    );
}
