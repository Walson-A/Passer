import { getCurrentWindow } from "@tauri-apps/api/window";

export function TitleBar() {
    const minimize = () => getCurrentWindow().minimize();
    const close = () => getCurrentWindow().close();

    return (
        <div className="h-12 w-full flex items-center justify-end px-4 relative z-50">
            {/* DRAG REGION: Absolute layer acting as the background */}
            <div data-tauri-drag-region className="absolute inset-0 z-0 bg-transparent" />

            {/* CONTROLS: Explicitly on top of the drag region */}
            <div className="flex gap-3 relative z-10">
                <button
                    onClick={minimize}
                    className="p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer group"
                    title="Minimize"
                >
                    <svg className="w-3 h-3 text-white/50 group-hover:text-white pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                    </svg>
                </button>
                <button
                    onClick={close}
                    className="p-2 rounded-full hover:bg-red-500/20 transition-colors cursor-pointer group"
                    title="Close"
                >
                    <svg className="w-3 h-3 text-white/50 group-hover:text-red-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
