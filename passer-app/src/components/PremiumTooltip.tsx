
import React, { useState, useRef } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
    label: string;
    children: React.ReactNode;
    size?: 'sm' | 'md';
    side?: 'top' | 'bottom';
}

export function PremiumTooltip({ label, children, size = 'md', side }: TooltipProps) {
    const [show, setShow] = useState(false);
    const [coords, setCoords] = useState({ x: 0, y: 0, bottom: 0 });
    const triggerRef = useRef<HTMLDivElement>(null);

    const updateCoords = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setCoords({ x: rect.left + rect.width / 2, y: rect.top, bottom: rect.bottom });
        }
    };

    // Use provided side or auto-flip based on space
    const isNearTop = side === 'bottom' || (side !== 'top' && coords.y < 80);

    return (
        <>
            <div
                ref={triggerRef}
                onMouseEnter={() => { updateCoords(); setShow(true); }}
                onMouseLeave={() => setShow(false)}
                className="inline-flex"
            >
                {children}
            </div>

            {show && createPortal(
                <div
                    style={{
                        position: 'fixed',
                        left: `${coords.x}px`,
                        top: `${isNearTop ? coords.bottom + 6 : coords.y - 6}px`,
                        transform: isNearTop ? 'translateX(-50%)' : 'translate(-50%, -100%)',
                        pointerEvents: 'none',
                        zIndex: 9999,
                    }}
                    className={`animate-in fade-in ${isNearTop ? 'slide-in-from-top-1' : 'slide-in-from-bottom-1'} zoom-in-95 duration-200`}
                >
                    <div className={`
                        ${size === 'sm' ? 'px-2 py-0.5' : 'px-3 py-1'} 
                        rounded-full bg-white/[0.03] border border-white/5 backdrop-blur-md shadow-sm flex items-center justify-center
                    `}>
                        <span className={`
                            ${size === 'sm' ? 'text-[7px]' : 'text-[8px]'} 
                            font-black uppercase tracking-[0.2em] text-white/80 whitespace-nowrap leading-none text-center block
                        `}>
                            {label}
                        </span>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
