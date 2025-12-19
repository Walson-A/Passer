
import { useState } from "react";
import { Link2, Check } from "lucide-react";
import { PremiumTooltip } from "./PremiumTooltip";

interface ServerStatusBarProps {
    status: "idle" | "pushing" | "pulling" | "success" | "sync-success";
    isReady: boolean;
    onClick?: () => void;
    isTransitioning?: boolean;
}

export function ServerStatusBar({ status, isReady, onClick, isTransitioning }: ServerStatusBarProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(`http://passer.local:8000`);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div className="relative w-[85%] mx-auto mt-0.5 h-8.5 flex items-center justify-center overflow-visible shrink-0 rounded-full border border-white/[0.03] bg-white/[0.005] backdrop-blur-[2px] transition-all duration-100">
            {/* Background */}
            {/* Success Pulse (Emerald) - Make it faster and tighter */}
            <div className={`
                absolute inset-0 rounded-full transition-all duration-100
                ${(status === 'sync-success' || status === 'success') ? 'bg-emerald-500/10 border-emerald-500/30 animate-pulse-success' : 'bg-white/[0.002]'}
            `} />

            {/* Flux Animation (Blue/Amber gradient) */}
            {(status === "pushing" || status === "pulling") && (
                <div className="absolute inset-0 z-10 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/40 to-transparent w-[200%] h-full animate-flux-push blur-xl opacity-80" />
                </div>
            )}

            {/* Status Content */}
            <div
                className="relative z-10 w-full h-full flex items-center justify-center px-4"
            >

                {/* Centered Status - More subtle when idle */}
                <div
                    className={`flex items-center gap-2 transition-all duration-100 group/status cursor-pointer 
                    ${(copied || status === "sync-success") ? "opacity-0 scale-95" : "opacity-100 scale-100"}`}
                    onClick={onClick}
                >
                    <div className={`
                        w-1.5 h-1.5 rounded-full transition-all duration-100
                        ${isTransitioning
                            ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)] animate-pulse'
                            : (status === 'pushing' || status === 'pulling')
                                ? 'bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.8)] animate-pulse'
                                : (status === 'success' || status === 'sync-success')
                                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]'
                                    : isReady
                                        ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.3)]'
                                        : 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.2)]'
                        }
                    `} />
                    <span className={`text-[9px] font-black tracking-[0.2em] uppercase transition-colors duration-100
                        ${isTransitioning
                            ? 'text-amber-400'
                            : (status === 'pushing' || status === 'pulling')
                                ? 'text-blue-400 animate-pulse'
                                : (status === 'success' || status === 'sync-success')
                                    ? 'text-emerald-400 font-black tracking-[0.25em]'
                                    : isReady
                                        ? 'text-white/70 group-hover/status:text-white'
                                        : 'text-red-500/70 group-hover/status:text-red-400'
                        }
                    `}>
                        {isTransitioning
                            ? (isReady ? "Stopping..." : "Starting...")
                            : (status === 'pushing' ? "Pulling..." : status === 'pulling' ? "Pushing..." : (status === 'success' || status === 'sync-success' ? "Done!" : (isReady ? "Passboard On" : "Passboard Off")))
                        }
                    </span>
                </div>

                {/* Copied State Overlay */}
                <div className={`absolute inset-0 flex items-center justify-center transition-all duration-100 ${copied ? "opacity-100 scale-100" : "opacity-0 scale-110 pointer-events-none"}`}>
                    <div className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400" strokeWidth={1.5} />
                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Address Copied</span>
                    </div>
                </div>

                {/* Sync Success State Overlay */}
                <div className={`absolute inset-0 flex items-center justify-center transition-all duration-100 ${status === "sync-success" ? "opacity-100 scale-100" : "opacity-0 scale-110 pointer-events-none"}`}>
                    <div className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400" strokeWidth={1.5} />
                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 font-black">Files Synced to Space</span>
                    </div>
                </div>

                {/* Right: Copy CTA */}
                {isReady && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <PremiumTooltip label={copied ? "Copied" : "Copy Server Address"} size="sm" side="bottom">
                            <button
                                onClick={handleCopy}
                                className={`
                                    p-1.5 rounded-full transition-all duration-200 cursor-pointer active:scale-95 group
                                    ${copied
                                        ? "bg-emerald-500/10 text-emerald-400"
                                        : "bg-transparent border border-white/10 hover:bg-white/[0.03] text-white/70 hover:text-white shadow-sm"}
                                `}
                            >
                                <div className="transition-all duration-200 flex items-center justify-center">
                                    {copied ? <Check className="w-3.5 h-3.5" strokeWidth={2.5} /> : <Link2 className="w-3.5 h-3.5" strokeWidth={2.5} />}
                                </div>
                            </button>
                        </PremiumTooltip>
                    </div>
                )}
            </div>
        </div>
    );
}
