import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { QRCodeSVG } from "qrcode.react";
import { ChevronLeft, Check, Copy, Link2, ShieldAlert } from "lucide-react";

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
        let alive = true;
        setError(null);
        (async () => {
            try {
                const result = await invoke<PairingInfo>("get_pairing_info");
                if (alive) setInfo(result);
            } catch (e) {
                console.error("Failed to load pairing info", e);
                if (alive) setError(String(e));
            }
        })();
        return () => { alive = false; };
    }, [open]);

    // Escape goes back, matching the direction the view came from.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    const pairingUrl = info ? buildPairingUrl(info) : "";

    const copy = (what: "link" | "token") => {
        if (!info) return;
        navigator.clipboard.writeText(what === "link" ? pairingUrl : info.token);
        setCopied(what);
        setTimeout(() => setCopied(null), 1500);
    };

    return (
        // Opaque: this layer slides over the view beneath it.
        <div className="flex-1 flex flex-col min-h-0 bg-[#141414]">
            {/* Back header - the only way in was from Settings, and this is the
                way back out. */}
            <div className="shrink-0 flex items-center gap-1 px-3 pt-4 pb-3">
                <button
                    onClick={onClose}
                    className="flex items-center gap-0.5 py-1 pr-2 pl-1 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06] transition-all duration-200 active:scale-95 cursor-pointer"
                >
                    <ChevronLeft className="w-4 h-4" strokeWidth={2.5} />
                    <span className="text-[10px] font-bold">Settings</span>
                </button>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70 ml-1">
                    Pair a device
                </span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-3 flex flex-col gap-3">
                {error && (
                    <p className="text-[10px] text-red-400 leading-relaxed px-1">
                        Pairing info didn't load: {error}
                    </p>
                )}

                {/* Which machine this code connects to */}
                <div className="text-center">
                    <p className="text-[11px] font-bold text-white/90 leading-tight truncate">
                        {info ? info.name : "…"}
                    </p>
                    <p className="text-[9px] font-mono text-white/40 leading-tight mt-0.5 truncate">
                        {info ? `${info.host}:${info.port} · ${info.ip}` : ""}
                    </p>
                </div>

                {/* Light plate keeps the code scannable against the dark UI */}
                <div className="flex items-center justify-center p-4 rounded-2xl bg-white">
                    {pairingUrl ? (
                        <QRCodeSVG value={pairingUrl} size={172} level="M" marginSize={0} />
                    ) : (
                        <div className="w-[172px] h-[172px] flex items-center justify-center text-[10px] font-bold text-black/30">
                            Loading…
                        </div>
                    )}
                </div>

                <p className="text-[9px] text-white/45 leading-relaxed text-center px-2">
                    Scan this from the Passer mobile app to connect it to this PC.
                </p>

                {/* Manual fallback */}
                <div className="flex gap-2">
                    <button
                        onClick={() => copy("link")}
                        disabled={!info}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all duration-200 active:scale-[0.98] disabled:opacity-40 cursor-pointer
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
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all duration-200 active:scale-[0.98] disabled:opacity-40 cursor-pointer
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

                {/* The code embeds the secret - say so */}
                <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/[0.07] border border-amber-400/15">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400/80 shrink-0 mt-px" strokeWidth={2} />
                    <p className="text-[9px] text-amber-200/70 leading-relaxed">
                        This code contains your pairing token. Don't share or screenshot it — anyone who scans it gains access.
                    </p>
                </div>
            </div>
        </div>
    );
}
