
import { invoke } from "@tauri-apps/api/core";
import { Settings, Folder } from "lucide-react";
import { PasserSpace } from "./PasserSpace";

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
        <div className="w-full h-16 flex items-center justify-between px-8 pb-2 relative z-50">
            {/* Settings (Left) */}
            <button className="text-white/40 hover:text-white transition-all duration-300 p-2.5 hover:bg-white/[0.08] rounded-full cursor-pointer active:scale-95 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 group">
                <Settings className="w-5 h-5 opacity-60 group-hover:opacity-100 transition-opacity" strokeWidth={2} />
            </button>

            {/* Middle: Floating Space Button */}
            <div className="pb-1">
                <PasserSpace isTransferring={isTransferring} />
            </div>

            {/* Downloads (Right) */}
            <button
                onClick={openDownloads}
                className="text-white/40 hover:text-[var(--accent-warm)] transition-all duration-300 p-2.5 hover:bg-white/[0.08] rounded-full cursor-pointer active:scale-95 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 group"
                title="Open Downloads"
            >
                <Folder className="w-5 h-5 opacity-60 group-hover:opacity-100 transition-opacity" strokeWidth={2} />
            </button>
        </div>
    );
}
