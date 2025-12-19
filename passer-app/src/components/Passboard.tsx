
import { useHistory } from "../hooks/useHistory";
import { HistoryItemRow } from "./HistoryItemRow";
import { Clock, Trash2 } from "lucide-react";

export function Passboard() {
    const { history, clearHistory, deleteHistoryItem } = useHistory();

    // Filter to only show incoming transfers (PC as receiver)
    const incomingHistory = history.filter(item => item.direction === 'incoming');

    return (
        <div className="w-full flex-1 flex flex-col min-h-0 px-4 pt-6 pb-2 relative">
            {/* Header / Section Divider */}
            <div className="flex items-center justify-between px-0 mb-4 opacity-0 animate-fade-in" style={{ animationDelay: '0.2s' }}>
                <div className="flex items-center gap-2.5 flex-1">
                    <span className="text-[10px] uppercase font-black text-white/40 tracking-[0.4em] whitespace-nowrap">
                        RECENT
                    </span>
                    <div className="h-px flex-1 bg-gradient-to-r from-white/40 to-transparent" />
                </div>

                {incomingHistory.length > 0 && (
                    <button
                        onClick={clearHistory}
                        className="ml-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/5 hover:bg-white/[0.08] hover:border-white/10 text-white/40 hover:text-white/80 transition-all duration-300 group shadow-sm active:scale-95"
                    >
                        <Trash2 className="w-3 h-3 transition-colors text-white/40 group-hover:text-red-400" />
                        <span className="text-[8px] font-bold uppercase tracking-widest text-white/40 group-hover:text-white/80">Clear All</span>
                    </button>
                )}
            </div>

            {/* Scrollable Feed Container */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-2 min-h-0 pt-2 pb-6 pr-0.5 custom-scrollbar">
                {incomingHistory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in px-4 pb-16">
                        <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center mb-4 shadow-inner">
                            <Clock className="w-5 h-5 text-white/15" strokeWidth={2} />
                        </div>
                        <h3 className="text-xs font-bold text-white/50 mb-1.5 uppercase tracking-wide">Empty Feed</h3>
                        <p className="text-[10px] font-medium text-white/30 leading-relaxed max-w-[160px] mx-auto">
                            Push or Pass from another device to see items here.
                        </p>
                    </div>
                ) : (
                    incomingHistory.map((item, index) => (
                        <div
                            key={item.id}
                            className="animate-slide-in-visceral"
                            style={{ animationDelay: `${index * 0.1}s` }}
                        >
                            <HistoryItemRow
                                item={item}
                                isLatest={index === 0}
                                onDelete={deleteHistoryItem}
                            />
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
