// import { useState, useEffect } from "react";
// import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

export function PasserSpace() {
    // const [creds, setCreds] = useState<any>(null); // Kept for future toggle

    return (
        <div className="mt-6 w-full max-w-md p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_#60a5fa]"></div>
                    <h3 className="text-sm font-semibold text-white tracking-wide">Passer Space</h3>
                </div>
                <div className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/10 text-white/60">
                    SMB
                </div>
            </div>

            <div className="flex flex-col gap-3">
                <div className="text-xs text-white/70 leading-relaxed">
                    Access your files natively via iOS Files or Windows.
                </div>

                {/* Connection Info */}
                <div
                    className="group relative flex items-center justify-between p-2 rounded-lg bg-black/20 hover:bg-black/30 transition-colors cursor-pointer"
                    onClick={() => navigator.clipboard.writeText(`smb://passer.local`)}
                >
                    <span className="text-xs text-white/50 font-mono">Address :</span>
                    <span className="text-xs text-blue-400 font-mono">smb://passer.local</span>
                </div>

                <div className="flex gap-2 text-[10px] text-white/40 font-mono px-1">
                    <span>User : your_windows_user</span>
                </div>
                <div className="flex gap-2 text-[10px] text-white/40 font-mono px-1">
                    <span>Password : your_windows_pass</span>
                </div>

                {/* Open Folder Actions */}
                <button
                    onClick={() => invoke("open_webdav")}
                    className="mt-1 w-full py-2 text-xs font-medium text-white/80 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors border border-blue-500/20 cursor-pointer flex items-center justify-center gap-2"
                >
                    <span>📂</span> Open Space Folder
                </button>

                <div className="text-[10px] text-white/30 text-center italic mt-1">
                </div>
            </div>
        </div>
    );
}
