import { ReactNode } from "react";
import { TitleBar } from "./TitleBar";
import { getCurrentWindow } from "@tauri-apps/api/window";

type ResizeDirection = 'East' | 'North' | 'NorthEast' | 'NorthWest' | 'South' | 'SouthEast' | 'SouthWest' | 'West';

interface LayoutProps {
    children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
    const startResize = async (direction: ResizeDirection) => {
        try {
            await getCurrentWindow().startResizeDragging(direction);
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

                {/* --- Custom Resize Handles (Invisible) --- 
                    These provide a 40px grab area at each corner for resizing.
                */}

                {/* Top Left */}
                <div
                    className="absolute top-0 left-0 w-10 h-10 z-[999] cursor-nwse-resize rounded-br-2xl"
                    onMouseDown={() => startResize("NorthWest")}
                />

                {/* Top Right */}
                <div
                    className="absolute top-0 right-0 w-10 h-10 z-[999] cursor-nesw-resize rounded-bl-2xl"
                    onMouseDown={() => startResize("NorthEast")}
                />

                {/* Bottom Left */}
                <div
                    className="absolute bottom-0 left-0 w-10 h-10 z-[999] cursor-nesw-resize rounded-tr-2xl"
                    onMouseDown={() => startResize("SouthWest")}
                />

                {/* Bottom Right */}
                <div
                    className="absolute bottom-0 right-0 w-10 h-10 z-[999] cursor-nwse-resize rounded-tl-2xl"
                    onMouseDown={() => startResize("SouthEast")}
                />
            </div>
        </div>
    );
}
