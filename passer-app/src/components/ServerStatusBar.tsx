
import { useState } from "react";
import { Link2, Check } from "lucide-react";

interface ServerStatusBarProps {
    status: "idle" | "pushing" | "pulling" | "success" | "sync-success";
    isReady: boolean;
    ip?: string;
}

export function ServerStatusBar({ status, isReady, ip }: ServerStatusBarProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(`http://passer.local:8000`);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div className="relative w-[90%] mx-auto mt-1 h-9 flex items-center justify-center overflow-visible shrink-0 rounded-full border border-white/5 bg-white/[0.01] backdrop-blur-sm">
            {/* Background */}
            <div className="absolute inset-0 bg-white/[0.005] rounded-full" />

            {/* Flux Animation (Yellow, only during transfer) */}
            {(status === "pushing" || status === "pulling") && (
                <div className="absolute inset-0 z-10 animate-flux-push pointer-events-none">
                    <div className="h-full w-[80px] bg-gradient-to-r from-transparent via-[#f59e0b] to-transparent opacity-60 blur-2xl"></div>
                </div>
            )}

            {/* Status Content */}
            <div className="relative z-10 w-full h-full flex items-center justify-center px-4">

                {/* Centered Status */}
                <div className={`flex items-center gap-2 transition-all duration-300 ${(copied || status === "sync-success") ? "opacity-0 scale-95" : "opacity-100 scale-100"}`}>
                    <div className={`
                        w-2 h-2 rounded-full transition-all duration-300
                        ${isReady
                            ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]'
                            : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'
                        }
                    `} />
                    <span className="text-[10px] font-black text-white/90 tracking-widest uppercase">
                        {isReady ? "Server On" : "Server Off"}
                    </span>
                </div>

                {/* Copied State Overlay */}
                <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${copied ? "opacity-100 scale-100" : "opacity-0 scale-110 pointer-events-none"}`}>
                    <div className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Address Copied</span>
                    </div>
                </div>

                {/* Sync Success State Overlay */}
                <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${status === "sync-success" ? "opacity-100 scale-100" : "opacity-0 scale-110 pointer-events-none"}`}>
                    <div className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 font-black">Files Synced to Space</span>
                    </div>
                </div>

                {/* Right: Copy CTA */}
                {isReady && (
                    <button
                        onClick={handleCopy}
                        className={`
                            absolute right-3 p-1.5 rounded-full transition-all duration-200 cursor-pointer active:scale-90 group
                            ${copied ? "bg-emerald-500/20 text-emerald-400 scale-105" : "bg-white/5 hover:bg-white/10 text-white/40 hover:text-white"}
                        `}
                    >
                        <div className="transition-all duration-200 flex items-center justify-center">
                            {copied ? <Check className="w-3.5 h-3.5 animate-in zoom-in-75 duration-200" /> : <Link2 className="w-3.5 h-3.5" />}
                        </div>

                        {/* Custom Tooltip Positioned Below (Perfectly Centered Alignment) */}
                        <div className={`
                            absolute top-[calc(100%+6px)] right-0 flex items-center justify-center transition-all duration-200 pointer-events-none whitespace-nowrap px-2.5 h-[18px] rounded-full backdrop-blur-xl z-50 border border-white/5
                            ${copied
                                ? "bg-emerald-500/30 text-emerald-400 opacity-100 translate-y-0"
                                : "bg-white/10 text-white/50 opacity-0 group-hover:opacity-100 group-hover:translate-y-0.5"}
                        `}>
                            <span className="text-[8px] font-black uppercase tracking-widest leading-none">
                                {copied ? "Copied" : "Copy Server Address"}
                            </span>
                        </div>
                    </button>
                )}
            </div>
        </div>
    );
}
