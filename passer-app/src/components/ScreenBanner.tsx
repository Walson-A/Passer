import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Eye, Loader2, MousePointer2, OctagonX } from "lucide-react";
import { FOCUS } from "./deviceUi";

/** Payload of `screen-session-started` / `-ended`, and of `devices_screen_sessions`. */
export interface ScreenSession {
    id: number;
    device: string;
    device_id: string;
    control: boolean;
    /** Unix seconds. */
    started_at: number;
}

/**
 * Who sees or controls this PC's screen right now, above everything in the window,
 * with the way out. Vasistas also shows its own sign on the screen and stops on
 * Escape; this says it inside Passer, names the device, and stops it from here
 * (every session another device has open, as the sidebar's stop does).
 */
export function ScreenBanner() {
    const [sessions, setSessions] = useState<ScreenSession[]>([]);
    const [stopping, setStopping] = useState(false);
    const [, tick] = useState(0);

    useEffect(() => {
        invoke<ScreenSession[]>("devices_screen_sessions").then(setSessions).catch(() => { });
        const offs: (() => void)[] = [];
        let alive = true;
        (async () => {
            const a = await listen<ScreenSession>("screen-session-started", e =>
                setSessions(s => [...s.filter(x => x.id !== e.payload.id), e.payload]));
            const b = await listen<ScreenSession>("screen-session-ended", e =>
                setSessions(s => s.filter(x => x.id !== e.payload.id)));
            if (alive) offs.push(a, b); else { a(); b(); }
        })();
        return () => { alive = false; offs.forEach(off => off()); };
    }, []);

    // The duration counts up while someone is there.
    useEffect(() => {
        if (sessions.length === 0) return;
        const t = setInterval(() => tick(n => n + 1), 15_000);
        return () => clearInterval(t);
    }, [sessions.length]);

    if (sessions.length === 0) return null;

    const control = sessions.find(s => s.control);
    const lead = control ?? sessions[0];
    const minutes = Math.max(0, Math.floor((Date.now() / 1000 - lead.started_at) / 60));
    const others = sessions.length - 1;

    const stop = async () => {
        setStopping(true);
        try {
            await invoke("devices_stop_sessions");
        } finally {
            setStopping(false);
        }
    };

    return (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[480] max-w-[calc(100%-48px)]" role="alert">
            <div className={`sheet-in flex items-center gap-3 pl-3.5 pr-2 py-2 rounded-2xl border shadow-[0_12px_40px_rgba(0,0,0,0.5)]
                ${control ? "bg-[#2a1414] border-red-400/40" : "bg-[#2a2210] border-amber-400/40"}`}>
                <span className={`relative w-7 h-7 shrink-0 rounded-full flex items-center justify-center ${control ? "bg-red-500/20 text-red-200" : "bg-amber-500/20 text-amber-200"}`}>
                    {control ? <MousePointer2 className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden /> : <Eye className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden />}
                    <span className={`absolute inset-0 rounded-full animate-ping opacity-30 ${control ? "bg-red-400" : "bg-amber-400"} motion-reduce:hidden`} aria-hidden />
                </span>
                <p className="min-w-0 text-[13px] text-white/90 leading-snug">
                    <span className="font-bold break-words">{lead.device}</span>{" "}
                    {control ? "is controlling this PC" : "sees this PC's screen"}
                    <span className="text-white/55"> · {minutes < 1 ? "just now" : `${minutes} min`}{others > 0 ? ` · +${others}` : ""}</span>
                </p>
                <button
                    onClick={stop}
                    disabled={stopping}
                    className={`shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-xl border border-red-400/40 bg-red-500/20 text-[12px] font-semibold text-red-50 hover:bg-red-500/30 transition-all cursor-pointer disabled:opacity-50 ${FOCUS}`}
                >
                    {stopping ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <OctagonX className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden />}
                    Stop
                </button>
            </div>
        </div>
    );
}
