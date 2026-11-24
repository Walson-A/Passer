import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
    ArrowDownLeft, ArrowUpRight, Check, ChevronRight, KeyRound, Laptop, Lock, Monitor, QrCode, RefreshCw, ShieldCheck,
    Smartphone, Trash2, WifiOff, X, CircleAlert, Link2,
} from "lucide-react";
import { DeviceInvite, InlineError } from "./DeviceInvite";
import { DeviceRender } from "./DeviceRender";
import { DeviceStage } from "./DeviceStage";
import { DeviceFiles } from "./DeviceFiles";
import { useCapabilities } from "../hooks/useCapabilities";
import type { HistoryItem } from "../hooks/useHistory";
import {
    Action, CAPABILITY_WORDS, FOCUS, SasDigits, isRecent, kindOfMember, osLabel, screenFor, seenLabel, thisOs,
    type DevicesStatus, type Joined, type JournalLine, type Member,
} from "./deviceUi";

interface Props {
    /** True while this is the visible view. */
    active: boolean;
    /** Everything that passed between devices and this PC, newest first. */
    history: HistoryItem[];
    /** Shows the Passboard filtered on one device. */
    onOpenPassboard: (deviceId: string) => void;
}

interface Failure {
    text: string;
    detail: string;
}

/**
 * The Devices space - "Showroom", the direction Walson chose (A3 in
 * /directions.html): every device in one horizontal strip, the chosen one alone
 * on stage with what it can do, its details and removal in a side panel. Adding
 * a device opens the invitation as a dialog. Every name on this screen was
 * chosen by some device, possibly another one, and is rendered as plain text.
 */
export function Devices({ active, history, onOpenPassboard }: Props) {
    const [status, setStatus] = useState<DevicesStatus | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [retrying, setRetrying] = useState(false);
    const [failure, setFailure] = useState<Failure | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [inviteOpen, setInviteOpen] = useState(false);
    const [joined, setJoined] = useState<Joined | null>(null);
    const [joinSas, setJoinSas] = useState<string | null>(null);
    const [selected, setSelected] = useState<string | null>(null);
    const [details, setDetails] = useState<{ id: string; confirm: boolean } | null>(null);
    const [refreshing, setRefreshing] = useState(false);

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

    // Ask every member what it is and offers (`devices_refresh`, never an
    // approval on the other side), then read the updated list.
    const refreshMembers = useCallback(async () => {
        setRefreshing(true);
        try {
            await invoke<number>("devices_refresh");
        } catch {
            // Not running, or nobody answered: the list says what it knows.
        } finally {
            await refresh();
            setRefreshing(false);
        }
    }, [refresh]);

    useEffect(() => {
        if (!active) return;
        refreshMembers();
        const t = setInterval(refreshMembers, 60_000);
        return () => clearInterval(t);
    }, [active, refreshMembers]);

    // A member answered for the first time after joining.
    useEffect(() => {
        let off: (() => void) | undefined;
        let alive = true;
        (async () => {
            const un = await listen("devices-changed", () => { refresh(); });
            if (alive) off = un; else un();
        })();
        return () => { alive = false; off?.(); };
    }, [refresh]);

    // Load on arrival, then keep the state honest while the view is in front.
    useEffect(() => {
        if (!active) {
            // Never leave a secret code, or an armed removal, behind a view the
            // user navigated away from.
            setInviteOpen(false);
            setDetails(null);
            return;
        }
        refresh();
        const t = setInterval(refresh, 8000);
        return () => clearInterval(t);
    }, [active, refresh]);

    // A device joined through our invitation: show the code to compare, and put
    // the newcomer on stage.
    useEffect(() => {
        let off: (() => void) | undefined;
        let alive = true;
        (async () => {
            const un = await listen<Joined>("device-joined", async (e) => {
                setInviteOpen(false);
                setJoined(e.payload);
                const next = await refresh();
                const m = next?.members.find(x => x.short_id === e.payload.id);
                if (m) setSelected(m.id);
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
        setDetails(null);
        await refresh();
    });

    // "The codes don't match": open that device's details with the removal armed.
    const mismatch = async (j: Joined) => {
        setJoined(null);
        const list = (await refresh())?.members ?? status?.members ?? [];
        const m = list.find(x => x.short_id === j.id);
        if (!m) return;
        setSelected(m.id);
        setDetails({ id: m.id, confirm: true });
    };

    const closeInvite = useCallback(() => setInviteOpen(false), []);
    const closeDetails = useCallback(() => setDetails(null), []);

    // --- Without a group, or before one is known -----------------------------------

    if (!status || !status.group) {
        return (
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="w-full max-w-[440px] mx-auto px-4 pt-12 pb-8 flex flex-col gap-3 [&>*]:shrink-0" aria-busy={!status && !loadError}>
                    {!status && loadError ? (
                        <LoadFailed detail={loadError} retrying={retrying} onRetry={retry} />
                    ) : !status ? (
                        <Skeleton />
                    ) : (
                        <Welcome
                            busy={busy}
                            failure={failure}
                            onStart={createGroup}
                            onJoined={async (sas) => {
                                setJoinSas(sas);
                                await refresh();
                            }}
                        />
                    )}
                </div>
            </div>
        );
    }

    // --- In a group ------------------------------------------------------------------

    const members = sortMembers(status.members);
    const me = members.find(m => m.this_device);
    const canManage = !!me?.approver;
    const others = members.length - 1;
    const current = members.find(m => m.id === selected) ?? members.find(m => !m.this_device) ?? members[0];
    const inDetails = details ? members.find(m => m.id === details.id) ?? null : null;
    const approvers = members.filter(m => m.approver && !m.this_device);

    return (
        // `overflow-clip`, not `hidden`: an overflow-hidden box can still be
        // scrolled by scrollIntoView, which slid the whole view sideways once.
        <div className="relative flex-1 flex flex-col min-h-0 overflow-clip">
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col gap-5 px-8 pt-6 pb-5 [&>*]:shrink-0">
                {/* Header */}
                <div className="flex items-end justify-between gap-4">
                    <div className="min-w-0">
                        <h1 className="text-[12px] font-black uppercase tracking-[0.22em] text-white/75 truncate">{status.group}</h1>
                        <p className="text-[13px] text-white/55 mt-1.5">
                            {others === 0 ? "Only this PC so far" : `This PC and ${others} other device${others > 1 ? "s" : ""}`}
                        </p>
                    </div>
                    {canManage ? (
                        <button
                            onClick={() => setInviteOpen(true)}
                            disabled={!status.running}
                            title={status.running ? undefined : "This PC needs to be online to invite a device"}
                            className={`shrink-0 flex items-center gap-2 h-9 px-4 rounded-xl border border-blue-400/40 bg-blue-500/20 text-[12px] font-semibold text-blue-50 hover:bg-blue-500/30 hover:border-blue-400/60 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${FOCUS}`}
                        >
                            <QrCode className="w-4 h-4" strokeWidth={2} aria-hidden /> Add a device
                        </button>
                    ) : (
                        <p className="shrink-0 flex items-center gap-1.5 text-[12px] text-white/55 max-w-[320px] text-right">
                            <KeyRound className="w-3.5 h-3.5 shrink-0" strokeWidth={2} aria-hidden />
                            {approvers.length > 0 ? <>To add a device, use {listNames(approvers.map(a => a.name))}.</> : "This PC can't add devices."}
                        </p>
                    )}
                </div>

                {/* Codes to compare after a join */}
                {joinSas && (
                    <SasBanner
                        title={`This PC joined ${status.group}`}
                        text="The device that invited this PC shows a code too. If it's not this one, remove this PC from that device."
                        sas={joinSas}
                    >
                        <Action tone="success" className="w-[150px]" onClick={() => setJoinSas(null)}
                            icon={<Check className="w-3 h-3" strokeWidth={2.5} aria-hidden />}>
                            Done
                        </Action>
                    </SasBanner>
                )}
                {joined && (
                    <SasBanner
                        title={`${joined.name} joined`}
                        text={`Check that ${joined.name} shows this same code. That proves it's really your device.`}
                        sas={joined.sas}
                    >
                        <Action className="w-[150px]" onClick={() => mismatch(joined)}>It's different</Action>
                        <Action tone="success" className="w-[150px]" onClick={() => setJoined(null)}
                            icon={<Check className="w-3 h-3" strokeWidth={2.5} aria-hidden />}>
                            It matches
                        </Action>
                    </SasBanner>
                )}

                {!status.running && (
                    <div className="rise flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-500/[0.06] border border-amber-400/15" role="status">
                        <WifiOff className="w-4 h-4 text-amber-300/90 shrink-0" strokeWidth={2} aria-hidden />
                        <p className="flex-1 text-[13px] text-amber-100/85">
                            <span className="font-bold">This PC is offline.</span> Your other devices can't reach it until it reconnects.
                        </p>
                        <button
                            onClick={retry}
                            className={`shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-semibold text-amber-100/85 hover:bg-amber-400/10 transition-all cursor-pointer ${FOCUS}`}
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${retrying ? "animate-spin" : ""}`} strokeWidth={2.25} aria-hidden /> Check again
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

                {/* Every device, at a glance */}
                <div role="tablist" aria-label="Your devices" className="flex gap-3 overflow-x-auto custom-scrollbar pb-1 -mb-1">
                    {members.map((m, i) => (
                        <DeviceCard key={m.id} member={m} index={i} on={m.id === current.id} onSelect={() => setSelected(m.id)} />
                    ))}
                </div>

                {/* The chosen one */}
                <DeviceStage member={current} running={status.running} onRefresh={refreshMembers} refreshing={refreshing}
                    last={history.find(h => h.deviceId === current.id)} onOpenPassboard={() => onOpenPassboard(current.id)} />

                {/* Files, per device: what it shares, or what this PC shares. */}
                <CurrentFiles member={current} />

                <div className="flex items-center gap-4 -mt-1">
                    <button
                        onClick={() => setDetails({ id: current.id, confirm: false })}
                        className={`shrink-0 flex items-center gap-1 text-[12px] font-semibold text-white/60 hover:text-white transition-colors cursor-pointer rounded ${FOCUS}`}
                    >
                        Details{canManage && !current.this_device ? " and removal" : ""} <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden />
                    </button>
                    <div className="ml-auto max-w-[520px]"><Footnote preview={status.development_network} /></div>
                </div>
            </div>

            {/* Details, sliding in from the right */}
            {inDetails && (
                <DetailsPanel
                    member={inDetails}
                    canRemove={canManage && !inDetails.this_device}
                    confirm={!!details?.confirm}
                    busy={busy === `remove:${inDetails.id}`}
                    onArm={() => setDetails(d => (d ? { ...d, confirm: true } : d))}
                    onDisarm={() => setDetails(d => (d ? { ...d, confirm: false } : d))}
                    onRemove={() => remove(inDetails)}
                    onClose={closeDetails}
                />
            )}

            {/* Adding a device: a dialog over the view */}
            {inviteOpen && (
                <div className="absolute inset-0 z-[400] flex items-center justify-center p-6">
                    <div className="scrim-in absolute inset-0 bg-black/60" onClick={closeInvite} aria-hidden />
                    <div className="sheet-in relative w-[440px] max-h-full h-[600px] flex flex-col rounded-3xl overflow-hidden border border-white/10 shadow-[0_24px_70px_rgba(0,0,0,0.6)]" role="dialog" aria-modal="true" aria-label="Add a device">
                        <DeviceInvite open={inviteOpen} connected={status.running} onClose={closeInvite} />
                    </div>
                </div>
            )}
        </div>
    );
}

/** The files panel of the device on stage, once we know whether it shares any. */
function CurrentFiles({ member }: { member: Member }) {
    const caps = useCapabilities(member.this_device ? null : member.id, member.answered_at);
    return <DeviceFiles key={member.id} member={member} offersList={!!caps?.caps?.some(c => c.name === "file.list")} />;
}

/** Other devices first (the ones that manage the group, then by name), this PC last. */
function sortMembers(members: Member[]) {
    return [...members].sort((a, b) =>
        Number(a.this_device) - Number(b.this_device)
        || Number(b.approver) - Number(a.approver)
        || a.name.localeCompare(b.name));
}

function listNames(names: string[]) {
    if (names.length <= 1) return names[0] ?? "";
    return `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
}

function DeviceCard({ member: m, index, on, onSelect }: { member: Member; index: number; on: boolean; onSelect: () => void }) {
    const kind = kindOfMember(m);
    const recent = m.this_device || isRecent(m.answered_at);
    return (
        <button
            role="tab"
            aria-selected={on}
            onClick={onSelect}
            style={{ ["--i" as string]: index }}
            className={`rise w-[210px] shrink-0 flex items-center gap-3 p-2.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer active:scale-[0.99] ${FOCUS}
                ${on
                    ? "bg-white/[0.07] border-blue-400/40 shadow-[0_0_0_1px_rgba(96,165,250,0.15),0_8px_24px_rgba(59,130,246,0.12)]"
                    : "bg-white/[0.025] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/12"}`}
        >
            <span className="w-11 h-11 shrink-0 rounded-xl bg-black/25 flex items-end justify-center pb-1 overflow-hidden" aria-hidden>
                <DeviceRender kind={kind} screen={screenFor(m.id)} size={kind === "phone" || kind === "tablet" ? 0.13 : 0.1} dim={!recent} />
            </span>
            <span className="min-w-0">
                <span className={`block text-[13px] font-semibold truncate ${recent ? "text-white/90" : "text-white/65"}`} title={m.name}>{m.name}</span>
                <span className="flex items-center gap-1.5 mt-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${recent ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" : "bg-white/30"}`} aria-hidden />
                    <span className="text-[12px] text-white/55 truncate">{m.this_device ? "This PC" : seenLabel(m.answered_at)}</span>
                </span>
            </span>
        </button>
    );
}

function DetailsPanel({ member: m, canRemove, confirm, busy, onArm, onDisarm, onRemove, onClose }: {
    member: Member;
    canRemove: boolean;
    confirm: boolean;
    busy: boolean;
    onArm: () => void;
    onDisarm: () => void;
    onRemove: () => void;
    onClose: () => void;
}) {
    const [journal, setJournal] = useState<JournalLine[] | null>(null);
    useEffect(() => {
        let alive = true;
        invoke<JournalLine[]>("devices_journal", m.this_device ? { limit: 30 } : { id: m.id, limit: 30 })
            .then(l => { if (alive) setJournal(l); })
            .catch(() => { if (alive) setJournal([]); });
        return () => { alive = false; };
    }, [m.id, m.this_device]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    const rows: [string, React.ReactNode][] = [
        ["Role", m.approver
            ? <span className="inline-flex items-center gap-1 text-amber-200/90"><ShieldCheck className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden />Manages devices</span>
            : "Sends and receives"],
        ["Device ID", <span className="font-mono">{m.short_id}</span>],
    ];
    const os = m.os ?? (m.this_device ? thisOs() : null);
    if (os) rows.push(["System", `${osLabel(os)}${m.os_version ? ` ${m.os_version}` : ""}`]);
    if (m.app_version) rows.push(["Passer", m.app_version]);
    if (m.core_version) rows.push(["passer-core", m.core_version]);
    if (!m.this_device) rows.push(["Last answered", seenLabel(m.answered_at).replace(/^Seen /, "")]);

    return (
        <div className="absolute inset-0 z-[300] flex justify-end">
            <div className="scrim-in absolute inset-0 bg-black/45" onClick={onClose} aria-hidden />
            <aside className="sheet-in relative w-[380px] h-full bg-[#161616] border-l border-white/[0.08] shadow-[-20px_0_60px_rgba(0,0,0,0.5)] flex flex-col" role="dialog" aria-modal="true" aria-label={`${m.name}, details`}>
                <div className="flex items-start gap-3 px-6 pt-6 pb-4">
                    <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/50">Details</p>
                        <h2 className="text-[20px] font-bold leading-tight mt-1.5 break-words">{m.name}</h2>
                    </div>
                    <button onClick={onClose} aria-label="Close" autoFocus
                        className={`shrink-0 p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all cursor-pointer ${FOCUS}`}>
                        <X className="w-4 h-4" strokeWidth={2.25} aria-hidden />
                    </button>
                </div>

                <dl className="mx-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] divide-y divide-white/[0.05]">
                    {rows.map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between gap-4 px-4 py-3">
                            <dt className="text-[12px] text-white/55">{k}</dt>
                            <dd className="text-[13px] font-semibold text-white/85 text-right min-w-0 break-words">{v}</dd>
                        </div>
                    ))}
                </dl>

                <div className="flex-1 min-h-0 flex flex-col mt-5">
                    <h3 className="px-6 text-[11px] font-black uppercase tracking-[0.18em] text-white/50">
                        {m.this_device ? "Calls on this PC" : "Between it and this PC"}
                    </h3>
                    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-6 pt-2.5 pb-3">
                        {journal === null ? (
                            <div className="flex flex-col gap-2" role="status" aria-label="Loading the history">
                                {[0, 1, 2].map(i => <span key={i} className="skeleton block h-10 rounded-xl" />)}
                            </div>
                        ) : journal.length === 0 ? (
                            <p className="text-[12px] text-white/45 leading-snug">Nothing yet. Every request between your devices shows up here, never what was sent.</p>
                        ) : (
                            <ol className="flex flex-col gap-1">
                                {journal.map(l => <JournalRow key={`${l.seq}-${l.outgoing}`} line={l} showPeer={m.this_device} />)}
                            </ol>
                        )}
                    </div>
                </div>

                <div className="shrink-0 px-6 pb-6 pt-2">
                    {m.this_device ? (
                        <p className="text-[12px] text-white/50">This is the PC you're on.</p>
                    ) : !canRemove ? (
                        <p className="text-[12px] text-white/50">Only a device that manages your devices can remove it.</p>
                    ) : confirm ? (
                        <div className="rise p-3.5 rounded-2xl bg-red-500/[0.08] border border-red-400/20 flex flex-col gap-3" role="alertdialog" aria-label={`Remove ${m.name}?`}>
                            <p className="text-[13px] text-red-100/85 leading-snug">
                                <span className="font-bold text-red-100">Remove {m.name}?</span> It loses access to your devices right away. You can add it back later.
                            </p>
                            <div className="flex gap-2">
                                <Action className="flex-1" onClick={onDisarm} autoFocus>Cancel</Action>
                                <Action className="flex-1" tone="danger" busy={busy} onClick={onRemove}
                                    icon={<Trash2 className="w-3 h-3" strokeWidth={2.5} aria-hidden />}>
                                    Remove
                                </Action>
                            </div>
                        </div>
                    ) : (
                        <Action className="w-full" onClick={onArm} icon={<Trash2 className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden />}>
                            Remove from my devices
                        </Action>
                    )}
                </div>
            </aside>
        </div>
    );
}

/** One journal line, in words: who, what, and how it ended. Never the content. */
function JournalRow({ line: l, showPeer }: { line: JournalLine; showPeer: boolean }) {
    const what = CAPABILITY_WORDS[l.capability] ?? l.capability;
    const who = l.outgoing
        ? (showPeer ? `This PC asked ${l.peer_name}` : "This PC asked")
        : l.agent ? `${l.agent} (on ${l.peer_name}) asked` : `${l.peer_name} asked`;
    let result: { text: string; tone: string };
    if (l.decision === "deny") result = { text: "Not allowed", tone: "text-red-200/80" };
    else if (l.approved === false) result = { text: "Refused", tone: "text-red-200/80" };
    else if (l.outcome !== "ok") result = { text: l.outcome === "denied" ? "Refused" : "Didn't go through", tone: "text-white/50" };
    else if (l.approved === true) result = { text: "Allowed once", tone: "text-blue-200/85" };
    else result = { text: "Done", tone: "text-emerald-300/85" };
    const Icon = l.outgoing ? ArrowUpRight : ArrowDownLeft;
    return (
        <li className="flex items-start gap-2.5 py-2">
            <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${l.outgoing ? "text-blue-300/80" : "text-white/50"}`} strokeWidth={2.25} aria-label={l.outgoing ? "Sent" : "Received"} />
            <div className="min-w-0 flex-1">
                <p className="text-[13px] text-white/85 leading-snug break-words">
                    <span className="text-white/55">{who}: </span>{what}
                </p>
                <p className="text-[11px] mt-0.5"><span className={`font-semibold ${result.tone}`}>{result.text}</span><span className="text-white/40"> · {timeLabel(l.at)}</span></p>
            </div>
        </li>
    );
}

function timeLabel(at: number) {
    const d = new Date(at * 1000);
    const today = new Date();
    const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.toDateString() === today.toDateString() ? time : `${d.toLocaleDateString([], { day: "numeric", month: "short" })} ${time}`;
}

function SasBanner({ title, text, sas, children }: { title: string; text: string; sas: string; children: React.ReactNode }) {
    return (
        <section className="rise flex items-center gap-6 px-5 py-4 rounded-2xl bg-emerald-500/[0.06] border border-emerald-400/20" aria-label={title}>
            <div className="shrink-0 w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-400/25 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-emerald-300" strokeWidth={2} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold text-white/90 leading-tight break-words">{title}</p>
                <p className="text-[12px] text-white/60 leading-snug mt-1 break-words">{text}</p>
            </div>
            <SasDigits sas={sas} />
            <div className="shrink-0 flex gap-2">{children}</div>
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
