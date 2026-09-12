import type { CSSProperties } from "react";
import { FileText, Image as ImageIcon, Video, Archive, File, ArrowDown, ArrowUp } from "lucide-react";

/** Same payload the backend emits - see `TransferEvent` in types.rs. */
export interface TransferPayload {
    kind: 'text' | 'image' | 'file';
    direction: 'incoming' | 'outgoing';
    target: 'clipboard' | 'folder';
    name?: string | null;
    path?: string | null;
    size?: number | null;
}

export function formatBytes(bytes: number) {
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

interface Props {
    payload: TransferPayload;
    exiting?: boolean;
    onClick?: () => void;
    /** Lets the bench override animation or shadow to compare variants. */
    style?: CSSProperties;
}

/**
 * The HUD's appearance, with no behaviour attached.
 *
 * Split out so the bench (`/banc.html`) renders the *real* card rather than a
 * copy of it - a bench showing a lookalike stops being evidence the moment the
 * two drift apart.
 */
export function HudCard({ payload, exiting, onClick, style }: Props) {
    const Icon = iconFor(payload);
    const incoming = payload.direction === "incoming";
    // A pushed image carries no name - push_image sends `name: None` - so
    // without this every received image was labelled "File".
    const label = payload.kind === "text"
        ? (payload.name?.trim() || "Clipboard text")
        : (payload.name || (payload.kind === "image" ? "Image" : "File"));

    return (
        <div
            onClick={onClick}
            style={style}
            /* `absolute`, not `fixed`: in the HUD window #root spans the whole
               window so the two are equivalent, but `fixed` would escape the
               bench's frames and anchor to the page instead.
               m-6 leaves 24px inside the window for the shadow to fall off in;
               at the previous 8px it was clipped by the window edge and read as
               a hard smear, so the blur and offset below are sized to that 24px. */
            className={`hud-card absolute inset-0 m-8 flex items-center gap-3 px-4
                rounded-2xl bg-[#0d0d0d]/95 border border-white/10
                shadow-[0_8px_22px_rgba(0,0,0,0.45)] cursor-pointer select-none
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
                    {payload.size != null
                        ? formatBytes(payload.size)
                        : (payload.target === "clipboard" ? "To clipboard" : "To Passboard")}
                </p>
            </div>
        </div>
    );
}
