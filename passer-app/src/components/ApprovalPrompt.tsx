import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ShieldQuestion } from "lucide-react";

interface Request {
    id: number;
    requester: string;
    requester_id: string;
    agent: string | null;
    title: string;
    capability: string;
    target: string | null;
    minutes: number;
    expires_in_secs: number;
}

/**
 * Another device asks this PC for something sensitive (reading the clipboard...).
 * One request at a time, on top of everything, with a countdown: no answer means no.
 * Every string here comes from another device, and is shown as plain text.
 */
export function ApprovalPrompt() {
    const [queue, setQueue] = useState<Request[]>([]);
    const [left, setLeft] = useState(0);
    const current = queue[0];

    useEffect(() => {
        const offs: (() => void)[] = [];
        (async () => {
            offs.push(await listen<Request>("approval-request", e => {
                setQueue(q => [...q, e.payload]);
            }));
            offs.push(await listen<number>("approval-closed", e => {
                setQueue(q => q.filter(r => r.id !== e.payload));
            }));
        })();
        return () => offs.forEach(off => off());
    }, []);

    useEffect(() => {
        if (!current) return;
        setLeft(current.expires_in_secs);
        const t = setInterval(() => setLeft(s => Math.max(0, s - 1)), 1000);
        return () => clearInterval(t);
    }, [current?.id]);

    if (!current) return null;

    const answer = async (allow: boolean) => {
        try {
            await invoke("devices_answer_approval", { id: current.id, allow });
        } finally {
            setQueue(q => q.filter(r => r.id !== current.id));
        }
    };

    const who = current.agent
        ? `${current.agent} (through ${current.requester})`
        : current.requester;

    return (
        <div className="absolute inset-0 z-[500] flex items-end justify-center bg-black/55 p-3" role="dialog" aria-modal>
            <div className="w-full p-4 rounded-3xl bg-[#1b1b1b] border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.6)] flex flex-col gap-3">
                <div className="flex items-center gap-3">
                    <div className="shrink-0 w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-400/25 flex items-center justify-center">
                        <ShieldQuestion className="w-4.5 h-4.5 text-amber-300" strokeWidth={2} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[12px] font-bold text-white/95 leading-tight break-words">{who}</p>
                        <p className="text-[9px] font-mono text-white/35 leading-tight mt-0.5">{current.requester_id}</p>
                    </div>
                </div>
                <p className="text-[11px] text-white/80 leading-relaxed break-words">
                    wants to <span className="font-bold text-white">{current.title}</span>
                    {current.target ? <> on <span className="font-mono">{current.target}</span></> : null}
                    , for up to {current.minutes} min.
                </p>
                <div className="flex gap-2">
                    <button
                        onClick={() => answer(false)}
                        className="flex-1 py-2.5 rounded-xl border bg-white/[0.04] border-white/10 text-white/70 hover:text-white text-[10px] font-black uppercase tracking-widest active:scale-[0.98] cursor-pointer"
                    >
                        Deny
                    </button>
                    <button
                        onClick={() => answer(true)}
                        className="flex-1 py-2.5 rounded-xl border bg-blue-500/20 border-blue-400/40 text-blue-100 hover:bg-blue-500/30 text-[10px] font-black uppercase tracking-widest active:scale-[0.98] cursor-pointer"
                    >
                        Allow
                    </button>
                </div>
                <p className="text-[8px] text-white/30 text-center">Refused automatically in {left} s</p>
            </div>
        </div>
    );
}
