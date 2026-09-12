import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Layers, FolderOpen, Link2, Check, MonitorSmartphone } from "lucide-react";

const CONNECT_ADDRESS = "smb://passer.local";

/**
 * Passer Space view - the shared folder half of the app. Files dropped on the
 * window land here, and this is the address other devices connect to.
 */
export function PasserSpace() {
    const [copied, setCopied] = useState(false);

    const copyAddress = () => {
        navigator.clipboard.writeText(CONNECT_ADDRESS);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pt-5 pb-2 flex flex-col">
            {/* Hero */}
            <div className="flex flex-col items-center text-center px-2">
                <div className="w-14 h-14 rounded-[18px] bg-gradient-to-br from-blue-500/30 to-blue-600/10 border border-blue-400/20 shadow-[0_0_24px_rgba(96,165,250,0.18)] flex items-center justify-center mb-4">
                    <Layers className="w-6 h-6 text-blue-400 drop-shadow-[0_4px_12px_rgba(96,165,250,0.5)]" strokeWidth={1.5} />
                </div>

                <h2 className="text-[13px] font-black text-white uppercase tracking-tight mb-1.5">
                    Wireless Shared Drive
                </h2>

                <p className="text-[10px] text-white/50 leading-relaxed max-w-[220px]">
                    Drop files on this window to put them here, then reach them from your other devices.
                </p>
            </div>

            {/* Open the folder */}
            <button
                onClick={() => invoke("open_webdav")}
                className="mt-5 w-full py-2.5 px-4 rounded-xl bg-white/[0.06] hover:bg-blue-500 border border-white/15 hover:border-blue-500 text-white
                    flex items-center justify-center gap-2.5 group transition-all duration-200 active:scale-[0.98] cursor-pointer"
            >
                <FolderOpen className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" strokeWidth={2} />
                <span className="text-[11px] font-bold">Open folder</span>
            </button>

            {/* Connect from another device */}
            <div className="mt-5">
                <div className="flex items-center gap-2 px-1 mb-2 text-white/40">
                    <MonitorSmartphone className="w-3.5 h-3.5" strokeWidth={2} />
                    <span className="text-[9px] font-black uppercase tracking-[0.2em]">Connect a device</span>
                </div>

                <button
                    onClick={copyAddress}
                    className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl border transition-all duration-200 active:scale-[0.99] cursor-pointer group
                        ${copied
                            ? "bg-emerald-500/15 border-emerald-400/30"
                            : "bg-black/40 border-white/10 hover:border-blue-400/40"}`}
                >
                    <span className={`text-[10px] font-mono font-bold truncate transition-colors ${copied ? "text-emerald-300" : "text-blue-400"}`}>
                        {copied ? "Copied to clipboard" : CONNECT_ADDRESS}
                    </span>
                    <span className="shrink-0 text-white/30 group-hover:text-blue-400 transition-colors">
                        {copied
                            ? <Check className="w-3.5 h-3.5 text-emerald-400" strokeWidth={2.5} />
                            : <Link2 className="w-3.5 h-3.5" strokeWidth={2} />}
                    </span>
                </button>

                <p className="text-[9px] text-white/30 leading-relaxed mt-2 px-1">
                    Share this folder from Windows first, then open the address in your device's Files app.
                </p>
            </div>
        </div>
    );
}
