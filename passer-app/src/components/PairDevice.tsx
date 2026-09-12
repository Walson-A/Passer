import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { QRCodeSVG } from "qrcode.react";
import { X, Check, Copy, Link2, MonitorSmartphone, ShieldAlert } from "lucide-react";

interface Props {
    open: boolean;
    onClose: () => void;
}

interface PairingInfo {
    name: string;
    host: string;
    ip: string;
    port: number;
    token: string;
}

/**
 * Builds the payload a device scans to pair. `host` (mDNS) is the preferred
 * address; `ip` travels with it as a fallback for networks where `.local`
 * resolution fails. `v` lets the mobile app handle future format changes.
 */
function buildPairingUrl(info: PairingInfo): string {
    const params = new URLSearchParams({
        v: "1",
        name: info.name,
        host: info.host,
        ip: info.ip,
        port: String(info.port),
        token: info.token,
    });
    return `passer://pair?${params.toString()}`;
}

export function PairDevice({ open, onClose }: Props) {
    const [info, setInfo] = useState<PairingInfo | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState<"link" | "token" | null>(null);

    useEffect(() => {
        if (!open) return;
        let active = true;
        setError(null);
        (async () => {
            try {
                const result = await invoke<PairingInfo>("get_pairing_info");
                if (active) setInfo(result);
            } catch (e) {
                console.error("Failed to load pairing info", e);
                if (active) setError(String(e));
            }
        })();
        return () => { active = false; };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open) return null;

    const pairingUrl = info ? buildPairingUrl(info) : "";

    const copy = (what: "link" | "token") => {
        if (!info) return;
        navigator.clipboard.writeText(what === "link" ? pairingUrl : info.token);
        setCopied(what);
        setTimeout(() => setCopied(null), 1500);
    };

    return (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-5">
            <div
                className="absolute inset-0 bg-black/75 backdrop-blur-[12px] animate-in fade-in duration-300"
                onClick={onClose}
            />

            <div className="relative z-10 w-full max-w-[300px] max-h-full overflow-y-auto custom-scrollbar rounded-[26px] bg-[#0d0d0d]/95 border border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.9)] animate-in zoom-in-95 fade-in duration-300">
                {/* Header */}
                <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-white/[0.06] bg-[#0d0d0d]/95 backdrop-blur-xl">
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/70">
                        Pair a device
                    </span>
                    <button
                        onClick={onClose}
                        className="p-1.5 -mr-1.5 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-all duration-200 active:scale-90"
                    >
                        <X className="w-4 h-4" strokeWidth={2} />
                    </button>
                </div>

                <div className="p-4 flex flex-col gap-3">
                    {error && (
                        <p className="text-[10px] text-red-400 leading-relaxed px-1">
                            Could not load pairing info: {error}
                        </p>
                    )}

                    {/* This machine */}
                    <div className="flex items-center gap-3 px-1">
                        <MonitorSmartphone className="w-4 h-4 text-blue-400 shrink-0" strokeWidth={2} />
                        <div className="min-w-0">
                            <p className="text-[11px] font-bold text-white/90 leading-tight truncate">
                                {info ? info.name : "…"}
                            </p>
                            <p className="text-[9px] font-mono text-white/40 leading-tight mt-0.5 truncate">
                                {info ? `${info.host}:${info.port} · ${info.ip}` : ""}
                            </p>
                        </div>
                    </div>

                    {/* QR — light plate so it stays scannable against the dark UI */}
                    <div className="flex items-center justify-center p-4 rounded-2xl bg-white">
                        {pairingUrl ? (
                            <QRCodeSVG value={pairingUrl} size={180} level="M" marginSize={0} />
                        ) : (
                            <div className="w-[180px] h-[180px] flex items-center justify-center text-[10px] font-bold text-black/30">
                                Loading…
                            </div>
                        )}
                    </div>

                    <p className="text-[9px] text-white/45 leading-relaxed px-1 text-center">
                        Scan this from the Passer mobile app to connect it to this PC.
                    </p>

                    {/* Manual fallback */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => copy("link")}
                            disabled={!info}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all duration-200 active:scale-[0.98] disabled:opacity-40
                                ${copied === "link"
                                    ? "bg-emerald-500/15 border-emerald-400/30 text-emerald-400"
                                    : "bg-white/[0.03] border-white/10 text-white/50 hover:text-white/90 hover:border-white/20"}`}
                        >
                            {copied === "link"
                                ? <Check className="w-3 h-3" strokeWidth={2.5} />
                                : <Link2 className="w-3 h-3" strokeWidth={2.5} />}
                            {copied === "link" ? "Copied" : "Link"}
                        </button>
                        <button
                            onClick={() => copy("token")}
                            disabled={!info}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all duration-200 active:scale-[0.98] disabled:opacity-40
                                ${copied === "token"
                                    ? "bg-emerald-500/15 border-emerald-400/30 text-emerald-400"
                                    : "bg-white/[0.03] border-white/10 text-white/50 hover:text-white/90 hover:border-white/20"}`}
                        >
                            {copied === "token"
                                ? <Check className="w-3 h-3" strokeWidth={2.5} />
                                : <Copy className="w-3 h-3" strokeWidth={2.5} />}
                            {copied === "token" ? "Copied" : "Token"}
                        </button>
                    </div>

                    {/* The QR embeds the secret - make that explicit */}
                    <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/[0.07] border border-amber-400/15">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-400/80 shrink-0 mt-px" strokeWidth={2} />
                        <p className="text-[9px] text-amber-200/70 leading-relaxed">
                            This code contains your pairing token. Don't share or screenshot it — anyone who scans it gains access.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
