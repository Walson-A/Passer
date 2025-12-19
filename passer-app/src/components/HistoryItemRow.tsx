
import { HistoryItem } from "../hooks/useHistory";
import {
    FileText,
    Image as ImageIcon,
    Video,
    Archive,
    AppWindow,
    File,
    Copy,
    Trash2,
    ExternalLink,
    Clipboard,
    Folder,
    Check
} from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useState } from "react";
import { PremiumTooltip } from "./PremiumTooltip";

interface Props {
    item: HistoryItem;
    isLatest?: boolean;
    onDelete?: (id: string) => void;
}

export function HistoryItemRow({ item, isLatest = false, onDelete }: Props) {
    const [isHovered, setIsHovered] = useState(false);

    // Determine which actions to show
    const canCopy = item.target === 'clipboard' || item.type === 'text' || item.type === 'image';
    const canRevealFolder = item.target === 'folder' && item.rawPath;

    // Fixed height (h-[76px]) Ensures uniformity across all types
    const containerClasses = `
        group relative flex items-stretch h-[76px] rounded-xl border transition-all duration-300 cursor-default select-none
        ${isLatest
            ? 'bg-white/[0.02] border-white/40 shadow-[0_0_8px_rgba(255,255,255,0.1)]'
            : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.05] hover:border-white/10 opacity-90 hover:opacity-100'
        }
        active:scale-[0.99]
    `;

    return (
        <div className={containerClasses} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
            {/* LARGE LEFT AREA: CONTENT */}
            <div className={`flex flex-1 items-center gap-3 p-3 min-w-0 transition-all duration-300 ${isHovered ? 'opacity-20 blur-[2px]' : 'opacity-100'}`}>
                {item.type === 'text' ? (
                    /* TEXT: Natural flow - line-clamp-3 for max visibility in fixed 76px */
                    <div className="flex-1 min-w-0">
                        <p className="text-[11.5px] font-normal text-white/85 line-clamp-3 leading-relaxed break-words overflow-hidden">
                            {item.name}
                        </p>
                    </div>
                ) : (
                    /* IMAGE/FILE: Visual anchor + info */
                    <div className="flex items-center gap-3.5 flex-1 min-w-0">
                        <div className={`relative shrink-0 ${item.type === 'image' ? 'w-32 h-[52px]' : 'w-11 h-11'} rounded-lg bg-white/[0.05] flex items-center justify-center overflow-hidden border border-white/10 shadow-inner transition-all duration-300`}>
                            <Thumbnail item={item} />
                        </div>

                        {(item.name || item.fileSize) && (
                            <div className="flex-1 min-w-0">
                                {item.name && (
                                    <h3 className="text-[12px] font-semibold text-white/95 leading-tight line-clamp-2 tracking-tight">
                                        {item.name}
                                    </h3>
                                )}
                                {item.fileSize && (
                                    <p className="text-[9.5px] font-medium text-white/35 mt-0.5">
                                        {item.fileSize}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* MINIMAL RIGHT AREA: METADATA COLUMN */}
            <div className={`shrink-0 w-[42px] flex flex-col items-center justify-between py-3.5 px-0.5 transition-all duration-300 ${isHovered ? 'opacity-20 blur-[2px]' : 'opacity-100'}`}>
                {/* Timestamp (Strictly TOP) - Lowercase, readable font */}
                <div className="w-full flex justify-center">
                    <span className="text-[9px] font-medium text-white/40 tracking-tight whitespace-nowrap leading-none font-sans lowercase">
                        {timeAgo(item.timestamp)}
                    </span>
                </div>

                {/* Dest Icon (Strictly BOTTOM) - Now without arrow */}
                <div className="w-full flex items-center justify-center pb-0.5">
                    <div className="flex items-center justify-center">
                        {item.target === 'clipboard' ?
                            <Clipboard className="w-[15px] h-[15px] text-emerald-400/60" strokeWidth={2.5} /> :
                            <Folder className="w-[15px] h-[15px] text-orange-400/60" strokeWidth={2.5} />
                        }
                    </div>
                </div>
            </div>

            {/* HOVER OVERLAY: ACTIONS */}
            <div className={`
                absolute inset-0 flex items-center justify-center gap-3 transition-all duration-200 backdrop-blur-sm bg-black/50 rounded-xl
                ${isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}
            `}>
                {/* Copy button - show for clipboard items or clipboard-compatible types */}
                {canCopy && (
                    <ActionButton
                        icon={<Copy className="w-4 h-4" strokeWidth={2.5} />}
                        label="Copy"
                        onClick={async () => {
                            if (item.type === 'text') {
                                await navigator.clipboard.writeText(item.name);
                            } else if (item.type === 'image' && item.rawPath) {
                                // For images, read as blob and copy to clipboard
                                try {
                                    const response = await fetch(convertFileSrc(item.rawPath));
                                    const blob = await response.blob();
                                    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
                                } catch (e) {
                                    console.error('Failed to copy image:', e);
                                }
                            }
                        }}
                        color="bg-white/10 hover:bg-white/20 text-white border-white/20"
                    />
                )}

                {/* Reveal in folder - only for folder items */}
                {canRevealFolder && (
                    <ActionButton
                        icon={<ExternalLink className="w-4 h-4" strokeWidth={2.5} />}
                        label="Open Folder"
                        onClick={async () => {
                            try {
                                await revealItemInDir(item.rawPath!);
                            } catch (e) {
                                console.error('Failed to reveal item:', e);
                            }
                        }}
                        color="bg-white/10 hover:bg-white/20 text-white border-white/20"
                    />
                )}

                {/* Delete button - always available */}
                <ActionButton
                    icon={<Trash2 className="w-4 h-4" strokeWidth={2.5} />}
                    label="Delete"
                    onClick={() => {
                        if (onDelete) onDelete(item.id);
                    }}
                    color="bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/30"
                />
            </div>
        </div>
    );
}

function Thumbnail({ item }: { item: HistoryItem }) {
    if (item.type === 'image' && item.rawPath && item.status === 'success') {
        const src = convertFileSrc(item.rawPath);
        return (
            <img
                src={src}
                alt={item.name}
                className="w-full h-full object-cover transition-opacity duration-300 group-hover:opacity-40"
                loading="lazy"
                onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                }}
            />
        );
    }
    const iconClasses = "w-5 h-5 opacity-50 group-hover:opacity-60 transition-all duration-300";
    const strokeWidth = 2;
    if (item.type === 'text') return <FileText className={`${iconClasses} text-white/40`} strokeWidth={strokeWidth} />;
    if (item.type === 'image') return <ImageIcon className={`${iconClasses} text-blue-400/50`} strokeWidth={strokeWidth} />;
    if (item.type === 'video') return <Video className={`${iconClasses} text-pink-400/50`} strokeWidth={strokeWidth} />;
    if (item.type === 'archive') return <Archive className={`${iconClasses} text-yellow-400/50`} strokeWidth={strokeWidth} />;
    if (item.direction === 'outgoing' && !item.rawPath) return <AppWindow className={`${iconClasses} text-indigo-400/50`} strokeWidth={strokeWidth} />;
    return <File className={`${iconClasses} text-white/40`} strokeWidth={strokeWidth} />;
}

function ActionButton({ icon, label, onClick, color }: { icon: React.ReactNode, label: string, onClick: () => void | Promise<void>, color: string }) {
    const [isSuccess, setIsSuccess] = useState(false);

    const handleClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await onClick();
            if (label === "Copy") {
                setIsSuccess(true);
                setTimeout(() => setIsSuccess(false), 2000);
            }
        } catch (e) {
            console.error("Action failed", e);
        }
    };

    return (
        <PremiumTooltip label={isSuccess ? "Copied!" : label} size="sm">
            <button
                onClick={handleClick}
                className={`
                    flex items-center justify-center w-10 h-10 rounded-xl border transition-all duration-300 active:scale-90 group/btn relative shadow-lg
                    ${isSuccess
                        ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                        : `${color} backdrop-blur-md`}
                `}
            >
                {/* Ping Animation on Success */}
                {isSuccess && (
                    <span className="absolute inset-0 rounded-xl bg-emerald-400/20 animate-ping pointer-events-none" />
                )}

                <div className={`transition-all duration-300 ${isSuccess ? "scale-110" : "scale-100"}`}>
                    {isSuccess ? <Check className="w-4 h-4" strokeWidth={3} /> : icon}
                </div>
            </button>
        </PremiumTooltip>
    );
}

function timeAgo(timestamp: number) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return "now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return "1d ago";
}
