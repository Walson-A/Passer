import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { X, Power, Link2, Check, Rocket, Info, KeyRound, Eye, EyeOff, Copy, RefreshCw } from "lucide-react";

interface Props {
    open: boolean;
    onClose: () => void;
}

const SERVER_ADDRESS = "http://passer.local:8000";

export function Settings({ open, onClose }: Props) {
    const [autostart, setAutostart] = useState<boolean | null>(null);
    const [savingAutostart, setSavingAutostart] = useState(false);
    const [version, setVersion] = useState<string>("");
    const [copied, setCopied] = useState(false);

    const [token, setToken] = useState("");
    const [tokenVisible, setTokenVisible] = useState(false);
    const [tokenCopied, setTokenCopied] = useState(false);
    const [regenConfirm, setRegenConfirm] = useState(false);
    const [regenBusy, setRegenBusy] = useState(false);

    // Load current settings when the panel opens.
    useEffect(() => {
        if (!open) return;
        let active = true;
        (async () => {
            try {
                const [enabled, ver, tok] = await Promise.all([
                    invoke<boolean>("get_autostart"),
                    invoke<string>("get_app_version"),
                    invoke<string>("get_pairing_token"),
                ]);
                if (!active) return;
                setAutostart(enabled);
                setVersion(ver);
                setToken(tok);
            } catch (e) {
                console.error("Failed to load settings", e);
            }
        })();
        return () => { active = false; };
    }, [open]);

    // Reset transient token UI each time the panel opens.
    useEffect(() => {
        if (!open) {
            setTokenVisible(false);
            setRegenConfirm(false);
        }
    }, [open]);

    // Close on Escape.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

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
        navigator.clipboard.writeText(SERVER_ADDRESS);
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

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-5">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-[10px] animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Card */}
            <div className="relative z-10 w-full max-w-[300px] max-h-full overflow-y-auto custom-scrollbar rounded-[26px] bg-[#0d0d0d]/95 border border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.9)] animate-in zoom-in-95 fade-in duration-300">
                {/* Header */}
                <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-white/[0.06] bg-[#0d0d0d]/95 backdrop-blur-xl">
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/70">
                        Settings
                    </span>
                    <button
                        onClick={onClose}
                        className="p-1.5 -mr-1.5 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-all duration-200 active:scale-90"
                    >
                        <X className="w-4 h-4" strokeWidth={2} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 flex flex-col gap-3">
                    {/* Launch on startup */}
                    <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="shrink-0 w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-400/20 flex items-center justify-center">
                                <Rocket className="w-4 h-4 text-blue-400" strokeWidth={2} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[11px] font-bold text-white/90 leading-tight">Launch on startup</p>
                                <p className="text-[9px] text-white/40 leading-tight mt-0.5">Start Passer when you log in</p>
                            </div>
                        </div>
                        <Toggle
                            checked={!!autostart}
                            disabled={autostart === null || savingAutostart}
                            onChange={toggleAutostart}
                        />
                    </div>

                    {/* Pairing token */}
                    <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex flex-col gap-2.5">
                        <div className="flex items-center gap-3">
                            <div className="shrink-0 w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-400/20 flex items-center justify-center">
                                <KeyRound className="w-4 h-4 text-amber-400" strokeWidth={2} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-bold text-white/90 leading-tight">Pairing token</p>
                                <p className="text-[9px] text-white/40 leading-tight mt-0.5">Required by every device</p>
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
                                <IconButton
                                    label={tokenVisible ? "Hide" : "Reveal"}
                                    onClick={() => setTokenVisible(v => !v)}
                                >
                                    {tokenVisible
                                        ? <EyeOff className="w-3.5 h-3.5" strokeWidth={2} />
                                        : <Eye className="w-3.5 h-3.5" strokeWidth={2} />}
                                </IconButton>
                                <IconButton label="Copy" onClick={copyToken} active={tokenCopied}>
                                    {tokenCopied
                                        ? <Check className="w-3.5 h-3.5 text-emerald-400" strokeWidth={2.5} />
                                        : <Copy className="w-3.5 h-3.5" strokeWidth={2} />}
                                </IconButton>
                            </div>
                        </div>

                        <div className="px-2.5 py-2 rounded-xl bg-black/50 border border-white/10">
                            <p className="text-[10px] font-mono font-bold text-white/80 break-all leading-relaxed select-all">
                                {token
                                    ? (tokenVisible ? token : "•".repeat(token.length))
                                    : "…"}
                            </p>
                        </div>

                        <button
                            onClick={regenerateToken}
                            disabled={regenBusy}
                            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all duration-200 active:scale-[0.98] disabled:opacity-40
                                ${regenConfirm
                                    ? "bg-red-500/20 border-red-400/40 text-red-300"
                                    : "bg-white/[0.03] border-white/10 text-white/40 hover:text-white/80 hover:border-white/20"}`}
                        >
                            <RefreshCw className={`w-3 h-3 ${regenBusy ? "animate-spin" : ""}`} strokeWidth={2.5} />
                            {regenConfirm ? "Unpairs all devices — confirm" : "Regenerate"}
                        </button>
                    </div>

                    {/* Server address */}
                    <button
                        onClick={copyAddress}
                        className={`group flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all duration-200 active:scale-[0.99] text-left
                            ${copied ? "bg-emerald-500/15 border-emerald-400/30" : "bg-white/[0.03] border-white/[0.06] hover:border-blue-400/30"}`}
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="shrink-0 w-8 h-8 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center">
                                <Power className="w-4 h-4 text-emerald-400/80" strokeWidth={2} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-white/40 leading-tight">Server address</p>
                                <p className="text-[11px] font-mono font-bold text-white/85 leading-tight mt-0.5 truncate">{SERVER_ADDRESS}</p>
                            </div>
                        </div>
                        <div className="shrink-0 text-white/40 group-hover:text-blue-400 transition-colors">
                            {copied
                                ? <Check className="w-4 h-4 text-emerald-400" strokeWidth={2.5} />
                                : <Link2 className="w-4 h-4" strokeWidth={2} />}
                        </div>
                    </button>

                    {/* Version */}
                    <div className="flex items-center gap-2 px-1 pt-0.5 text-white/30">
                        <Info className="w-3 h-3" strokeWidth={2} />
                        <span className="text-[9px] font-semibold tracking-wide">
                            Passer{version ? ` v${version}` : ""}
                        </span>
                    </div>
                </div>
            </div>
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
            onClick={onClick}
            className={`p-1.5 rounded-lg transition-all duration-200 active:scale-90
                ${active ? "bg-emerald-500/15 text-emerald-400" : "text-white/40 hover:text-white hover:bg-white/10"}`}
        >
            {children}
        </button>
    );
}

function Toggle({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: () => void }) {
    return (
        <button
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={onChange}
            className={`relative shrink-0 w-10 h-[22px] rounded-full transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed
                ${checked ? "bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.4)]" : "bg-white/10 border border-white/15"}`}
        >
            <span
                className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-md transition-all duration-300
                    ${checked ? "left-[20px]" : "left-0.5"}`}
            />
        </button>
    );
}
