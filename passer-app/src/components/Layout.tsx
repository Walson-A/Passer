import { ReactNode } from "react";
import { TitleBar } from "./TitleBar";
import { getCurrentWindow } from "@tauri-apps/api/window";

type ResizeDirection = 'East' | 'North' | 'NorthEast' | 'NorthWest' | 'South' | 'SouthEast' | 'SouthWest' | 'West';

interface LayoutProps {
    children: ReactNode;
}

/**
 * The window: a frameless, transparent Tauri window drawn as one rounded dark
 * pane, with Passer's own title bar on top. Passer used to be a 390x520 panel
 * docked by the taskbar; it is a full, resizable window now, so every edge and
 * corner resizes (the window has no native frame to do it).
 */
export function Layout({ children }: LayoutProps) {
    const startResize = async (direction: ResizeDirection) => {
        try {
            await getCurrentWindow().startResizeDragging(direction);
        } catch (error) {
            console.error(error);
        }
    };

    const edge = "absolute z-[999]";
    return (
        <div className="relative w-screen h-screen overflow-hidden flex flex-col bg-transparent p-0">
            <div className="relative w-full h-full rounded-[22px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.09)] overflow-hidden bg-[#121212]/96 backdrop-blur-md">
                <div className="flex flex-col h-full">
                    <div className="relative z-50 shrink-0">
                        <TitleBar />
                    </div>
                    {/* Views own their padding. */}
                    <div className="flex-1 flex relative z-10 min-h-0 overflow-hidden">
                        {children}
                    </div>
                </div>

                {/* Invisible resize handles: 6px edges, 14px corners. */}
                <div className={`${edge} top-0 left-[14px] right-[14px] h-1.5 cursor-ns-resize`} onMouseDown={() => startResize("North")} />
                <div className={`${edge} bottom-0 left-[14px] right-[14px] h-1.5 cursor-ns-resize`} onMouseDown={() => startResize("South")} />
                <div className={`${edge} left-0 top-[14px] bottom-[14px] w-1.5 cursor-ew-resize`} onMouseDown={() => startResize("West")} />
                <div className={`${edge} right-0 top-[14px] bottom-[14px] w-1.5 cursor-ew-resize`} onMouseDown={() => startResize("East")} />
                <div className={`${edge} top-0 left-0 w-3.5 h-3.5 cursor-nwse-resize`} onMouseDown={() => startResize("NorthWest")} />
                <div className={`${edge} top-0 right-0 w-3.5 h-3.5 cursor-nesw-resize`} onMouseDown={() => startResize("NorthEast")} />
                <div className={`${edge} bottom-0 left-0 w-3.5 h-3.5 cursor-nesw-resize`} onMouseDown={() => startResize("SouthWest")} />
                <div className={`${edge} bottom-0 right-0 w-3.5 h-3.5 cursor-nwse-resize`} onMouseDown={() => startResize("SouthEast")} />
            </div>
        </div>
    );
}
