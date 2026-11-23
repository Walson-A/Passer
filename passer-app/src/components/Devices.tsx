import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { QRCodeSVG } from "qrcode.react";
import {
    MonitorSmartphone, Plus, Link2, ShieldAlert, ShieldCheck, Trash2, OctagonX, Check, Crown,
} from "lucide-react";

interface Member {
    id: string;
    short_id: string;
    name: string;
    approver: boolean;
    this_device: boolean;
}

interface Status {
    device_id: string;
    group: string | null;
    running: boolean;
    development_network: boolean;
    members: Member[];
}

interface Joined {
    name: string;
    id: string;
    sas: string;
}

interface Props {
    /** True while this is the visible view. */
    active: boolean;
}

/**
 * The user's devices: the group this PC belongs to, inviting a new device by QR code,
 * removing one, and the stop button for anything another device is doing here.
 */
export function Devices({ active }: Props) {
    const [status, setStatus] = useState<Status | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [invite, setInvite] = useState<string | null>(null);
    const [inviteApprover, setInviteApprover] = useState(false);
    const [joinLink, setJoinLink] = useState("");
    const [joined, setJoined] = useState<Joined | null>(null);
    const [joinSas, setJoinSas] = useState<string | null>(null);
    const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
    const [stopped, setStopped] = useState(false);

    const refresh = useCallback(async () => {
        try {
            setStatus(await invoke<Status>("devices_status"));
        } catch (e) {
            setError(String(e));
        }
    }, []);

    useEffect(() => {
        if (active) refresh();
        if (!active) {
            // Never leave a secret QR code on a screen the user navigated away from.
            setInvite(null);
            setConfirmRemove(null);
        }
    }, [active, refresh]);

    // A device joined through our invitation: show the code to compare, refresh the list.
    useEffect(() => {
        let off: (() => void) | undefined;
        (async () => {
            off = await listen<Joined>("device-joined", (e) => {
                setInvite(null);
                setJoined(e.payload);
                refresh();
            });
        })();
        return () => off?.();
    }, [refresh]);

    const run = async (fn: () => Promise<void>) => {
        if (busy) return;
        setBusy(true);
        setError(null);
        try {
            await fn();
        } catch (e) {
            setError(String(e));
        } finally {
            setBusy(false);
        }
    };

    const createGroup = () => run(async () => {
        await invoke("devices_create_group", { name: "My devices" });
        await refresh();
    });

    const join = () => run(async () => {
        const sas = await invoke<string>("devices_join", { link: joinLink });
        setJoinLink("");
        setJoinSas(sas);
        await refresh();
    });

    const showInvite = () => run(async () => {
        setJoined(null);
        setInvite(await invoke<string>("devices_invite", { approver: inviteApprover }));
    });

    const remove = (id: string) => run(async () => {
        if (confirmRemove !== id) {
            setConfirmRemove(id);
            setTimeout(() => setConfirmRemove(c => (c === id ? null : c)), 4000);
            return;
        }
        await invoke("devices_remove", { id });
        setConfirmRemove(null);
        await refresh();
    });

    const stopAll = () => run(async () => {
        await invoke("devices_stop_sessions");
        setStopped(true);
        setTimeout(() => setStopped(false), 1500);
    });

    const me = status?.members.find(m => m.this_device);
    const canInvite = !!me?.approver;

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pt-5 pb-2 flex flex-col gap-3">
            {error && (
                <p className="text-[10px] text-red-400 leading-relaxed px-1 break-words">{error}</p>
            )}

            {/* Not in a group yet */}
            {status && !status.group && (
                <>
                    <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex flex-col gap-2.5">
                        <div className="flex items-center gap-3">
                            <div className="shrink-0 w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-400/20 flex items-center justify-center">
                                <MonitorSmartphone className="w-4 h-4 text-blue-400" strokeWidth={2} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[11px] font-bold text-white/90 leading-tight">Connect your devices</p>
                                <p className="text-[9px] text-white/40 leading-tight mt-0.5">
                                    Your phone and computers, linked directly and encrypted end to end
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={createGroup}
                            disabled={busy}
                            className="flex items-center justify-center gap-1.5 py-2 rounded-xl border bg-blue-500/15 border-blue-400/30 text-blue-200 hover:bg-blue-500/25 text-[9px] font-black uppercase tracking-widest transition-all duration-200 active:scale-[0.98] disabled:opacity-40 cursor-pointer"
                        >
                            <Plus className="w-3 h-3" strokeWidth={2.5} />
                            Start with this PC
                        </button>
                    </div>

                    <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex flex-col gap-2">
                        <p className="text-[10px] font-bold text-white/70 leading-tight">Or join your other devices</p>
                        <input
                            value={joinLink}
                            onChange={e => setJoinLink(e.target.value)}
                            placeholder="Paste the invitation link"
                            spellCheck={false}
                            className="px-2.5 py-2 rounded-xl bg-black/50 border border-white/10 text-[10px] font-mono text-white/80 placeholder:text-white/25 outline-none focus:border-blue-400/40"
                        />
                        <button
                            onClick={join}
                            disabled={busy || !joinLink.trim()}
                            className="flex items-center justify-center gap-1.5 py-2 rounded-xl border bg-white/[0.03] border-white/10 text-white/60 hover:text-white/90 hover:border-white/20 text-[9px] font-black uppercase tracking-widest transition-all duration-200 active:scale-[0.98] disabled:opacity-40 cursor-pointer"
                        >
                            <Link2 className="w-3 h-3" strokeWidth={2.5} />
                            Join
                        </button>
                    </div>
                </>
            )}

            {/* Joined just now: the code to compare with the inviting device */}
            {joinSas && (
                <SasCard
                    title="Joined"
                    text="The device that invited this PC shows a code. It must be the same:"
                    sas={joinSas}
                    onDone={() => setJoinSas(null)}
                />
            )}
            {joined && (
                <SasCard
                    title={`${joined.name} joined`}
                    text={`Check that ${joined.name} shows the same code. If it doesn't, remove it below.`}
                    sas={joined.sas}
                    onDone={() => setJoined(null)}
                />
            )}

            {/* In a group */}
            {status?.group && (
                <>
                    <div className="px-1 flex items-baseline justify-between">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">{status.group}</p>
                        <p className="text-[9px] text-white/35">{status.running ? "Online" : "Offline"}</p>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        {status.members.map(m => (
                            <div key={m.id} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                                <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-bold text-white/90 leading-tight truncate flex items-center gap-1.5">
                                        {m.name}
                                        {m.approver && <Crown className="w-3 h-3 text-amber-300/70" strokeWidth={2} aria-label="Approver" />}
                                    </p>
                                    <p className="text-[9px] font-mono text-white/35 leading-tight mt-0.5">
                                        {m.short_id}{m.this_device ? " · this PC" : ""}
                                    </p>
                                </div>
                                {!m.this_device && canInvite && (
                                    <button
                                        onClick={() => remove(m.id)}
                                        disabled={busy}
                                        className={`shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-lg border text-[8px] font-black uppercase tracking-widest transition-all duration-200 cursor-pointer
                                            ${confirmRemove === m.id
                                                ? "bg-red-500/20 border-red-400/40 text-red-300"
                                                : "bg-white/[0.03] border-white/10 text-white/35 hover:text-white/80"}`}
                                    >
                                        <Trash2 className="w-3 h-3" strokeWidth={2.5} />
                                        {confirmRemove === m.id ? "Confirm" : "Remove"}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    {canInvite && !invite && (
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={showInvite}
                                disabled={busy || !status.running}
                                className="flex items-center justify-center gap-1.5 py-2 rounded-xl border bg-blue-500/15 border-blue-400/30 text-blue-200 hover:bg-blue-500/25 text-[9px] font-black uppercase tracking-widest transition-all duration-200 active:scale-[0.98] disabled:opacity-40 cursor-pointer"
                            >
                                <Plus className="w-3 h-3" strokeWidth={2.5} />
                                Add a device
                            </button>
                            <label className="flex items-center gap-2 px-1 text-[9px] text-white/45 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={inviteApprover}
                                    onChange={e => setInviteApprover(e.target.checked)}
                                    className="accent-blue-400"
                                />
                                It can approve and add devices too (for your own phone or laptop)
                            </label>
                        </div>
                    )}

                    {invite && (
                        <div className="flex flex-col gap-2.5">
                            <div className="flex items-center justify-center p-4 rounded-2xl bg-white">
                                <QRCodeSVG value={invite} size={172} level="M" marginSize={0} />
                            </div>
                            <p className="text-[9px] text-white/45 leading-relaxed text-center px-2">
                                Scan with the other device, or paste the link there. Valid 10 minutes, once.
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => navigator.clipboard.writeText(invite)}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border bg-white/[0.03] border-white/10 text-white/50 hover:text-white/90 text-[9px] font-black uppercase tracking-widest transition-all active:scale-[0.98] cursor-pointer"
                                >
                                    <Link2 className="w-3 h-3" strokeWidth={2.5} /> Copy link
                                </button>
                                <button
                                    onClick={() => setInvite(null)}
                                    className="flex-1 py-2 rounded-xl border bg-white/[0.03] border-white/10 text-white/50 hover:text-white/90 text-[9px] font-black uppercase tracking-widest transition-all active:scale-[0.98] cursor-pointer"
                                >
                                    Done
                                </button>
                            </div>
                            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/[0.07] border border-amber-400/15">
                                <ShieldAlert className="w-3.5 h-3.5 text-amber-400/80 shrink-0 mt-px" strokeWidth={2} />
                                <p className="text-[9px] text-amber-200/70 leading-relaxed">
                                    This code lets one device join your group. Don't share or screenshot it.
                                </p>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={stopAll}
                        disabled={busy || !status.running}
                        className={`flex items-center justify-center gap-1.5 py-2 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all duration-200 active:scale-[0.98] disabled:opacity-40 cursor-pointer
                            ${stopped
                                ? "bg-emerald-500/15 border-emerald-400/30 text-emerald-400"
                                : "bg-white/[0.03] border-white/10 text-white/40 hover:text-red-300 hover:border-red-400/30"}`}
                    >
                        {stopped ? <Check className="w-3 h-3" strokeWidth={2.5} /> : <OctagonX className="w-3 h-3" strokeWidth={2.5} />}
                        {stopped ? "Stopped" : "Stop everything other devices are doing"}
                    </button>

                    {status.development_network && (
                        <p className="text-[8px] text-white/25 leading-relaxed px-1">
                            Preview: devices reach each other through n0's development relays. Content is
                            end-to-end encrypted; the relays see addresses and timing.
                        </p>
                    )}
                </>
            )}
        </div>
    );
}

function SasCard({ title, text, sas, onDone }: { title: string; text: string; sas: string; onDone: () => void }) {
    return (
        <div className="p-3 rounded-2xl bg-emerald-500/[0.07] border border-emerald-400/20 flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" strokeWidth={2} />
                <p className="text-[11px] font-bold text-white/90">{title}</p>
            </div>
            <p className="text-[9px] text-white/55 leading-relaxed">{text}</p>
            <p className="text-center text-[22px] font-black tracking-[0.35em] text-white tabular-nums">
                {sas.slice(0, 3)} {sas.slice(3)}
            </p>
            <button
                onClick={onDone}
                className="py-1.5 rounded-lg border bg-white/[0.03] border-white/10 text-white/50 hover:text-white/90 text-[9px] font-black uppercase tracking-widest cursor-pointer"
            >
                OK
            </button>
        </div>
    );
}
