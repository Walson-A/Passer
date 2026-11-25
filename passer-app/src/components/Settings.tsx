import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Power, Link2, Check, Rocket, Info, KeyRound, Eye, EyeOff, Copy, RefreshCw, QrCode, ChevronRight } from "lucide-react";
import { useDeviceInfo } from "../hooks/useDeviceInfo";
import { FOCUS } from "./deviceUi";

interface Props {
    /** True while this is the visible view - drives loading and state resets. */
    active: boolean;
    onOpenPair: () => void;
    /** The local HTTP server the iOS Shortcuts talk to. */
    server: { isReady: boolean; isTransitioning: boolean; onToggle: () => void };
}

/**
 * Settings, in sections: General; iOS Shortcuts - the legacy HTTP server, its
 * address and token, and the QR to set Shortcuts up (devices linked in Devices
 * need none of it); About.
 */
export function Settings({ active, onOpenPair, server }: Props) {
    const [autostart, setAutostart] = useState<boolean | null>(null);
    const [savingAutostart, setSavingAutostart] = useState(false);
    const [version, setVersion] = useState<string>("");
    const [copied, setCopied] = useState(false);

    const [token, setToken] = useState("");
    const [tokenVisible, setTokenVisible] = useState(false);
    const [tokenCopied, setTokenCopied] = useState(false);
    const [regenConfirm, setRegenConfirm] = useState(false);
    const [regenBusy, setRegenBusy] = useState(false);

    const device = useDeviceInfo();
    const serverAddress = device ? `http://${device.host}:${device.port}` : "…";

    // Load when this becomes the visible view.
    useEffect(() => {
        if (!active) return;
        let alive = true;
        (async () => {
            try {
                const [enabled, ver, tok] = await Promise.all([
                    invoke<boolean>("get_autostart"),
                    invoke<string>("get_app_version"),
                    invoke<string>("get_pairing_token"),
                ]);
                if (!alive) return;
                setAutostart(enabled);
                setVersion(ver);
                setToken(tok);
            } catch (e) {
                console.error("Failed to load settings", e);
            }
        })();
        return () => { alive = false; };
    }, [active]);

    // Never leave the secret revealed, or a destructive action armed, behind a
    // view the user has navigated away from.
    useEffect(() => {
        if (!active) {
            setTokenVisible(false);
            setRegenConfirm(false);
        }
    }, [active]);

    const toggleAutostart = async () => {
        if (autostart === null || savingAutostart) return;
        const next = !autostart;
        setSavingAutostart(true);
        setAutostart(next); // optimistic
        try {
            await invoke("set_autostart", { enabled: next });
        } catch (e) {
            console.error("Failed to set autostart", e);
            setAutostart(!next); // revert
        } finally {
            setSavingAutostart(false);
        }
    };

    const copyAddress = () => {
        if (!device) return;
        navigator.clipboard.writeText(serverAddress);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const copyToken = () => {
        if (!token) return;
        navigator.clipboard.writeText(token);
        setTokenCopied(true);
        setTimeout(() => setTokenCopied(false), 1500);
    };

    const regenerateToken = async () => {
        if (regenBusy) return;
        if (!regenConfirm) {
            setRegenConfirm(true);
            setTimeout(() => setRegenConfirm(false), 4000);
            return;
        }
        setRegenBusy(true);
        try {
            const next = await invoke<string>("regenerate_pairing_token");
            setToken(next);
            setTokenVisible(true);
        } catch (e) {
            console.error("Failed to regenerate token", e);
        } finally {
            setRegenBusy(false);
            setRegenConfirm(false);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="w-full max-w-[680px] mx-auto px-8 pt-6 pb-10 flex flex-col gap-7">
                <div>
                    <h1 className="text-[12px] font-black uppercase tracking-[0.22em] text-white/75">Settings</h1>
                </div>

                <Section title="General">
                    <Row
                        icon={<Rocket className="w-4 h-4 text-blue-300" strokeWidth={2} />}
                        tint="bg-blue-500/15 border-blue-400/20"
                        title="Launch on startup"
                        text="Start Passer when you log in"
                        end={<Toggle checked={!!autostart} disabled={autostart === null || savingAutostart} onChange={toggleAutostart} label="Launch on startup" />}
                    />
                </Section>

                <Section
                    title="iOS Shortcuts"
                    note="For the Shortcuts app on iPhone, through this PC's local server. The devices you link in Devices don't need any of this."
                >
                    <Row
                        icon={<Power className={`w-4 h-4 ${server.isReady ? "text-emerald-300" : "text-white/55"}`} strokeWidth={2} />}
                        tint={server.isReady ? "bg-emerald-500/12 border-emerald-400/20" : "bg-white/[0.05] border-white/10"}
                        title="Shortcuts server"
                        text={server.isTransitioning
                            ? (server.isReady ? "Stopping…" : "Starting…")
                            : server.isReady ? "On: Shortcuts can push and pull" : "Off: Shortcuts can't reach this PC"}
                        end={<Toggle checked={server.isReady} disabled={server.isTransitioning} onChange={server.onToggle} label="Shortcuts server" />}
                    />
                    <Row
                        icon={<Link2 className="w-4 h-4 text-white/65" strokeWidth={2} />}
                        tint="bg-white/[0.05] border-white/10"
                        title="Server address"
                        text={<span className="font-mono">{serverAddress}</span>}
                        end={
                            <IconButton label={copied ? "Copied" : "Copy the address"} onClick={copyAddress} active={copied}>
                                {copied ? <Check className="w-4 h-4" strokeWidth={2.5} /> : <Copy className="w-4 h-4" strokeWidth={2} />}
                            </IconButton>
                        }
                    />
                    <div className="px-4 py-3.5 flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                            <Tile tint="bg-amber-500/15 border-amber-400/20"><KeyRound className="w-4 h-4 text-amber-300" strokeWidth={2} /></Tile>
                            <div className="min-w-0 flex-1">
                                <p className="text-[13px] font-semibold text-white/90 leading-tight">Pairing token</p>
                                <p className="text-[12px] text-white/50 leading-tight mt-1">Every Shortcut sends it</p>
                            </div>
                            <IconButton label={tokenVisible ? "Hide" : "Reveal"} onClick={() => setTokenVisible(v => !v)}>
                                {tokenVisible ? <EyeOff className="w-4 h-4" strokeWidth={2} /> : <Eye className="w-4 h-4" strokeWidth={2} />}
                            </IconButton>
                            <IconButton label={tokenCopied ? "Copied" : "Copy"} onClick={copyToken} active={tokenCopied}>
                                {tokenCopied ? <Check className="w-4 h-4" strokeWidth={2.5} /> : <Copy className="w-4 h-4" strokeWidth={2} />}
                            </IconButton>
                        </div>
                        <div className="ml-11 px-3 py-2 rounded-xl bg-black/40 border border-white/[0.07]">
                            <p className="text-[12px] font-mono text-white/80 break-all leading-relaxed select-all">
                                {token ? (tokenVisible ? token : "•".repeat(token.length)) : "…"}
                            </p>
                        </div>
                        <div className="ml-11">
                            <button
                                onClick={regenerateToken}
                                disabled={regenBusy}
                                className={`flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[12px] font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-40 cursor-pointer ${FOCUS}
                                    ${regenConfirm
                                        ? "bg-red-500/15 border-red-400/40 text-red-200"
                                        : "bg-white/[0.03] border-white/10 text-white/60 hover:text-white hover:border-white/20"}`}
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${regenBusy ? "animate-spin" : ""}`} strokeWidth={2.25} />
                                {regenConfirm ? "Every Shortcut stops working until updated: confirm" : "Make a new token"}
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={onOpenPair}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.03] transition-colors cursor-pointer rounded-b-2xl ${FOCUS}`}
                    >
                        <Tile tint="bg-blue-500/15 border-blue-400/25"><QrCode className="w-4 h-4 text-blue-300" strokeWidth={2} /></Tile>
                        <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-semibold text-white/90 leading-tight">Set up Shortcuts on an iPhone</p>
                            <p className="text-[12px] text-white/50 leading-tight mt-1">Shows a QR code with the address and token</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-white/35 shrink-0" strokeWidth={2} />
                    </button>
                </Section>

                <Section title="About">
                    <Row
                        icon={<Info className="w-4 h-4 text-white/60" strokeWidth={2} />}
                        tint="bg-white/[0.05] border-white/10"
                        title="Passer"
                        text={version ? `Version ${version}` : "…"}
                    />
                </Section>
            </div>
        </div>
    );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
    return (
        <section aria-label={title}>
            <h2 className="px-1 text-[11px] font-black uppercase tracking-[0.18em] text-white/55">{title}</h2>
            {note && <p className="px-1 mt-1.5 text-[12px] text-white/50 leading-snug">{note}</p>}
            <div className="mt-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] divide-y divide-white/[0.05]">
                {children}
            </div>
        </section>
    );
}

function Tile({ tint, children }: { tint: string; children: React.ReactNode }) {
    return <div className={`shrink-0 w-8 h-8 rounded-xl border flex items-center justify-center ${tint}`}>{children}</div>;
}

function Row({ icon, tint, title, text, end }: { icon: React.ReactNode; tint: string; title: string; text: React.ReactNode; end?: React.ReactNode }) {
    return (
        <div className="flex items-center gap-3 px-4 py-3.5">
            <Tile tint={tint}>{icon}</Tile>
            <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-white/90 leading-tight">{title}</p>
                <p className="text-[12px] text-white/50 leading-tight mt-1 truncate">{text}</p>
            </div>
            {end}
        </div>
    );
}

function IconButton({ children, label, onClick, active }: {
    children: React.ReactNode;
    label: string;
    onClick: () => void;
    active?: boolean;
}) {
    return (
        <button
            title={label}
            aria-label={label}
            onClick={onClick}
            className={`p-2 rounded-lg transition-all duration-200 active:scale-90 cursor-pointer ${FOCUS}
                ${active ? "bg-emerald-500/15 text-emerald-300" : "text-white/55 hover:text-white hover:bg-white/10"}`}
        >
            {children}
        </button>
    );
}

function Toggle({ checked, disabled, onChange, label }: { checked: boolean; disabled?: boolean; onChange: () => void; label: string }) {
    return (
        <button
            role="switch"
            aria-checked={checked}
            aria-label={label}
            disabled={disabled}
            onClick={onChange}
            className={`relative shrink-0 w-10 h-[22px] rounded-full transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${FOCUS}
                ${checked ? "bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.4)]" : "bg-white/10 border border-white/15"}`}
        >
            <span
                className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-md transition-all duration-300
                    ${checked ? "left-[20px]" : "left-0.5"}`}
            />
        </button>
    );
}
