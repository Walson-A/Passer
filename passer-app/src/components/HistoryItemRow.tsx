
import { HistoryItem } from "../hooks/useHistory";
import {
    FileText,
    Image as ImageIcon,
    Video,
    Archive,
    AppWindow,
    File,
    ArrowDown,
    ArrowUp,
    AlertCircle,
    CheckCircle2,
    Copy,
    Trash2,
    ExternalLink
} from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useState } from "react";

interface Props {
    item: HistoryItem;
    isLatest?: boolean;
}

export function HistoryItemRow({ item, isLatest = false }: Props) {
    const isIncoming = item.direction === 'incoming';
    const [isHovered, setIsHovered] = useState(false);

    // Optimized proportions for tight window
    const containerClasses = `
        group relative flex items-center gap-3 p-3 rounded-2xl border transition-all duration-500 cursor-default overflow-hidden
        ${isLatest
            ? 'bg-white/[0.07] border-white/10 shadow-2xl shadow-black/40 scale-100 opacity-100 animate-glow-flash'
            : 'bg-white/[0.02] border-white/[0.01] hover:bg-white/[0.04] hover:border-white/5 scale-[0.99] opacity-90 hover:opacity-100 hover:scale-100'
        }
        active:scale-[0.98] transition-all duration-200
    `;

    return (
        <div
            className={containerClasses}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Thumbnail / Icon Area - Slightly smaller & refined */}
            <div className="relative w-11 h-11 rounded-lg bg-white/5 flex items-center justify-center overflow-hidden shrink-0 border border-white/5 shadow-inner">
                <Thumbnail item={item} />

                {/* Direction Badge - Minimalist & Pinned corner */}
                <div className={`
                    absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border border-white/10 shadow-lg
                    ${isIncoming ? 'bg-blue-600/90' : 'bg-orange-600/90'}
                `}>
                    {isIncoming ?
                        <ArrowDown className="w-2.5 h-2.5 text-white" /> :
                        <ArrowUp className="w-2.5 h-2.5 text-white" />
                    }
                </div>
            </div>

            {/* Content Info - Improved spacing & hierarchy */}
            <div className={`flex-1 min-w-0 flex flex-col justify-center gap-0.5 transition-all duration-300 ${isHovered ? 'opacity-20 blur-[2px]' : 'opacity-100'}`}>
                <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold text-white/90 truncate pr-2 tracking-tight">
                        {item.name}
                    </span>
                    <span className="shrink-0">
                        {item.status === 'error' && <AlertCircle className="w-3.5 h-3.5 text-red-500/60" />}
                        {item.status === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/40" />}
                        {item.status === 'pending' && <div className="w-1.5 h-1.5 rounded-full bg-amber-500/40 animate-pulse" />}
                    </span>
                </div>

                {/* Secondary Info / Text Preview */}
                <div className="flex flex-col gap-0.5 mt-[-2px]">
                    {item.type === 'text' && item.description && (
                        <p className="text-[9px] font-mono text-white/30 line-clamp-1 leading-none bg-white/[0.03] px-1 py-0.5 rounded-sm border border-white/5 w-fit max-w-full italic mb-0.5">
                            {item.description}
                        </p>
                    )}
                    <div className="flex items-center gap-1.5 text-[9px] text-white/20 font-black uppercase tracking-[0.15em]">
                        <span className={`
                             transition-colors
                            ${getTypeColor(item.type)}
                        `}>
                            {item.type}
                        </span>
                        <span className="opacity-10">•</span>
                        <span>{timeAgo(item.timestamp)}</span>
                    </div>
                </div>
            </div>

            {/* Quick Actions (Hover Overlay - Compact & Centered) */}
            <div className={`
                absolute inset-0 flex items-center justify-center gap-2 transition-all duration-300 bg-black/40 backdrop-blur-[2px]
                ${isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}
            `}>
                <ActionButton icon={<Copy className="w-3.5 h-3.5" />} label="Copy" onClick={() => { }} color="bg-white/10 hover:bg-white/20" />
                {item.type !== 'text' && <ActionButton icon={<ExternalLink className="w-3.5 h-3.5" />} label="Open" onClick={() => { }} color="bg-white/10 hover:bg-white/20" />}
                <ActionButton icon={<Trash2 className="w-3.5 h-3.5" />} label="Delete" onClick={() => { }} color="bg-red-500/20 hover:bg-red-500/30 text-red-400" />
            </div>
        </div>
    );
}

function Thumbnail({ item }: { item: HistoryItem }) {
    if (item.type === 'image' && item.rawPath && item.status === 'success') {
        const src = convertFileSrc(item.rawPath);
        console.log("[Passer] Generated image src:", src); // Debug log
        return (
            <img
                src={src}
                alt={item.name}
                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                loading="lazy"
                onError={(e) => {
                    console.error("[Passer] Image preview failed to load:", src);
                    // Hide the broken image to show the fallback icon
                    (e.target as HTMLImageElement).style.display = 'none';
                }}
            />
        );
    }

    const iconClasses = "w-5 h-5 opacity-30 group-hover:opacity-50 transition-all duration-300";
    if (item.type === 'text') return <FileText className={`${iconClasses} text-emerald-400`} />;
    if (item.type === 'image') return <ImageIcon className={`${iconClasses} text-blue-400`} />;
    if (item.type === 'video') return <Video className={`${iconClasses} text-pink-400`} />;
    if (item.type === 'archive') return <Archive className={`${iconClasses} text-yellow-400`} />;
    if (item.direction === 'outgoing' && !item.rawPath) return <AppWindow className={`${iconClasses} text-indigo-400`} />;

    return <File className={`${iconClasses} text-white/40`} />;
}

function ActionButton({ icon, label, onClick, color }: { icon: React.ReactNode, label: string, onClick: () => void, color: string }) {
    return (
        <button
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className={`flex items-center justify-center p-2 rounded-xl border border-white/5 transition-all duration-200 active:scale-90 group/btn relative ${color} shadow-lg`}
        >
            {icon}
            <span className="absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-black/80 text-[8px] font-black text-white/80 opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-white/5 backdrop-blur-md uppercase tracking-wider">
                {label}
            </span>
        </button>
    );
}

function getTypeColor(type: string) {
    switch (type) {
        case 'image': return 'text-blue-400/50';
        case 'text': return 'text-emerald-400/50';
        case 'video': return 'text-pink-400/50';
        case 'archive': return 'text-yellow-400/50';
        default: return 'text-white/20';
    }
}

function timeAgo(timestamp: number) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return "Now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return "1d";
}
