import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Power, Link2, Check, Rocket, Info, KeyRound, Eye, EyeOff, Copy, RefreshCw, QrCode, ChevronRight } from "lucide-react";
import { useDeviceInfo } from "../hooks/useDeviceInfo";

interface Props {
    /** True while this is the visible view - drives loading and state resets. */
    active: boolean;
    onOpenPair: () => void;
}

export function Settings({ active, onOpenPair }: Props) {
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
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pt-5 pb-2 flex flex-col gap-3">

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
                        {token ? (tokenVisible ? token : "•".repeat(token.length)) : "…"}
                    </p>
                </div>

                <button
                    onClick={regenerateToken}
                    disabled={regenBusy}
                    className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all duration-200 active:scale-[0.98] disabled:opacity-40 cursor-pointer
                        ${regenConfirm
                            ? "bg-red-500/20 border-red-400/40 text-red-300"
                            : "bg-white/[0.03] border-white/10 text-white/40 hover:text-white/80 hover:border-white/20"}`}
                >
                    <RefreshCw className={`w-3 h-3 ${regenBusy ? "animate-spin" : ""}`} strokeWidth={2.5} />
                    {regenConfirm ? "Unpairs all devices — confirm" : "Regenerate"}
                </button>
            </div>

            {/* Pair a device - pushes one level deeper */}
            <button
                onClick={onOpenPair}
                className="flex items-center gap-3 p-3 rounded-2xl bg-blue-500/10 border border-blue-400/25 hover:bg-blue-500/20 hover:border-blue-400/40 transition-all duration-200 active:scale-[0.99] text-left cursor-pointer"
            >
                <div className="shrink-0 w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
                    <QrCode className="w-4 h-4 text-blue-300" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-white/90 leading-tight">Pair a device</p>
                    <p className="text-[9px] text-white/45 leading-tight mt-0.5">Show the QR code to connect a phone</p>
                </div>
                <ChevronRight className="w-4 h-4 text-white/30 shrink-0" strokeWidth={2} />
            </button>

            {/* Server address */}
            <button
                onClick={copyAddress}
                className={`group flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all duration-200 active:scale-[0.99] text-left cursor-pointer
                    ${copied ? "bg-emerald-500/15 border-emerald-400/30" : "bg-white/[0.03] border-white/[0.06] hover:border-blue-400/30"}`}
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0 w-8 h-8 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center">
                        <Power className="w-4 h-4 text-emerald-400/80" strokeWidth={2} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-white/40 leading-tight">Server address</p>
                        <p className="text-[11px] font-mono font-bold text-white/85 leading-tight mt-0.5 truncate">{serverAddress}</p>
                    </div>
                </div>
                <div className="shrink-0 text-white/40 group-hover:text-blue-400 transition-colors">
                    {copied
                        ? <Check className="w-4 h-4 text-emerald-400" strokeWidth={2.5} />
                        : <Link2 className="w-4 h-4" strokeWidth={2} />}
                </div>
            </button>

            {/* Version */}
            <div className="flex items-center gap-2 px-1 pt-0.5 pb-1 text-white/30">
                <Info className="w-3 h-3" strokeWidth={2} />
                <span className="text-[9px] font-semibold tracking-wide">
                    Passer{version ? ` v${version}` : ""}
                </span>
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
            className={`p-1.5 rounded-lg transition-all duration-200 active:scale-90 cursor-pointer
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
            className={`relative shrink-0 w-10 h-[22px] rounded-full transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer
                ${checked ? "bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.4)]" : "bg-white/10 border border-white/15"}`}
        >
            <span
                className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-md transition-all duration-300
                    ${checked ? "left-[20px]" : "left-0.5"}`}
            />
        </button>
    );
}
