interface StatusLineProps {
    text: string;
    isReady: boolean;
    ip?: string;
    onToggle?: () => void;
}

export function StatusLine({ text, isReady, ip, onToggle }: StatusLineProps) {
    return (
        <div className="flex flex-col items-center justify-center gap-2 mt-6">
            {/* Status Text & Toggle */}
            <div className="flex items-center gap-3">
                <button
                    onClick={onToggle}
                    className={`text-sm font-medium tracking-wide transition-all duration-300 cursor-pointer hover:opacity-80 flex items-center gap-2 ${isReady ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}
                >
                    {isReady ? "Server On" : "Server Off"}
                    <div className={`w-2 h-2 rounded-full shadow-[0_0_8px_currentColor] transition-colors ${isReady ? 'bg-emerald-400 text-emerald-400' : 'bg-red-500 text-red-500 shadow-none'}`}></div>
                </button>
            </div>

            {/* Secondary Text (Detailed Status) */}
            <div className="text-[10px] text-white/30 font-medium tracking-wider uppercase">
                {isReady ? text : "Offline"}
            </div>

            {/* IP Address Display */}
            {isReady && ip && (
                <div className="flex flex-col items-center gap-1">
                    <div
                        onClick={() => navigator.clipboard.writeText(`http://passer.local:8000`)}
                        className="mt-1 px-3 py-1 rounded-full bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer group flex items-center gap-2"
                        title="Copy Local URL"
                    >
                        <div className="w-1 h-1 bg-emerald-400 rounded-full animate-pulse"></div>
                        <span className="text-xs font-mono text-white/80 group-hover:text-white transition-colors">
                            passer.local:8000
                        </span>
                    </div>
                    {/* Fallback IP */}
                    <div
                        onClick={() => navigator.clipboard.writeText(`http://${ip}:8000`)}
                        className="text-[9px] text-white/20 font-mono hover:text-white/40 cursor-pointer"
                        title="Copy Fallback IP"
                    >
                        {ip}:8000
                    </div>
                </div>
            )}
        </div>
    );
}
