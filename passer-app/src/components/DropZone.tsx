
import { useState, useEffect } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { invoke } from "@tauri-apps/api/core";
import { Layers, ArrowDownToLine } from "lucide-react";

interface Props {
    onDropSuccess: () => void;
}

export function DropZone({ onDropSuccess }: Props) {
    const [isHovering, setIsHovering] = useState(false);

    useEffect(() => {
        let unlisten: (() => void) | undefined;

        async function setup() {
            try {
                const webview = getCurrentWebview();
                if (!webview) return;

                unlisten = await webview.onDragDropEvent((event) => {
                    if (event.payload.type === "enter") {
                        setIsHovering(true);
                    } else if (event.payload.type === "leave") {
                        setIsHovering(false);
                    } else if (event.payload.type === "drop") {
                        setIsHovering(false);
                        const paths = event.payload.paths;
                        if (paths.length > 0) {
                            invoke("handle_file_drop", { paths })
                                .then(() => {
                                    onDropSuccess();
                                })
                                .catch(console.error);
                        }
                    }
                });
            } catch (error) {
                console.error("Failed to setup DropZone:", error);
            }
        }

        setup();

        return () => {
            if (unlisten) unlisten();
        };
    }, [onDropSuccess]);

    if (!isHovering) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none p-6">
            {/* Premium Backdrop Blur Overlay - High Depth */}
            <div className="absolute inset-0 bg-blue-950/20 backdrop-blur-[32px] transition-all duration-700 animate-in fade-in fill-mode-forwards" />

            {/* Central Glass Card - Optimized for the window size */}
            <div className="relative z-10 w-full max-w-[280px] p-8 rounded-[40px] bg-white/[0.03] border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.6)] flex flex-col items-center gap-6 animate-in zoom-in-95 duration-500 ease-[var(--ease-spring)]">

                {/* Animated Icon Container - More Glow & Refined Shapes */}
                <div className="relative w-24 h-24 rounded-[32px] bg-gradient-to-br from-blue-500/30 to-blue-600/5 flex items-center justify-center shadow-[inset_0_1px_2px_rgba(255,255,255,0.2)] border border-white/5">
                    <Layers className="w-12 h-12 text-blue-400 drop-shadow-[0_0_20px_rgba(96,165,250,0.8)] animate-float" strokeWidth={1.5} />

                    {/* Pulsing Outer Rings - Dual layers for depth */}
                    <div className="absolute inset-0 rounded-[32px] border border-blue-400/30 animate-ping opacity-20" />
                    <div className="absolute inset-[-4px] rounded-[36px] border border-blue-400/10 animate-pulse opacity-10" />
                </div>

                <div className="text-center space-y-2.5">
                    <div className="flex items-center justify-center gap-2.5">
                        <div className="p-1 rounded-md bg-blue-500/20">
                            <ArrowDownToLine className="w-4 h-4 text-blue-400" />
                        </div>
                        <h2 className="text-xl font-black text-white uppercase tracking-[0.1em]">
                            Drop to <span className="text-blue-400 underline decoration-2 underline-offset-4">Space</span>
                        </h2>
                    </div>
                    <p className="text-[10px] font-bold text-white/40 tracking-wide leading-relaxed max-w-[200px] mx-auto uppercase">
                        Your files will be instantly shared across your local network.
                    </p>
                </div>

                {/* Decorative corner accents - Refined Opacity */}
                <div className="absolute top-6 left-6 w-5 h-5 border-l border-t border-white/20 rounded-tl-xl" />
                <div className="absolute top-6 right-6 w-5 h-5 border-r border-t border-white/20 rounded-tr-xl" />
                <div className="absolute bottom-6 left-6 w-5 h-5 border-l border-b border-white/20 rounded-bl-xl" />
                <div className="absolute bottom-6 right-6 w-5 h-5 border-r border-b border-white/20 rounded-br-xl" />
            </div>
        </div>
    );
}
