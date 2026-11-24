import { useEffect, useRef, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Check, Clipboard, Loader2, Lock, Paperclip, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { DeviceRender } from "./DeviceRender";
import { InlineError } from "./DeviceInvite";
import { FOCUS, isRecent, kindOfMember, osLabel, screenFor, seenLabel, thisOs, type Member } from "./deviceUi";
import { useCapabilities } from "../hooks/useCapabilities";

const MAX_FILE = 700 * 1024;

type CommandId = "file" | "send-clipboard" | "get-clipboard";
type CommandState =
    | { id: CommandId; phase: "busy" }
    | { id: CommandId; phase: "done"; text: string }
    | { id: CommandId; phase: "error"; text: string; detail: string };

/**
 * The chosen device, alone on stage: drawn large, its state and name beside it,
 * and only the commands it offers this PC - `devices_capabilities` says which,
 * and which ask its user first. A device that offers nothing to call (a phone,
 * today) gets a sentence instead of buttons that would fail.
 */
export function DeviceStage({ member: m, running, onRefresh, refreshing }: {
    member: Member;
    running: boolean;
    /** Ask every member again (`devices_refresh`). */
    onRefresh: () => void;
    refreshing: boolean;
}) {
    const caps = useCapabilities(m.this_device ? null : m.id, m.answered_at);
    const os = m.os ?? (m.this_device ? thisOs() : undefined);
    const kind = kindOfMember(m);
    const reachable = m.this_device ? running : isRecent(m.answered_at);
    const offers = (name: string) => caps?.caps?.find(c => c.name === name);
    const getCap = offers("clipboard.read");
    const anything = !!(offers("file.receive") || offers("clipboard.write") || getCap);
    const [command, setCommand] = useState<CommandState | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    // A result belongs to the device it was for.
    useEffect(() => setCommand(null), [m.id]);

    const run = async (id: CommandId, fn: () => Promise<string>, failText: string) => {
        if (command?.phase === "busy") return;
        setCommand({ id, phase: "busy" });
        try {
            const text = await fn();
            setCommand({ id, phase: "done", text });
            setTimeout(() => setCommand(c => (c?.id === id && c.phase === "done" ? null : c)), 3000);
        } catch (e) {
            setCommand({ id, phase: "error", text: failText, detail: String(e) });
        }
    };

    const sendFile = (file: File) => run("file", async () => {
        if (file.size > MAX_FILE) throw new Error(`${file.name} is ${(file.size / 1024).toFixed(0)} KB; for now, files up to 700 KB can go this way.`);
        const data = await new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
            r.onerror = () => reject(r.error);
            r.readAsDataURL(file);
        });
        await invoke("devices_send_file", { id: m.id, name: file.name, dataBase64: data });
        return `${file.name} sent`;
    }, "The file didn't go through.");

    const sendClipboard = () => run("send-clipboard", async () => {
        await invoke("devices_send_clipboard", { id: m.id });
        return "Your clipboard is on it";
    }, "Your clipboard didn't go through.");

    const getClipboard = () => run("get-clipboard", async () => {
        const n = await invoke<number>("devices_get_clipboard", { id: m.id });
        return n === 0 ? "Its clipboard was empty" : "Copied here";
    }, `${m.name} didn't share its clipboard.`);

    return (
        <section
            className="relative flex-1 min-h-[360px] rounded-3xl overflow-hidden border border-white/[0.05] bg-[radial-gradient(ellipse_at_38%_50%,rgba(96,165,250,0.15),rgba(168,85,247,0.05)_40%,transparent_68%)]"
            aria-label={m.name}
        >
            <div key={m.id} className="rise absolute inset-0 flex items-center justify-center gap-14 px-8">
                <div className="relative shrink-0 flex justify-center">
                    <div className="drop-shadow-[0_28px_36px_rgba(0,0,0,0.6)]">
                        <DeviceRender kind={kind} screen={screenFor(m.id)} size={kind === "phone" ? 1 : 0.95} dim={!reachable} />
                    </div>
                    <div className="absolute -bottom-3 w-[160px] h-5 rounded-[50%] bg-black/60 blur-xl" />
                </div>

                <div className="w-[360px] min-w-0">
                    <StateChip member={m} running={running} />
                    <h2 className="text-[32px] leading-[1.08] font-bold tracking-tight mt-3 break-words">{m.name}</h2>
                    <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                        {osLabel(os) && <span className="text-[13px] text-white/60">{osLabel(os)}{m.os_version ? ` ${m.os_version}` : ""}</span>}
                        {m.approver && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-400/20 text-[11px] font-bold text-amber-200/90" title="Can add and remove devices">
                                <ShieldCheck className="w-3 h-3" strokeWidth={2.5} aria-hidden /> Manages devices
                            </span>
                        )}
                    </div>

                    <div className="mt-8">
                        {m.this_device ? (
                            <Note>This is the PC you're on. Your other devices send here; choose one above to send to it.</Note>
                        ) : !running ? (
                            <Note>This PC is offline, so it can't reach {m.name}.</Note>
                        ) : caps === undefined ? (
                            <div className="flex gap-5" aria-label="Checking what it can do" role="status">
                                {[0, 1, 2].map(i => <span key={i} className="skeleton block w-[58px] h-[58px] rounded-full" />)}
                            </div>
                        ) : !anything ? (
                            <div className="flex flex-col items-start gap-3">
                                <Note>
                                    {m.answered_at === null
                                        ? `Passer hasn't heard from ${m.name} yet. It may be asleep or off the network.`
                                        : `${m.name} can send things to this PC, but offers nothing this PC can ask of it yet.`}
                                </Note>
                                <button
                                    onClick={onRefresh}
                                    disabled={refreshing}
                                    className={`flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-white/10 bg-white/[0.04] text-[12px] font-semibold text-white/80 hover:text-white hover:border-white/20 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 ${FOCUS}`}
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} strokeWidth={2.25} aria-hidden /> Check again
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="flex gap-5">
                                    {offers("file.receive") && (
                                        <Disk icon={<Paperclip className="w-[21px] h-[21px]" strokeWidth={1.75} aria-hidden />} label="Send a file"
                                            locked={offers("file.receive")?.needs_approval} hint={offers("file.receive")?.needs_approval ? "It asks first" : undefined}
                                            state={command?.id === "file" ? command.phase : null} onClick={() => fileRef.current?.click()} />
                                    )}
                                    {offers("clipboard.write") && (
                                        <Disk icon={<Send className="w-[21px] h-[21px]" strokeWidth={1.75} aria-hidden />} label="Send my clipboard"
                                            locked={offers("clipboard.write")?.needs_approval} hint={offers("clipboard.write")?.needs_approval ? "It asks first" : undefined}
                                            state={command?.id === "send-clipboard" ? command.phase : null} onClick={sendClipboard} />
                                    )}
                                    {getCap && (
                                        <Disk icon={<Clipboard className="w-[21px] h-[21px]" strokeWidth={1.75} aria-hidden />} label="Get its clipboard"
                                            locked={getCap.needs_approval} hint={getCap.needs_approval ? "It asks first" : undefined}
                                            state={command?.id === "get-clipboard" ? command.phase : null} onClick={getClipboard} />
                                    )}
                                </div>
                                <input
                                    ref={fileRef}
                                    type="file"
                                    className="hidden"
                                    onChange={e => {
                                        const f = e.target.files?.[0];
                                        e.target.value = "";
                                        if (f) sendFile(f);
                                    }}
                                />
                                <div className="mt-4 min-h-[22px]" aria-live="polite">
                                    {command?.phase === "busy" && command.id === "get-clipboard" && getCap?.needs_approval && (
                                        <p className="text-[12px] text-amber-100/80">Waiting for an answer on {m.name}…</p>
                                    )}
                                    {command?.phase === "done" && (
                                        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-300"><Check className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden />{command.text}</p>
                                    )}
                                    {command?.phase === "error" && (
                                        <InlineError text={command.text} detail={command.detail} />
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}

function StateChip({ member: m, running }: { member: Member; running: boolean }) {
    let dot = "bg-white/30";
    let label: string;
    if (m.this_device) {
        dot = running ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" : "bg-red-500";
        label = running ? "This PC · online" : "This PC · offline";
    } else {
        // passer-core knows when a member last answered, not whether it is up
        // this second (that comes with the coordination server): say exactly that.
        if (isRecent(m.answered_at)) dot = "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]";
        label = seenLabel(m.answered_at);
    }
    return (
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08]" role="status">
            <span className={`w-2 h-2 rounded-full ${dot}`} aria-hidden />
            <span className="text-[12px] font-semibold text-white/75">{label}</span>
        </span>
    );
}

function Disk({ icon, label, hint, locked, state, onClick }: {
    icon: ReactNode;
    label: string;
    hint?: string;
    locked?: boolean;
    state: "busy" | "done" | "error" | null;
    onClick: () => void;
}) {
    return (
        <div className="flex flex-col items-center gap-2 w-[90px]">
            <button
                onClick={onClick}
                disabled={state === "busy"}
                aria-label={label}
                aria-busy={state === "busy" || undefined}
                className={`relative w-[58px] h-[58px] rounded-full flex items-center justify-center border transition-all duration-200 active:scale-95 cursor-pointer disabled:cursor-wait ${FOCUS}
                    ${state === "done"
                        ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-200"
                        : "bg-blue-500/15 border-blue-400/35 text-blue-100 shadow-[0_0_24px_rgba(59,130,246,0.18)] hover:bg-blue-500/25 hover:border-blue-400/55"}`}
            >
                {state === "busy" ? <Loader2 className="w-[21px] h-[21px] animate-spin" strokeWidth={1.75} aria-hidden />
                    : state === "done" ? <Check className="w-[21px] h-[21px]" strokeWidth={2} aria-hidden />
                        : icon}
                {locked && (
                    <span className="absolute -right-0.5 -bottom-0.5 w-5 h-5 rounded-full bg-[#141416] border border-amber-400/40 flex items-center justify-center" aria-hidden>
                        <Lock className="w-2.5 h-2.5 text-amber-300" strokeWidth={2.5} />
                    </span>
                )}
            </button>
            <span className="text-[12px] font-semibold text-white/85 text-center leading-tight">{label}</span>
            {hint && <span className="text-[10px] text-amber-200/70 -mt-1">{hint}</span>}
        </div>
    );
}

function Note({ children }: { children: ReactNode }) {
    return <p className="text-[13px] text-white/60 leading-relaxed max-w-[340px]">{children}</p>;
}
