import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileText, Image as ImageIcon, Video, Archive, File, ArrowDown, ArrowUp } from "lucide-react";

/** Same payload the history feed consumes - emitted by clipboard.rs and files.rs. */
interface TransferPayload {
    kind: 'text' | 'image' | 'file';
    direction: 'incoming' | 'outgoing';
    target: 'clipboard' | 'folder';
    name?: string | null;
    path?: string | null;
    size?: number | null;
}

/** What Rust hands back: the transfer, plus a number that changes per transfer. */
interface LastTransfer {
    seq: number;
    transfer: TransferPayload;
}

/** How often the HUD asks Rust whether something new arrived. */
const POLL_MS = 400;

/** How long a transfer stays on screen before the HUD retreats. */
const DISMISS_MS = 4000;
/** Must outlast the CSS exit transition below. */
const EXIT_MS = 220;

function formatBytes(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function iconFor(p: TransferPayload) {
    const ext = p.name?.split(".").pop()?.toLowerCase() ?? "";
    if (p.kind === "text") return FileText;
    if (p.kind === "image" || ["png", "jpg", "jpeg", "webp", "heic", "gif", "bmp"].includes(ext)) return ImageIcon;
    if (["mp4", "mov", "avi", "mkv"].includes(ext)) return Video;
    if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return Archive;
    return File;
}

/**
 * The corner HUD. Rendered into its own always-on-top window, so it only ever
 * shows what a transfer is doing while the main window is out of sight.
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

    const Icon = iconFor(item);
    const incoming = item.direction === "incoming";
    const label = item.kind === "text"
        ? (item.name?.trim() || "Clipboard text")
        : (item.name || "File");

    return (
        <div
            onClick={() => invoke("focus_main_window").catch(() => { })}
            /* m-6 leaves 24px inside the window for the shadow to fall off in.
               The previous 8px clipped it against the window edge, which read
               as a hard smear rather than a soft shadow - so the blur and
               offset below are sized to fit that 24px, not chosen by eye. */
            className={`hud-card fixed inset-0 m-6 flex items-center gap-3 px-4
                rounded-2xl bg-[#0d0d0d]/95 border border-white/10
                shadow-[0_6px_18px_rgba(0,0,0,0.55)] cursor-pointer select-none
                ${exiting ? "hud-card--out" : ""}`}
        >
            <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border
                ${incoming
                    ? "bg-blue-500/15 border-blue-400/25"
                    : "bg-emerald-500/15 border-emerald-400/25"}`}>
                <Icon className={`w-[18px] h-[18px] ${incoming ? "text-blue-400" : "text-emerald-400"}`} strokeWidth={2} />
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                    {incoming
                        ? <ArrowDown className="w-3 h-3 text-blue-400 shrink-0" strokeWidth={2.5} />
                        : <ArrowUp className="w-3 h-3 text-emerald-400 shrink-0" strokeWidth={2.5} />}
                    <span className="text-[8.5px] font-black uppercase tracking-[0.18em] text-white/45">
                        {incoming ? "Received" : "Sent"}
                    </span>
                </div>
                <p className="text-[11px] font-bold text-white/90 leading-tight mt-0.5 truncate">
                    {label}
                </p>
                <p className="text-[9px] text-white/35 leading-tight mt-px">
                    {item.size != null ? formatBytes(item.size) : (item.target === "clipboard" ? "To clipboard" : "To Passboard")}
                </p>
            </div>
        </div>
    );
}
