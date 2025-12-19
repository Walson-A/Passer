
import { invoke } from "@tauri-apps/api/core";
import { Settings, Folder } from "lucide-react";
import { PasserSpace } from "./PasserSpace";
import { PremiumTooltip } from "./PremiumTooltip";

interface ControlFooterProps {
    isTransferring?: boolean;
}

export function ControlFooter({ isTransferring }: ControlFooterProps) {
    const openDownloads = async () => {
        try {
            await invoke("open_downloads");
        } catch (e) {
            console.error("Failed to open downloads", e);
        }
    };

    return (
        <div className="w-full h-16 flex items-center justify-between px-8 pb-1 relative z-50">
            {/* Settings (Left) */}
            <PremiumTooltip label="Settings">
                <button
                    className="text-white/80 hover:text-white transition-all duration-300 p-2.5 hover:bg-white/[0.08] rounded-full cursor-pointer active:scale-95 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 group"
                >
                    <Settings className="w-5 h-5 opacity-60 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
                </button>
            </PremiumTooltip>

            {/* Middle: Floating Space Button */}
            <div className="pb-1 transition-transform duration-300 group-hover:scale-105">
                <PasserSpace isTransferring={isTransferring} />
            </div>

            {/* Downloads (Right) */}
            <PremiumTooltip label="Passer Folder">
                <button
                    onClick={openDownloads}
                    className="text-white/80 hover:text-[var(--accent-warm)] transition-all duration-300 p-2.5 hover:bg-white/[0.08] rounded-full cursor-pointer active:scale-95 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 group"
                >
                    <Folder className="w-5 h-5 opacity-60 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
                </button>
            </PremiumTooltip>

        </div>
    );
}
