import { getCurrentWindow } from "@tauri-apps/api/window";
import { useState } from "react";
import { Pin } from "lucide-react";

export function TitleBar() {
    const [isPinned, setIsPinned] = useState(false);

    const minimize = () => getCurrentWindow().minimize();
    const close = () => getCurrentWindow().close();

    const togglePin = async () => {
        const newState = !isPinned;
        setIsPinned(newState);
        // Use Rust Native Command for reliability
        import("@tauri-apps/api/core").then(({ invoke }) => {
            invoke("set_window_on_top", { state: newState });
        });
    };

    return (
        <div data-tauri-drag-region className="h-14 w-full flex items-center justify-between px-6 z-50 relative border-b border-white/5">
            {/* Branding Text (Left) */}
            <div className="flex items-center shrink-0 pointer-events-none select-none">
                <span className="text-base font-black tracking-[0.2em] uppercase bg-gradient-to-b from-white to-white/50 bg-clip-text text-transparent drop-shadow-sm">
                    Passer
                </span>
            </div>

            {/* Controls (Right) */}
            <div className="flex gap-2 shrink-0">
                {/* Pin Button */}
                <button
                    onClick={togglePin}
                    className={`p-2 rounded-full transition-all duration-300 cursor-pointer group ${isPinned
                        ? "bg-[var(--accent-warm)]/10 text-[var(--accent-warm)] shadow-[0_0_10px_rgba(251,191,36,0.1)]"
                        : "hover:bg-white/10 text-white/50 hover:text-white"
                        }`}
                    title={isPinned ? "Unpin" : "Pin"}
                >
                    <Pin
                        className={`w-3.5 h-3.5 transition-all duration-300 ${isPinned ? "fill-[var(--accent-warm)]" : ""}`}
                        strokeWidth={2}
                    />
                </button>

                <button
                    onClick={minimize}
                    className="p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer group"
                    title="Minimize"
                >
                    <svg className="w-3.5 h-3.5 text-white/50 group-hover:text-white pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                    </svg>
                </button>
                <button
                    onClick={close}
                    className="p-2 rounded-full hover:bg-red-500/20 transition-colors cursor-pointer group"
                    title="Close"
                >
                    <svg className="w-3.5 h-3.5 text-white/50 group-hover:text-red-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
