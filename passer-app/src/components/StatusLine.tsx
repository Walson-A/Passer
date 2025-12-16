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
                <div
                    onClick={() => navigator.clipboard.writeText(`http://${ip}:8000`)}
                    className="mt-1 px-3 py-1 rounded-full bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer group flex items-center gap-2"
                    title="Copy IP"
                >
                    <div className="w-1 h-1 bg-emerald-400 rounded-full"></div>
                    <span className="text-[10px] font-mono text-white/40 group-hover:text-white/80 transition-colors">
                        {ip}:8000
                    </span>
                </div>
            )}
        </div>
    );
}
