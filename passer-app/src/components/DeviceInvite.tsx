import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeftRight, Check, ChevronLeft, Clock, Link2, QrCode, RotateCcw, ShieldAlert, ShieldCheck } from "lucide-react";
import { Action, FOCUS } from "./deviceUi";

/** The backend creates invitations valid this long (`devices.invite(10, …)`). */
const INVITE_MINUTES = 10;

interface Props {
    open: boolean;
    /** False while this PC's device network is down: no invitation can be made. */
    connected: boolean;
    onClose: () => void;
}

type Role = "member" | "approver";

/**
 * "Add a device", one level below the Devices tab (it pushes in from the right,
 * like Pair a device under Settings). Two steps: choose what the new device may
 * do, then show the one-time code. The role comes first because it is baked
 * into the invitation - changing it afterwards would mean a second live code.
 */
export function DeviceInvite({ open, connected, onClose }: Props) {
    const [role, setRole] = useState<Role>("member");
    const [link, setLink] = useState<string | null>(null);
    const [expiresAt, setExpiresAt] = useState(0);
    const [now, setNow] = useState(() => Date.now());
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const backRef = useRef<HTMLButtonElement>(null);

    // Leaving drops the code: a secret must never linger on a screen behind
    // the one the user is looking at.
    useEffect(() => {
        if (open) {
            backRef.current?.focus({ preventScroll: true });
            return;
        }
        setLink(null);
        setError(null);
        setCopied(false);
        setRole("member");
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    useEffect(() => {
        if (!link) return;
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, [link]);

    const create = async () => {
        if (busy) return;
        setBusy(true);
        setError(null);
        try {
            const next = await invoke<string>("devices_invite", { approver: role === "approver" });
            const t = Date.now();
            setNow(t);
            setExpiresAt(t + INVITE_MINUTES * 60_000);
            setLink(next);
        } catch (e) {
            setError(String(e));
        } finally {
            setBusy(false);
        }
    };

    const copy = () => {
        if (!link) return;
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const left = Math.max(0, Math.ceil((expiresAt - now) / 1000));
    const expired = !!link && left === 0;
    const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;

    return (
        // Opaque: this layer slides over the list beneath it.
        <div className="flex-1 flex flex-col min-h-0 bg-[#141414]" role="region" aria-label="Add a device">
            <div className="shrink-0 flex items-center gap-1 px-3 pt-4 pb-3">
                <button
                    ref={backRef}
                    onClick={onClose}
                    className={`flex items-center gap-0.5 py-1 pr-2 pl-1 rounded-lg text-white/55 hover:text-white hover:bg-white/[0.06] transition-all duration-200 active:scale-95 cursor-pointer ${FOCUS}`}
                >
                    <ChevronLeft className="w-4 h-4" strokeWidth={2.5} aria-hidden />
                    <span className="text-[10px] font-bold">Devices</span>
                </button>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70 ml-1">
                    Add a device
                </span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-3 flex flex-col gap-2.5 [&>*]:shrink-0">
                {!link ? (
                    <>
                        <div className="px-1">
                            <p className="text-[12px] font-bold text-white/90 leading-tight">What can the new device do?</p>
                            <p className="text-[10px] text-white/55 leading-snug mt-1">
                                It will be able to send things to this PC either way.
                            </p>
                        </div>

                        <div role="radiogroup" aria-label="What the new device can do" className="flex flex-col gap-2">
                            <RoleOption
                                checked={role === "member"}
                                onSelect={() => setRole("member")}
                                icon={<ArrowLeftRight className="w-4 h-4 text-blue-300" strokeWidth={2} aria-hidden />}
                                tint="bg-blue-500/15 border-blue-400/25"
                                title="Send and receive"
                                text="Shares the clipboard and files with your devices."
                            />
                            <RoleOption
                                checked={role === "approver"}
                                onSelect={() => setRole("approver")}
                                icon={<ShieldCheck className="w-4 h-4 text-amber-300" strokeWidth={2} aria-hidden />}
                                tint="bg-amber-500/15 border-amber-400/25"
                                title="Also add and remove devices"
                                text="Only for your own phone or computer."
                            />
                        </div>

                        {error && <InlineError text="The invitation couldn't be created." detail={error} />}
                        {!connected && !error && (
                            <p className="text-[10px] text-amber-200/80 leading-snug px-1" role="status">
                                This PC isn't connected right now, so it can't invite anyone.
                            </p>
                        )}

                        <Action
                            tone="primary"
                            onClick={create}
                            busy={busy}
                            disabled={!connected}
                            icon={<QrCode className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden />}
                            className="mt-1"
                        >
                            Show the code
                        </Action>
                    </>
                ) : (
                    <>
                        {/* Light plate keeps the code scannable against the dark UI */}
                        <div className="rise relative flex items-center justify-center p-3 rounded-2xl bg-white self-center">
                            <div className={expired ? "opacity-10 blur-[3px] transition-all duration-300" : "transition-all duration-300"}>
                                <QRCodeSVG value={link} size={156} level="M" marginSize={0} aria-label="Invitation code" />
                            </div>
                            {expired && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5">
                                    <p className="text-[11px] font-black uppercase tracking-widest text-black/70">Expired</p>
                                    <button
                                        onClick={create}
                                        disabled={busy}
                                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black text-white text-[9px] font-black uppercase tracking-widest active:scale-[0.98] cursor-pointer disabled:opacity-40 ${FOCUS}`}
                                    >
                                        <RotateCcw className="w-3 h-3" strokeWidth={2.5} aria-hidden />
                                        New code
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="text-center px-2">
                            <p className="text-[10px] text-white/70 leading-snug">
                                Scan it with Passer on the new device, or paste the link there.
                            </p>
                            <p className={`flex items-center justify-center gap-1 text-[9px] font-semibold mt-1.5 tabular-nums ${expired ? "text-red-300/90" : "text-white/55"}`}>
                                <Clock className="w-3 h-3" strokeWidth={2} aria-hidden />
                                {expired ? "This code has expired" : `Works once · ${clock} left`}
                                {role === "approver" && !expired && (
                                    <span className="flex items-center gap-0.5 ml-1 text-amber-200/85" title="It will be able to add and remove devices">
                                        <ShieldCheck className="w-3 h-3" strokeWidth={2} aria-hidden />
                                        Manages devices
                                    </span>
                                )}
                            </p>
                        </div>

                        <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-amber-500/[0.07] border border-amber-400/15">
                            <ShieldAlert className="w-3.5 h-3.5 text-amber-400/90 shrink-0" strokeWidth={2} aria-hidden />
                            <p className="text-[9.5px] text-amber-100/80 leading-snug">
                                Anyone who scans it joins your devices. Don't share it.
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <Action
                                className="flex-1"
                                tone={copied ? "success" : "neutral"}
                                onClick={copy}
                                disabled={expired}
                                icon={copied
                                    ? <Check className="w-3 h-3" strokeWidth={2.5} aria-hidden />
                                    : <Link2 className="w-3 h-3" strokeWidth={2.5} aria-hidden />}
                            >
                                {copied ? "Copied" : "Copy link"}
                            </Action>
                            <Action className="flex-1" onClick={onClose}>Done</Action>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function RoleOption({ checked, onSelect, icon, tint, title, text }: {
    checked: boolean;
    onSelect: () => void;
    icon: React.ReactNode;
    tint: string;
    title: string;
    text: string;
}) {
    return (
        <button
            role="radio"
            aria-checked={checked}
            onClick={onSelect}
            className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-all duration-200 active:scale-[0.99] cursor-pointer ${FOCUS}
                ${checked
                    ? "bg-blue-500/[0.08] border-blue-400/40"
                    : "bg-white/[0.03] border-white/[0.06] hover:border-white/15"}`}
        >
            <div className={`shrink-0 w-8 h-8 rounded-xl border flex items-center justify-center ${tint}`}>{icon}</div>
            <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-white/90 leading-tight">{title}</p>
                <p className="text-[9.5px] text-white/55 leading-snug mt-0.5">{text}</p>
            </div>
            <span
                aria-hidden
                className={`shrink-0 w-4 h-4 rounded-full border flex items-center justify-center transition-all duration-200
                    ${checked ? "border-blue-400 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.45)]" : "border-white/25"}`}
            >
                {checked && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
            </span>
        </button>
    );
}

/** An error next to the action that caused it: what happened, then the raw detail. */
export function InlineError({ text, detail, action }: { text: string; detail?: string; action?: React.ReactNode }) {
    return (
        <div role="alert" className="rise flex flex-col gap-1.5 p-2.5 rounded-xl bg-red-500/[0.08] border border-red-400/20">
            <p className="text-[10px] font-bold text-red-200 leading-snug">{text}</p>
            {detail && (
                <p className="text-[9px] font-mono text-red-100/60 leading-relaxed break-words select-text">{detail}</p>
            )}
            {action}
        </div>
    );
}
