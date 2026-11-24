import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Bot, Clock, FileText, ShieldQuestion } from "lucide-react";
import { DeviceGlyph, FOCUS } from "./deviceUi";

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

/** A request as queued here: with the moment it arrived, which its deadline counts from. */
interface Queued extends Request {
    deadline: number;
}

/**
 * Another device asks this PC for something sensitive (reading the clipboard...).
 * One request at a time, on top of everything, with a countdown: no answer means no.
 *
 * Every string here comes from another device and is shown as plain text - never
 * as markup, never as a link. The layout answers four questions in reading order:
 * who asks, what they want, on what and for how long, and how long you have.
 */
export function ApprovalPrompt() {
    const [queue, setQueue] = useState<Queued[]>([]);
    const [left, setLeft] = useState(0);
    const [answering, setAnswering] = useState(false);
    const denyRef = useRef<HTMLButtonElement>(null);
    const current = queue[0];

    useEffect(() => {
        const offs: (() => void)[] = [];
        let alive = true;
        (async () => {
            const a = await listen<Request>("approval-request", e => {
                // The backend times every request from the moment it asks, even
                // one that waits here behind another, so the countdown must too.
                const deadline = Date.now() + e.payload.expires_in_secs * 1000;
                setQueue(q => [...q, { ...e.payload, deadline }]);
            });
            const b = await listen<number>("approval-closed", e => {
                setQueue(q => q.filter(r => r.id !== e.payload));
            });
            if (alive) offs.push(a, b); else { a(); b(); }
        })();
        return () => { alive = false; offs.forEach(off => off()); };
    }, []);

    useEffect(() => {
        if (!current) return;
        const deadline = current.deadline;
        const tick = () => setLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
        tick();
        setAnswering(false);
        // The safe answer has the focus, so a stray Enter can never grant access.
        requestAnimationFrame(() => denyRef.current?.focus({ preventScroll: true }));
        const t = setInterval(tick, 250);
        return () => clearInterval(t);
    }, [current?.id]);

    const answer = async (allow: boolean) => {
        if (!current || answering) return;
        setAnswering(true);
        const id = current.id;
        try {
            await invoke("devices_answer_approval", { id, allow });
        } finally {
            setQueue(q => q.filter(r => r.id !== id));
        }
    };

    // Escape is "no", the same as letting the clock run out.
    useEffect(() => {
        if (!current) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                answer(false);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });

    if (!current) return null;

    const waiting = queue.length - 1;
    const headingId = `approval-${current.id}`;

    return (
        <div className="absolute inset-0 z-[500] flex flex-col justify-end">
            <div className="scrim-in absolute inset-0 bg-black/65" aria-hidden />

            <div
                key={current.id}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby={headingId}
                aria-describedby={`${headingId}-what`}
                className="sheet-in relative m-3 p-4 rounded-[26px] bg-[#191919] border border-white/10 shadow-[0_-8px_40px_rgba(0,0,0,0.55)] flex flex-col gap-3.5"
            >
                {/* What this is, and how long it stays */}
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 text-amber-200/90">
                        <ShieldQuestion className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden />
                        <span className="text-[10px] font-black uppercase tracking-[0.18em]">Permission request</span>
                    </div>
                    <Countdown left={left} total={current.expires_in_secs} />
                </div>

                {/* Who */}
                <div className="flex items-center gap-3">
                    <div className="shrink-0 w-10 h-10 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center">
                        {current.agent
                            ? <Bot className="w-[18px] h-[18px] text-white/75" strokeWidth={2} aria-hidden />
                            : <DeviceGlyph name={current.requester} className="w-[18px] h-[18px] text-white/75" />}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p id={headingId} className="text-[13.5px] font-bold text-white leading-tight break-words line-clamp-2">
                            {current.agent ?? current.requester}
                        </p>
                        <p className="text-[10.5px] text-white/55 leading-snug mt-0.5 break-words">
                            {current.agent
                                ? <>AI agent on <span className="text-white/75 font-semibold">{current.requester}</span></>
                                : "One of your devices"}
                            <span className="font-mono text-white/45"> · {current.requester_id}</span>
                        </p>
                    </div>
                </div>

                {/* What, on what, for how long */}
                <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] divide-y divide-white/[0.05]">
                    <div className="px-3 py-2.5" id={`${headingId}-what`}>
                        <p className="text-[9.5px] font-black uppercase tracking-[0.18em] text-white/45">Wants to</p>
                        <p className="text-[13px] font-bold text-white/95 leading-snug mt-1 break-words">{current.title}</p>
                    </div>
                    {current.target && (
                        <Detail icon={<FileText className="w-3 h-3" strokeWidth={2} aria-hidden />} label="On">
                            <span className="font-mono text-[10.5px] break-all">{current.target}</span>
                        </Detail>
                    )}
                    {/* `minutes` is the lease of this one call - how long it may
                        run before it is cut off - not a window of access: the
                        next request asks again. Say so, or "10 min" reads as
                        "free rein for 10 minutes". */}
                    <div className="flex items-start gap-2 px-3 py-2">
                        <Clock className="w-3.5 h-3.5 text-white/50 shrink-0 mt-px" strokeWidth={2} aria-hidden />
                        <p className="min-w-0 flex-1 text-[12px] text-white/85 leading-snug">
                            <span className="font-bold text-white">This request only.</span>{" "}
                            <span className="text-white/65">
                                It can run for up to {formatMinutes(current.minutes)}; Stop in Devices ends it sooner.
                            </span>
                        </p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button
                        ref={denyRef}
                        onClick={() => answer(false)}
                        disabled={answering}
                        className={`flex-1 py-3 rounded-xl border bg-white/[0.05] border-white/12 text-white/85 hover:text-white hover:bg-white/[0.08] hover:border-white/20 text-[11px] font-black uppercase tracking-[0.12em] transition-all duration-200 active:scale-[0.98] disabled:opacity-40 cursor-pointer ${FOCUS}`}
                    >
                        Deny
                    </button>
                    <button
                        onClick={() => answer(true)}
                        disabled={answering}
                        className={`flex-1 py-3 rounded-xl border bg-blue-500/20 border-blue-400/45 text-blue-50 hover:bg-blue-500/30 hover:border-blue-400/60 text-[11px] font-black uppercase tracking-[0.12em] transition-all duration-200 active:scale-[0.98] disabled:opacity-40 cursor-pointer ${FOCUS}`}
                    >
                        Allow once
                    </button>
                </div>

                <p className="text-[10px] text-white/50 text-center leading-snug -mt-1">
                    No answer means no.
                    {waiting > 0 && <span className="text-white/65 font-semibold"> {waiting} more request{waiting > 1 ? "s" : ""} waiting.</span>}
                </p>
            </div>
        </div>
    );
}

function Detail({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-2 px-3 py-2">
            <span className="flex items-center gap-1 w-9 shrink-0 text-white/45 pt-px">
                {icon}
                <span className="text-[9.5px] font-black uppercase tracking-[0.15em]">{label}</span>
            </span>
            <span className="min-w-0 flex-1 text-[11.5px] text-white/85 leading-snug">{children}</span>
        </div>
    );
}

function formatMinutes(m: number) {
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const rest = m % 60;
    return rest ? `${h} h ${rest} min` : `${h} hour${h > 1 ? "s" : ""}`;
}

/** A ring that empties as the request runs out, turning amber then red near the end. */
function Countdown({ left, total }: { left: number; total: number }) {
    const r = 13;
    const c = 2 * Math.PI * r;
    const ratio = total > 0 ? left / total : 0;
    const color = left <= 5 ? "#f87171" : left <= 15 ? "#fbbf24" : "#60a5fa";
    return (
        <div className="relative w-8 h-8 shrink-0" role="timer" aria-label={`${left} seconds left to answer`}>
            <svg viewBox="0 0 32 32" className="w-8 h-8 -rotate-90" aria-hidden>
                <circle cx="16" cy="16" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
                <circle
                    className="countdown-ring"
                    cx="16" cy="16" r={r} fill="none"
                    stroke={color} strokeWidth="2.5" strokeLinecap="round"
                    strokeDasharray={c}
                    strokeDashoffset={c * (1 - ratio)}
                />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10.5px] font-black text-white/85 tabular-nums" aria-hidden>
                {left}
            </span>
        </div>
    );
}
