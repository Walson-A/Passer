import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
    Check, ChevronRight, KeyRound, Laptop, Lock, Monitor, OctagonX, QrCode, RefreshCw, ShieldCheck,
    Smartphone, Trash2, WifiOff, X, CircleAlert, Link2, Loader2,
} from "lucide-react";
import { DeviceInvite, InlineError } from "./DeviceInvite";
import { Action, DeviceGlyph, FOCUS, SasDigits, type DevicesStatus, type Joined, type Member } from "./deviceUi";

interface Props {
    /** True while this is the visible view. */
    active: boolean;
}

interface Failure {
    text: string;
    detail: string;
}

/**
 * The user's devices: the group this PC belongs to, inviting a new device by QR
 * code, removing one, and the stop button for anything another device is doing
 * here. Every name on this screen was chosen by some device, possibly another
 * one, and is rendered as plain text.
 */
export function Devices({ active }: Props) {
    const [status, setStatus] = useState<DevicesStatus | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [retrying, setRetrying] = useState(false);
    const [failure, setFailure] = useState<Failure | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [inviteOpen, setInviteOpen] = useState(false);
    const [joined, setJoined] = useState<Joined | null>(null);
    const [joinSas, setJoinSas] = useState<string | null>(null);
    const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
    const [stopped, setStopped] = useState(false);
    const listRef = useRef<HTMLUListElement>(null);

    const refresh = useCallback(async () => {
        try {
            const next = await invoke<DevicesStatus>("devices_status");
            setStatus(next);
            setLoadError(null);
            return next;
        } catch (e) {
            setLoadError(String(e));
            return null;
        }
    }, []);

    // Load on arrival, then keep "Connected" honest while the tab is in view.
    useEffect(() => {
        if (!active) {
            // Never leave a secret code, or an armed removal, behind a view the
            // user navigated away from.
            setInviteOpen(false);
            setConfirmRemove(null);
            return;
        }
        refresh();
        const t = setInterval(refresh, 8000);
        return () => clearInterval(t);
    }, [active, refresh]);

    // A device joined through our invitation: show the code to compare.
    useEffect(() => {
        let off: (() => void) | undefined;
        let alive = true;
        (async () => {
            const un = await listen<Joined>("device-joined", (e) => {
                setInviteOpen(false);
                setJoined(e.payload);
                refresh();
            });
            if (alive) off = un; else un();
        })();
        return () => { alive = false; off?.(); };
    }, [refresh]);

    const run = async (key: string, failText: string, fn: () => Promise<void>) => {
        if (busy) return;
        setBusy(key);
        setFailure(null);
        try {
            await fn();
        } catch (e) {
            setFailure({ text: failText, detail: String(e) });
        } finally {
            setBusy(null);
        }
    };

    const retry = async () => {
        setRetrying(true);
        await refresh();
        setRetrying(false);
    };

    const createGroup = () => run("create", "Passer couldn't set up your devices.", async () => {
        await invoke("devices_create_group", { name: "My devices" });
        await refresh();
    });

    const remove = (m: Member) => run(`remove:${m.id}`, `${m.name} couldn't be removed.`, async () => {
        await invoke("devices_remove", { id: m.id });
        setConfirmRemove(null);
        await refresh();
    });

    const stopAll = () => run("stop", "Passer couldn't stop what other devices are doing.", async () => {
        await invoke("devices_stop_sessions");
        setStopped(true);
        setTimeout(() => setStopped(false), 2500);
    });

    // "The codes don't match": arm the removal of the device that just joined.
    const mismatch = async (j: Joined) => {
        setJoined(null);
        const list = (await refresh())?.members ?? status?.members ?? [];
        const m = list.find(x => x.short_id === j.id);
        if (!m) return;
        setConfirmRemove(m.id);
        requestAnimationFrame(() => {
            listRef.current?.querySelector(`[data-member="${CSS.escape(m.id)}"]`)
                ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        });
    };

    const closeInvite = useCallback(() => setInviteOpen(false), []);

    // --- States without a group -------------------------------------------------

    let body: React.ReactNode;
    if (!status && loadError) {
        body = <LoadFailed detail={loadError} retrying={retrying} onRetry={retry} />;
    } else if (!status) {
        body = <Skeleton />;
    } else if (!status.group) {
        body = (
            <Welcome
                busy={busy}
                failure={failure}
                onStart={createGroup}
                onJoined={async (sas) => {
                    setJoinSas(sas);
                    await refresh();
                }}
            />
        );
    } else {
        const me = status.members.find(m => m.this_device);
        const canManage = !!me?.approver;
        const approvers = status.members.filter(m => m.approver && !m.this_device);
        const others = status.members.length - 1;

        body = (
            <>
                {joinSas && (
                    <SasCard
                        title={`This PC joined ${status.group}`}
                        text="The device that invited this PC shows a code too. If it's not this one, remove this PC from that device."
                        sas={joinSas}
                    >
                        <Action tone="success" className="w-full" onClick={() => setJoinSas(null)}
                            icon={<Check className="w-3 h-3" strokeWidth={2.5} aria-hidden />}>
                            Done
                        </Action>
                    </SasCard>
                )}
                {joined && (
                    <SasCard
                        title={`${joined.name} joined`}
                        text={`Check that ${joined.name} shows this same code. That proves it's really your device.`}
                        sas={joined.sas}
                    >
                        <div className="flex gap-2">
                            <Action className="flex-1" onClick={() => mismatch(joined)}>It's different</Action>
                            <Action tone="success" className="flex-1" onClick={() => setJoined(null)}
                                icon={<Check className="w-3 h-3" strokeWidth={2.5} aria-hidden />}>
                                It matches
                            </Action>
                        </div>
                    </SasCard>
                )}

                {/* Group header: name, count, and whether this PC is reachable */}
                <div className="flex items-end justify-between gap-3 px-1">
                    <div className="min-w-0">
                        <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/75 truncate">{status.group}</h2>
                        <p className="text-[10.5px] text-white/50 leading-tight mt-1">
                            {others === 0 ? "Only this PC so far" : `This PC and ${others} other device${others > 1 ? "s" : ""}`}
                        </p>
                    </div>
                    <ConnectionPill running={status.running} />
                </div>

                {!status.running && (
                    <div className="rise flex items-start gap-2.5 p-3 rounded-2xl bg-amber-500/[0.06] border border-amber-400/15" role="status">
                        <WifiOff className="w-4 h-4 text-amber-300/90 shrink-0 mt-px" strokeWidth={2} aria-hidden />
                        <div className="min-w-0 flex-1">
                            <p className="text-[11.5px] font-bold text-amber-100/90 leading-tight">This PC is offline</p>
                            <p className="text-[10.5px] text-amber-100/65 leading-snug mt-1">
                                Your other devices can't reach it until it reconnects.
                            </p>
                        </div>
                        <button
                            onClick={retry}
                            aria-label="Check again"
                            title="Check again"
                            className={`shrink-0 p-1.5 rounded-lg text-amber-200/70 hover:text-amber-100 hover:bg-amber-400/10 transition-all active:scale-90 cursor-pointer ${FOCUS}`}
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${retrying ? "animate-spin" : ""}`} strokeWidth={2.25} aria-hidden />
                        </button>
                    </div>
                )}

                {failure && (
                    <InlineError
                        text={failure.text}
                        detail={failure.detail}
                        action={
                            <button
                                onClick={() => setFailure(null)}
                                className={`self-start text-[10px] font-black uppercase tracking-[0.12em] text-red-200/70 hover:text-red-100 cursor-pointer rounded ${FOCUS}`}
                            >
                                Dismiss
                            </button>
                        }
                    />
                )}

                {/* The devices */}
                <ul ref={listRef} className="rounded-2xl bg-white/[0.03] border border-white/[0.06] divide-y divide-white/[0.05] overflow-hidden">
                    {sortMembers(status.members).map((m, i) => (
                        <MemberRow
                            key={m.id}
                            member={m}
                            index={i}
                            canRemove={canManage && !m.this_device}
                            confirming={confirmRemove === m.id}
                            busy={busy === `remove:${m.id}`}
                            onAsk={() => setConfirmRemove(m.id)}
                            onCancel={() => setConfirmRemove(null)}
                            onConfirm={() => remove(m)}
                        />
                    ))}
                </ul>

                {/* Add a device - pushes one level deeper */}
                {canManage ? (
                    <button
                        onClick={() => setInviteOpen(true)}
                        disabled={!status.running}
                        className={`flex items-center gap-3 p-3 rounded-2xl bg-blue-500/10 border border-blue-400/25 hover:bg-blue-500/20 hover:border-blue-400/40 transition-all duration-200 active:scale-[0.99] text-left cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:bg-blue-500/10 disabled:active:scale-100 ${FOCUS}`}
                    >
                        <div className="shrink-0 w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
                            <QrCode className="w-4 h-4 text-blue-300" strokeWidth={2} aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[12px] font-bold text-white/90 leading-tight">Add a device</p>
                            <p className="text-[10.5px] text-white/55 leading-tight mt-0.5">
                                {status.running ? "Show a code to scan on your phone or computer" : "Needs this PC to be online"}
                            </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-white/35 shrink-0" strokeWidth={2} aria-hidden />
                    </button>
                ) : (
                    <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                        <KeyRound className="w-4 h-4 text-white/45 shrink-0 mt-px" strokeWidth={2} aria-hidden />
                        <p className="text-[10.5px] text-white/60 leading-snug">
                            {approvers.length > 0
                                ? <>To add or remove a device, use {listNames(approvers.map(a => a.name))}.</>
                                : "This PC can't add or remove devices."}
                        </p>
                    </div>
                )}

                {/* The way out: end whatever other devices are doing here.
                    Pointless, so absent, while this PC is alone. */}
                {others > 0 && <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                    <div className="shrink-0 w-8 h-8 rounded-xl bg-red-500/10 border border-red-400/20 flex items-center justify-center">
                        <OctagonX className="w-4 h-4 text-red-300" strokeWidth={2} aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-bold text-white/90 leading-tight">Stop remote activity</p>
                        <p className="text-[10.5px] text-white/55 leading-tight mt-0.5">Ends everything other devices are doing here</p>
                    </div>
                    <button
                        onClick={stopAll}
                        disabled={!!busy || !status.running}
                        aria-live="polite"
                        className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-[0.12em] transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${FOCUS}
                            ${stopped
                                ? "bg-emerald-500/15 border-emerald-400/30 text-emerald-300"
                                : "bg-red-500/10 border-red-400/30 text-red-200 hover:bg-red-500/20 hover:border-red-400/50"}`}
                    >
                        {busy === "stop"
                            ? <Loader2 className="w-3 h-3 animate-spin" strokeWidth={2.5} aria-hidden />
                            : stopped && <Check className="w-3 h-3" strokeWidth={2.5} aria-hidden />}
                        {stopped ? "Stopped" : "Stop"}
                    </button>
                </div>}

                <Footnote preview={status.development_network} />
            </>
        );
    }

    return (
        // `overflow-clip`, not `hidden`: the parked invite layer sits at
        // translateX(100%), and an overflow-hidden box is still scrollable by
        // scrollIntoView - which slid the whole tab sideways. Clip can't scroll.
        <div className="relative flex-1 flex flex-col min-h-0 overflow-clip">
            {/* Children never shrink: in a scrolling column they would be
                squashed (and the list clipped) instead of scrolling. */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pt-5 pb-3 flex flex-col gap-3 [&>*]:shrink-0" aria-busy={!status && !loadError}>
                {body}
            </div>

            {/* One level deeper than the list, so it pushes in from the right. */}
            <div className="detail-layer" data-open={inviteOpen}>
                <DeviceInvite open={inviteOpen} connected={!!status?.running} onClose={closeInvite} />
            </div>
        </div>
    );
}

/** This PC first, then the devices that can manage the group, then the rest. */
function sortMembers(members: Member[]) {
    return [...members].sort((a, b) =>
        Number(b.this_device) - Number(a.this_device)
        || Number(b.approver) - Number(a.approver)
        || a.name.localeCompare(b.name));
}

function listNames(names: string[]) {
    if (names.length <= 1) return names[0] ?? "";
    return `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
}

function ConnectionPill({ running }: { running: boolean }) {
    return (
        <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/[0.06] bg-white/[0.02]" role="status">
            <span className={`w-1.5 h-1.5 rounded-full ${running
                ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]"
                : "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.3)]"}`} aria-hidden />
            <span className={`text-[9.5px] font-black uppercase tracking-[0.18em] ${running ? "text-white/70" : "text-red-300/90"}`}>
                {running ? "Online" : "Offline"}
            </span>
        </div>
    );
}

function MemberRow({ member: m, index, canRemove, confirming, busy, onAsk, onCancel, onConfirm }: {
    member: Member;
    index: number;
    canRemove: boolean;
    confirming: boolean;
    busy: boolean;
    onAsk: () => void;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    return (
        <li data-member={m.id} className="rise" style={{ ["--i" as string]: index }}>
            <div className="flex items-center gap-3 px-3 py-2.5">
                <div className={`shrink-0 w-8 h-8 rounded-xl border flex items-center justify-center
                    ${m.this_device ? "bg-blue-500/15 border-blue-400/25" : "bg-white/[0.05] border-white/10"}`}>
                    <DeviceGlyph name={m.name} thisDevice={m.this_device}
                        className={`w-4 h-4 ${m.this_device ? "text-blue-300" : "text-white/70"}`} />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-bold text-white/90 leading-tight truncate" title={m.name}>{m.name}</p>
                    <div className="flex items-center gap-1.5 mt-1 min-w-0">
                        {m.this_device
                            ? <span className="text-[10px] font-bold text-blue-300/90 leading-none">This PC</span>
                            : <span className="text-[10px] font-mono text-white/50 leading-none" title="Device ID">{m.short_id}</span>}
                        {m.approver && (
                            <span
                                className="flex items-center gap-0.5 px-1.5 py-[3px] rounded-full bg-amber-500/10 border border-amber-400/20 text-[9px] font-bold text-amber-200/85 leading-none whitespace-nowrap"
                                title="Can add and remove devices"
                            >
                                <ShieldCheck className="w-2.5 h-2.5" strokeWidth={2.5} aria-hidden />
                                Manages devices
                            </span>
                        )}
                    </div>
                </div>
                {canRemove && !confirming && (
                    <button
                        onClick={onAsk}
                        aria-label={`Remove ${m.name}`}
                        title="Remove"
                        className={`shrink-0 p-2 rounded-lg text-white/40 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200 active:scale-90 cursor-pointer ${FOCUS}`}
                    >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />
                    </button>
                )}
            </div>

            {confirming && (
                <div className="rise mx-2 mb-2 p-2.5 rounded-xl bg-red-500/[0.08] border border-red-400/20 flex flex-col gap-2" role="alertdialog" aria-label={`Remove ${m.name}?`}>
                    <p className="text-[11px] text-red-100/85 leading-snug">
                        <span className="font-bold text-red-100">Remove {m.name}?</span> It loses access to your devices right away. You can add it back later.
                    </p>
                    <div className="flex gap-2">
                        <Action className="flex-1 !py-2" onClick={onCancel} autoFocus>Cancel</Action>
                        <Action className="flex-1 !py-2" tone="danger" busy={busy} onClick={onConfirm}
                            icon={<Trash2 className="w-3 h-3" strokeWidth={2.5} aria-hidden />}>
                            Remove
                        </Action>
                    </div>
                </div>
            )}
        </li>
    );
}

function SasCard({ title, text, sas, children }: { title: string; text: string; sas: string; children: React.ReactNode }) {
    return (
        <section className="rise p-3.5 rounded-2xl bg-emerald-500/[0.06] border border-emerald-400/20 flex flex-col gap-3" aria-label={title}>
            <div className="flex items-start gap-2.5">
                <div className="shrink-0 w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-400/25 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4 text-emerald-300" strokeWidth={2} aria-hidden />
                </div>
                <div className="min-w-0">
                    <p className="text-[12px] font-bold text-white/90 leading-tight break-words">{title}</p>
                    <p className="text-[10.5px] text-white/60 leading-snug mt-1 break-words">{text}</p>
                </div>
            </div>
            <SasDigits sas={sas} />
            {children}
        </section>
    );
}

function Footnote({ preview }: { preview: boolean }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="flex flex-col gap-1.5 px-1 pt-1 pb-1">
            <div className="flex items-center gap-2">
                <Lock className="w-3 h-3 text-white/45 shrink-0" strokeWidth={2} aria-hidden />
                <p className="flex-1 text-[11px] text-white/55 leading-snug">End-to-end encrypted</p>
                {preview && (
                    <button
                        onClick={() => setOpen(o => !o)}
                        aria-expanded={open}
                        className={`shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full border border-white/10 bg-white/[0.03] text-[10px] font-bold text-white/60 hover:text-white/85 hover:border-white/20 transition-all cursor-pointer ${FOCUS}`}
                    >
                        Preview
                        <ChevronRight className={`w-2.5 h-2.5 transition-transform duration-200 ${open ? "rotate-90" : ""}`} strokeWidth={2.5} aria-hidden />
                    </button>
                )}
            </div>
            {/* The relays are n0's development ones (backend.md, "Network");
                the user needs what that means for them, not whose they are. */}
            {preview && open && (
                <p className="rise text-[11px] text-white/55 leading-snug pl-5">
                    During the preview, your devices find each other through test servers. Those servers can see when
                    your devices connect, but never what they send.
                </p>
            )}
        </div>
    );
}

// --- No group yet ----------------------------------------------------------------

function Welcome({ busy, failure, onStart, onJoined }: {
    busy: string | null;
    failure: Failure | null;
    onStart: () => void;
    onJoined: (sas: string) => Promise<void>;
}) {
    const [joinOpen, setJoinOpen] = useState(false);
    const [link, setLink] = useState("");
    const [joining, setJoining] = useState(false);
    const [joinError, setJoinError] = useState<string | null>(null);

    const join = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (joining || !link.trim()) return;
        setJoining(true);
        setJoinError(null);
        try {
            const sas = await invoke<string>("devices_join", { link: link.trim() });
            setLink("");
            await onJoined(sas);
        } catch (err) {
            setJoinError(String(err));
        } finally {
            setJoining(false);
        }
    };

    return (
        <div className="flex flex-col gap-3">
            {/* What this is, before asking anything */}
            <div className="rise flex flex-col items-center text-center pt-1 pb-1">
                {/* Folded away while the link form is open, so the form and its
                    error stay above the fold. */}
                {!joinOpen && <Constellation />}
                <h2 className={`text-[14px] font-bold text-white/95 leading-tight ${joinOpen ? "" : "mt-3"}`}>Your devices, together</h2>
                <p className="text-[11px] text-white/60 leading-snug mt-1.5 max-w-[280px]">
                    Link your phone and computers so they can pass things to each other directly, encrypted end to end.
                </p>
            </div>

            {failure && <InlineError text={failure.text} detail={failure.detail} />}

            {!joinOpen ? (
                <div className="rise flex flex-col gap-2" style={{ ["--i" as string]: 1 }}>
                    <Action
                        tone="primary"
                        onClick={onStart}
                        busy={busy === "create"}
                        icon={<Monitor className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden />}
                    >
                        Start with this PC
                    </Action>
                    <p className="text-[10.5px] text-white/50 text-center leading-snug px-4">
                        Choose this if Passer isn't set up on any of your other devices yet.
                    </p>

                    <div className="flex items-center gap-2 py-1" aria-hidden>
                        <span className="flex-1 h-px bg-white/[0.07]" />
                        <span className="text-[9.5px] font-black uppercase tracking-[0.2em] text-white/35">or</span>
                        <span className="flex-1 h-px bg-white/[0.07]" />
                    </div>

                    <Action
                        onClick={() => setJoinOpen(true)}
                        icon={<Link2 className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden />}
                    >
                        I have an invitation
                    </Action>
                    <p className="text-[10.5px] text-white/50 text-center leading-snug px-4">
                        On a device that already uses Passer, open Devices, then Add a device.
                    </p>
                </div>
            ) : (
                <form onSubmit={join} className="rise flex flex-col gap-2 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                    <div className="flex items-center justify-between">
                        <label htmlFor="invite-link" className="text-[12px] font-bold text-white/90">Invitation link</label>
                        <button
                            type="button"
                            onClick={() => { setJoinOpen(false); setJoinError(null); }}
                            aria-label="Cancel"
                            className={`p-1 -mr-1 rounded-lg text-white/45 hover:text-white hover:bg-white/10 transition-all cursor-pointer ${FOCUS}`}
                        >
                            <X className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden />
                        </button>
                    </div>
                    <p className="text-[10.5px] text-white/55 leading-snug -mt-1">
                        Copy it from the other device's Add a device screen, then paste it here.
                    </p>
                    <input
                        id="invite-link"
                        autoFocus
                        value={link}
                        onChange={e => { setLink(e.target.value); setJoinError(null); }}
                        placeholder="Paste the link"
                        spellCheck={false}
                        autoComplete="off"
                        aria-invalid={!!joinError}
                        className={`px-2.5 py-2 rounded-xl bg-black/50 border text-[11px] font-mono text-white/85 placeholder:text-white/35 placeholder:font-sans outline-none transition-colors
                            ${joinError ? "border-red-400/40" : "border-white/10 focus:border-blue-400/50"}`}
                    />
                    {joinError && (
                        <InlineError
                            text="That invitation didn't work. It may have expired or already been used — ask for a new one."
                            detail={joinError}
                        />
                    )}
                    <Action
                        type="submit"
                        tone="primary"
                        busy={joining}
                        disabled={!link.trim()}
                        icon={<Link2 className="w-3 h-3" strokeWidth={2.5} aria-hidden />}
                    >
                        {joining ? "Joining…" : "Join"}
                    </Action>
                </form>
            )}
        </div>
    );
}

/** Three devices and the links between them: what this tab is about, at a glance. */
function Constellation() {
    const tile = "absolute w-10 h-10 rounded-2xl border flex items-center justify-center";
    return (
        <div className="relative w-[164px] h-[76px]" aria-hidden>
            <div className="absolute inset-0 bg-[radial-gradient(closest-side,rgba(59,130,246,0.18),transparent)]" />
            <svg className="absolute inset-0" viewBox="0 0 164 76" fill="none">
                <path d="M30 52 L82 26 L134 52" stroke="url(#link)" strokeWidth="1" strokeDasharray="2 3" />
                <path d="M30 52 L134 52" stroke="url(#link)" strokeWidth="1" strokeDasharray="2 3" opacity="0.6" />
                <defs>
                    <linearGradient id="link" x1="0" x2="164" y1="0" y2="0" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#60a5fa" stopOpacity="0.15" />
                        <stop offset="0.5" stopColor="#60a5fa" stopOpacity="0.7" />
                        <stop offset="1" stopColor="#60a5fa" stopOpacity="0.15" />
                    </linearGradient>
                </defs>
            </svg>
            <div className={`${tile} left-[10px] top-[32px] bg-white/[0.04] border-white/10`}>
                <Smartphone className="w-4 h-4 text-white/60" strokeWidth={2} />
            </div>
            <div className={`${tile} left-[62px] top-[6px] w-10 h-10 bg-blue-500/15 border-blue-400/30 shadow-[0_0_24px_rgba(59,130,246,0.25)]`}>
                <Monitor className="w-[18px] h-[18px] text-blue-300" strokeWidth={2} />
            </div>
            <div className={`${tile} left-[114px] top-[32px] bg-white/[0.04] border-white/10`}>
                <Laptop className="w-4 h-4 text-white/60" strokeWidth={2} />
            </div>
        </div>
    );
}

// --- Loading and failure -----------------------------------------------------------

function Skeleton() {
    return (
        <div className="flex flex-col gap-3" role="status" aria-label="Loading your devices">
            <div className="flex items-end justify-between px-1">
                <div className="flex flex-col gap-1.5">
                    <span className="skeleton block w-24 h-2.5 rounded" />
                    <span className="skeleton block w-32 h-2 rounded" />
                </div>
                <span className="skeleton block w-16 h-5 rounded-full" />
            </div>
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] divide-y divide-white/[0.05]">
                {[0, 1, 2].map(i => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                        <span className="skeleton block w-8 h-8 rounded-xl" />
                        <div className="flex flex-col gap-1.5">
                            <span className="skeleton block h-2.5 rounded" style={{ width: 110 - i * 18 }} />
                            <span className="skeleton block w-16 h-2 rounded" />
                        </div>
                    </div>
                ))}
            </div>
            <span className="skeleton block h-14 rounded-2xl" />
        </div>
    );
}

function LoadFailed({ detail, retrying, onRetry }: { detail: string; retrying: boolean; onRetry: () => void }) {
    return (
        <div className="rise flex flex-col items-center text-center gap-3 pt-6 px-2" role="alert">
            <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-400/20 flex items-center justify-center">
                <CircleAlert className="w-5 h-5 text-red-300" strokeWidth={2} aria-hidden />
            </div>
            <div>
                <p className="text-[13px] font-bold text-white/90 leading-tight">Your devices didn't load</p>
                <p className="text-[11px] text-white/55 leading-snug mt-1.5">
                    Passer couldn't read this PC's device settings. Try again, or restart Passer if it keeps happening.
                </p>
            </div>
            <p className="w-full px-2.5 py-2 rounded-xl bg-black/40 border border-white/[0.06] text-[10px] font-mono text-white/50 break-words select-text text-left">
                {detail}
            </p>
            <Action onClick={onRetry} busy={retrying} className="w-full"
                icon={<RefreshCw className="w-3 h-3" strokeWidth={2.5} aria-hidden />}>
                Try again
            </Action>
        </div>
    );
}
