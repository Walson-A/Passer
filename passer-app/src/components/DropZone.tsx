import { useEffect, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Check, FileUp, Loader2, X } from "lucide-react";
import { DeviceRender } from "./DeviceRender";
import { InlineError } from "./DeviceInvite";
import { Action, FOCUS, ProgressLine, isRecent, kindOfMember, screenFor, seenLabel, type Capability, type DevicesStatus, type Member, type SendProgress } from "./deviceUi";

interface Props {
    /** Takes the user to the Devices space (when there is nobody to send to yet). */
    onOpenDevices: () => void;
}

type Target = { member: Member; canReceive: boolean };

/**
 * Files dropped on the window go to one of your devices: drop, then choose
 * which. Only devices that accept files (`file.drop`, streamed and of any size,
 * or the older `file.receive`) can be picked; the others say why not. A bar
 * shows each file on its way. Files used to be copied
 * into the "Passer Space" folder instead - Space is folded away until
 * passer-core can stream files of any size.
 */
export function DropZone({ onOpenDevices }: Props) {
    const [hovering, setHovering] = useState(false);
    const [paths, setPaths] = useState<string[] | null>(null);
    const [targets, setTargets] = useState<Target[] | null>(null);
    const [inGroup, setInGroup] = useState(true);
    const [sending, setSending] = useState<string | null>(null);
    const [done, setDone] = useState<string | null>(null);
    const [error, setError] = useState<{ text: string; detail: string } | null>(null);
    const [progress, setProgress] = useState<SendProgress | null>(null);

    useEffect(() => {
        let off: (() => void) | undefined;
        let alive = true;
        (async () => {
            const un = await listen<SendProgress>("send-progress", e => {
                if (e.payload.transfer.startsWith("drop-")) setProgress(e.payload);
            });
            if (alive) off = un; else un();
        })();
        return () => { alive = false; off?.(); };
    }, []);

    useEffect(() => {
        let unlisten: (() => void) | undefined;
        (async () => {
            try {
                unlisten = await getCurrentWebview().onDragDropEvent((event) => {
                    if (event.payload.type === "enter") setHovering(true);
                    else if (event.payload.type === "leave") setHovering(false);
                    else if (event.payload.type === "drop") {
                        setHovering(false);
                        if (event.payload.paths.length > 0) setPaths(event.payload.paths);
                    }
                });
            } catch (error) {
                console.error("Failed to set up the drop zone:", error);
            }
        })();
        return () => unlisten?.();
    }, []);

    // Who can take them: read when the picker opens.
    useEffect(() => {
        if (!paths) return;
        setTargets(null);
        setDone(null);
        setError(null);
        let alive = true;
        (async () => {
            try {
                const status = await invoke<DevicesStatus>("devices_status");
                if (!alive) return;
                setInGroup(!!status.group);
                const others = status.members.filter(m => !m.this_device);
                const list = await Promise.all(others.map(async member => {
                    const caps = await invoke<Capability[]>("devices_capabilities", { id: member.id }).catch(() => []);
                    return { member, canReceive: caps.some(c => c.name === "file.drop" || c.name === "file.receive") };
                }));
                if (alive) setTargets(list.sort((a, b) => Number(b.canReceive) - Number(a.canReceive)));
            } catch {
                if (alive) { setInGroup(false); setTargets([]); }
            }
        })();
        return () => { alive = false; };
    }, [paths]);

    const close = () => { if (!sending) setPaths(null); };

    useEffect(() => {
        if (!paths) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });

    const send = async (m: Member) => {
        if (!paths || sending) return;
        setSending(m.id);
        setError(null);
        setProgress(null);
        try {
            const n = await invoke<number>("devices_send_paths", { id: m.id, paths });
            setDone(`${n === 1 ? "Sent" : `${n} files sent`} to ${m.name}`);
            setTimeout(() => setPaths(null), 1600);
        } catch (e) {
            setError({ text: `It didn't reach ${m.name}.`, detail: String(e) });
        } finally {
            setSending(null);
            setProgress(null);
        }
    };

    const names = paths?.map(p => p.split(/[\\/]/).pop() ?? p) ?? [];

    return (
        <>
            {hovering && (
                <div className="absolute inset-0 z-[450] flex items-center justify-center pointer-events-none p-8">
                    <div className="scrim-in absolute inset-0 bg-blue-950/40" />
                    <div className="sheet-in relative w-[360px] p-8 rounded-[32px] bg-[#161616]/95 border border-blue-400/25 shadow-[0_0_80px_rgba(59,130,246,0.18)] flex flex-col items-center gap-4 text-center">
                        <div className="w-16 h-16 rounded-[22px] bg-blue-500/15 border border-blue-400/30 flex items-center justify-center">
                            <FileUp className="w-7 h-7 text-blue-300" strokeWidth={1.75} />
                        </div>
                        <p className="text-[18px] font-bold text-white">Drop to send</p>
                        <p className="text-[13px] text-white/60 leading-snug">You'll choose which device next.</p>
                    </div>
                </div>
            )}

            {paths && (
                <div className="absolute inset-0 z-[460] flex items-center justify-center p-6">
                    <div className="scrim-in absolute inset-0 bg-black/60" onClick={close} aria-hidden />
                    <div className="sheet-in relative w-[440px] max-h-full flex flex-col rounded-3xl bg-[#161616] border border-white/10 shadow-[0_24px_70px_rgba(0,0,0,0.6)]" role="dialog" aria-modal="true" aria-label="Send to a device">
                        <div className="shrink-0 flex items-start gap-3 pl-6 pr-3 pt-5 pb-3">
                            <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/60">Send to</p>
                                <p className="text-[14px] font-bold text-white/90 mt-1.5 truncate" title={names.join(", ")}>
                                    {names.length === 1 ? names[0] : `${names.length} files`}
                                </p>
                            </div>
                            <button onClick={close} aria-label="Close" className={`p-2 rounded-lg text-white/55 hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer ${FOCUS}`}>
                                <X className="w-4 h-4" strokeWidth={2.25} aria-hidden />
                            </button>
                        </div>

                        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 pb-5 flex flex-col gap-1.5">
                            {targets === null ? (
                                [0, 1].map(i => <span key={i} className="skeleton block h-[60px] rounded-2xl" />)
                            ) : !inGroup || targets.length === 0 ? (
                                <div className="px-2 py-3 flex flex-col items-start gap-3">
                                    <p className="text-[13px] text-white/65 leading-snug">
                                        To send files from here, add your other devices to Passer first.
                                    </p>
                                    <Action tone="primary" onClick={() => { setPaths(null); onOpenDevices(); }}>Go to Devices</Action>
                                </div>
                            ) : (
                                targets.map(({ member: m, canReceive }) => {
                                    const kind = kindOfMember(m);
                                    return (
                                        <button
                                            key={m.id}
                                            onClick={() => send(m)}
                                            disabled={!canReceive || !!sending || !!done}
                                            className={`flex items-center gap-3 p-2.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer disabled:cursor-not-allowed ${FOCUS}
                                                ${canReceive ? "bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.06] hover:border-blue-400/35" : "bg-transparent border-transparent opacity-55"}`}
                                        >
                                            <span className="w-11 h-11 shrink-0 rounded-xl bg-black/25 flex items-end justify-center pb-1 overflow-hidden" aria-hidden>
                                                <DeviceRender kind={kind} screen={screenFor(m.id)} size={kind === "phone" || kind === "tablet" ? 0.13 : 0.1} dim={!isRecent(m.answered_at)} />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-[13px] font-semibold text-white/90 truncate">{m.name}</span>
                                                <span className="block text-[12px] text-white/50 truncate">
                                                    {canReceive ? seenLabel(m.answered_at) : "Doesn't accept files from here yet"}
                                                </span>
                                            </span>
                                            {sending === m.id && <Loader2 className="w-4 h-4 animate-spin text-blue-200" aria-hidden />}
                                        </button>
                                    );
                                })
                            )}
                            <div aria-live="polite">
                                {sending && progress && <div className="px-2 pt-2"><ProgressLine p={progress} /></div>}
                                {done && (
                                    <p className="flex items-center gap-1.5 px-2 pt-2 text-[13px] font-semibold text-emerald-300">
                                        <Check className="w-4 h-4" strokeWidth={2.5} aria-hidden />{done}
                                    </p>
                                )}
                                {error && <div className="pt-2"><InlineError text={error.text} detail={error.detail} /></div>}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
