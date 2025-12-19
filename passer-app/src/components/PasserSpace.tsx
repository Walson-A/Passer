
import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { X, ExternalLink, Layers, MonitorSmartphone, Link2, Power, Check } from "lucide-react";
import { PremiumTooltip } from "./PremiumTooltip";

interface Props {
    isTransferring?: boolean;
}

export function PasserSpace({ isTransferring = false }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [isActive, setIsActive] = useState(true);
    const [copied, setCopied] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    const toggleOpen = () => setIsOpen(!isOpen);

    const handleCopy = () => {
        navigator.clipboard.writeText(`smb://passer.local`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (isOpen &&
                panelRef.current && !panelRef.current.contains(event.target as Node) &&
                triggerRef.current && !triggerRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    return (
        <div className="relative">
            {/* The Trigger Button */}
            <PremiumTooltip label="Passer Space">
                <button
                    ref={triggerRef}
                    onClick={toggleOpen}
                    className={`
                        group relative w-10 h-10 rounded-full flex items-center justify-center 
                        transition-all duration-300 ease-out z-50
                        hover:-translate-y-0.5 active:scale-95
                        ${isOpen
                            ? "bg-white/10 backdrop-blur-xl border border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.1)] scale-105"
                            : "bg-transparent border-transparent hover:bg-white/[0.08]"
                        }
                    `}
                >
                    <div className={`transition-all duration-300 ${isOpen ? "rotate-90 scale-90" : ""}`}>
                        {isOpen ?
                            <X className="w-5 h-5 text-white/80" strokeWidth={1.5} /> :
                            <Layers className={`w-4.5 h-4.5 transition-colors ${isActive ? "text-white/50 group-hover:text-blue-400" : "text-white/10"}`} strokeWidth={1.5} />
                        }
                    </div>

                    <span
                        className={`
                        absolute top-0.5 right-0.5 w-2 h-2 rounded-full transition-all duration-300
                        ${isActive
                                ? "bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)] border border-[#1a1a1a]"
                                : "bg-white/10 border border-white/5 opacity-50"}
                        ${isActive ? (isTransferring ? "animate-pulse" : !isOpen ? "animate-pulse-slow opacity-60" : "opacity-0") : ""}
                        `}
                    />
                </button>
            </PremiumTooltip>

            {/* The Floating Panel */}
            <div
                ref={panelRef}
                className={`
                    absolute bottom-[65px] left-1/2 -translate-x-1/2 w-[250px] origin-bottom
                    bg-[#0a0a0a]/98 backdrop-blur-3xl border border-white/15 shadow-[0_25px_50px_rgba(0,0,0,0.9)]
                    rounded-[22px] overflow-hidden flex flex-col z-40
                    transition-all duration-500 ease-[var(--ease-spring)]
                    ${isOpen
                        ? "opacity-100 scale-100 translate-y-0 visible"
                        : "opacity-0 scale-95 translate-y-4 invisible pointer-events-none"
                    }
                `}
            >
                {/* 1. Header (Clean Branding + Interactive Toggle) */}
                <div className="px-5 py-3 flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02]">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/60">
                        Passer <span className="text-blue-400">Space</span>
                    </span>

                    <button
                        onClick={() => setIsActive(!isActive)}
                        className={`
                            flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all duration-300
                            active:scale-[0.95]
                            ${isActive
                                ? "bg-blue-400/20 border border-blue-500/30 text-blue-400 hover:bg-blue-400/30 hover:border-blue-400/50 hover:shadow-[0_0_20px_rgba(96,165,250,0.3)]"
                                : "bg-white/5 border border-white/20 text-white/40 hover:bg-white/10 hover:border-white/30"
                            }
                        `}
                    >
                        <Power className="w-2.5 h-2.5" strokeWidth={3} />
                        <span className="text-[8px] font-black uppercase tracking-tighter">{isActive ? "On" : "Off"}</span>
                    </button>
                </div>

                {/* 2. Hero Section */}
                <div className={`px-5 py-5 flex flex-col items-center text-center transition-all duration-500 ease-in-out ${!isActive ? "opacity-30 grayscale scale-[0.97]" : "scale-100"}`}>
                    <div className={`
                        w-11 h-11 rounded-[14px] flex items-center justify-center mb-3 transition-all duration-500
                        ${isActive
                            ? "bg-gradient-to-br from-blue-500/30 to-blue-600/10 border border-blue-400/20 shadow-[0_0_15px_rgba(96,165,250,0.2)]"
                            : "bg-white/5 border border-white/10"}
                    `}>
                        <Layers className={`
                            w-5.5 h-5.5 transition-all duration-500 drop-shadow-[0_4px_12px_rgba(96,165,250,0.5)]
                            ${isActive ? "text-blue-400 animate-float" : "text-white/30"}
                        `} strokeWidth={1.5} />
                    </div>

                    <h3 className="text-[12px] font-black text-white mb-1.5 tracking-tight uppercase">
                        Wireless Shared Drive
                    </h3>

                    <p className="text-[9px] text-white/70 leading-tight mb-5 px-3 font-bold">
                        {isActive
                            ? "Drop files here to share with your devices."
                            : "Space engine is offline. Enable it to share files."}
                    </p>

                    <button
                        onClick={isActive ? () => invoke("open_webdav") : () => setIsActive(true)}
                        className={`
                            w-full py-2.5 px-4 transition-all duration-300 rounded-xl border flex items-center justify-center gap-2.5 group active:scale-[0.98]
                            ${isActive
                                ? "bg-white/[0.08] hover:bg-blue-500 text-white border-white/20 hover:border-blue-500 shadow-sm"
                                : "bg-blue-500 text-white border-blue-400 shadow-[0_8px_20px_rgba(59,130,246,0.4)] hover:bg-blue-400 hover:shadow-[0_10px_25px_rgba(59,130,246,0.5)] hover:-translate-y-0.5"}
                        `}
                    >
                        {isActive ? (
                            <>
                                <ExternalLink className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                                <span className="text-[11px] font-bold">Open Locally</span>
                            </>
                        ) : (
                            <span className="text-[11px] font-black uppercase tracking-wider">Enable Engine</span>
                        )}
                    </button>
                </div>

                {/* 3. Guide Section (Fluid Disclosure) */}
                <div className={`
                    grid transition-all duration-500 ease-[var(--ease-spring)]
                    ${isActive ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}
                `}>
                    <div className="overflow-hidden">
                        <div className="p-5 bg-white/[0.04] border-t border-white/[0.06]">
                            <div className="flex flex-col gap-2.5">
                                <div className="flex items-center gap-2 px-0.5 text-white/50">
                                    <MonitorSmartphone className="w-3.5 h-3.5" strokeWidth={1.5} />
                                    <span className="text-[9px] font-black uppercase tracking-widest">Connect Device</span>
                                </div>

                                <div
                                    className={`
                                        group relative flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer overflow-hidden
                                        ${copied ? "bg-blue-500/30 border-blue-400/50" : "bg-black/60 border-white/10 hover:border-blue-400/40"}
                                        border
                                    `}
                                    onClick={handleCopy}
                                >
                                    <div className={`absolute inset-0 bg-blue-400/20 ${copied ? "translate-x-0 transition-transform duration-1000 ease-out" : "-translate-x-full"}`} />

                                    <span className={`text-[10px] font-mono transition-colors relative z-10 font-bold ${copied ? "text-white" : "text-blue-400"}`}>
                                        {copied ? "Success! Copied to clipboard" : "smb://passer.local"}
                                    </span>

                                    <div className="flex items-center gap-2 relative z-10">
                                        {copied ? (
                                            <Check className="w-3.5 h-3.5 text-white animate-in zoom-in-50 duration-300" strokeWidth={1.5} />
                                        ) : (
                                            <>
                                                <span className="text-[9px] font-black uppercase text-white/30 group-hover:text-blue-400 transition-colors">Copy</span>
                                                <Link2 className="w-3.5 h-3.5 text-white/30 group-hover:text-blue-400 transition-colors" strokeWidth={1.5} />
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
