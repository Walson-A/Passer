

interface GlassCardProps {
    status: "idle" | "pushing" | "pulling" | "success";
}

export function GlassCard({ status }: GlassCardProps) {
    return (
        <div className="relative group w-full h-[260px] flex items-center justify-center shrink-0">
            {/* Container Glass - Stronger background */}
            <div className="absolute inset-0 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden transition-all duration-500 shadow-inner">

                {/* Flux Animation Layer */}
                {status === "pushing" && (
                    <div className="absolute inset-0 z-10 animate-flux-push pointer-events-none">
                        <div className="h-full w-[60px] bg-gradient-to-r from-transparent via-[var(--accent-warm)] to-transparent opacity-80 blur-2xl"></div>
                    </div>
                )}

                {status === "pulling" && (
                    <div className="absolute inset-0 z-10 animate-flux-pull pointer-events-none">
                        <div className="h-full w-[60px] bg-gradient-to-r from-transparent via-[var(--accent-warm)] to-transparent opacity-80 blur-2xl"></div>
                    </div>
                )}

            </div>

            {/* P Logo (Image) */}
            <div className="relative z-20 flex flex-col items-center justify-center pointer-events-none select-none">
                <img
                    src="/Logo Sans Fond.png"
                    alt="Passer Logo"
                    className="w-32 h-32 object-contain opacity-90 drop-shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
                />
            </div>
            {/* Success Badge (Top Right) */}
            {status === "success" && (
                <div className="absolute top-5 right-5 z-30 animate-fade-in-up">
                    <div className="w-3 h-3 bg-[var(--accent-warm)] rounded-full shadow-[0_0_10px_var(--accent-warm)]"></div>
                </div>
            )}
        </div>
    );
}
