import { ReactNode } from "react";
import { TitleBar } from "./TitleBar";
import { getCurrentWindow } from "@tauri-apps/api/window";

interface LayoutProps {
    children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
    const handleResize = async () => {
        try {
            await getCurrentWindow().startResizeDragging("SouthEast");
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="relative w-screen h-screen overflow-hidden flex flex-col bg-transparent p-0">
            {/* 
             Window Frame 
             The rounded-[32px] creates the modern window shape.
             Using minimal border instead of heavy shadow to align with window edge.
            */}
            <div className="relative w-full h-full rounded-[32px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] overflow-hidden bg-[#141414]/90 backdrop-blur-md" >

                <div className="flex flex-col h-full">

                    {/* Draggable TitleBar - z-50 */}
                    <div className="relative z-50 pt-3 px-4">
                        <TitleBar />
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 flex flex-col relative z-10 p-4 overflow-hidden">
                        {children}
                    </div>
                </div>

                {/* Custom Resize Handle (Bottom Right) 
                    Fixes the "offset" feel by making the visual corner interactive 
                */}
                <div
                    className="absolute bottom-0 right-0 w-10 h-10 z-[999] cursor-nwse-resize hover:bg-white/5 active:bg-white/10 rounded-tl-2xl transition-all"
                    onMouseDown={handleResize}
                />
            </div>
        </div>
    );
}
