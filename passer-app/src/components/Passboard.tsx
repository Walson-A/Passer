
import { useHistory } from "../hooks/useHistory";
import { HistoryItemRow } from "./HistoryItemRow";
import { Clock, Trash2 } from "lucide-react";

export function Passboard() {
    const { history, clearHistory } = useHistory();

    return (
        <div className="w-full flex-1 flex flex-col min-h-0 px-5 pt-8 pb-3">
            {/* Header / Section Divider */}
            <div className="flex items-center justify-between px-0 mb-6 opacity-0 animate-fade-in" style={{ animationDelay: '0.2s' }}>
                <div className="flex items-center gap-2.5 flex-1">
                    <span className="text-[10px] uppercase font-black text-white/10 tracking-[0.4em] whitespace-nowrap">
                        Passboard
                    </span>
                    <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
                </div>

                {history.length > 0 && (
                    <button
                        onClick={clearHistory}
                        className="ml-3 flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.02] border border-white/5 hover:bg-red-500/10 hover:border-red-500/20 text-white/20 hover:text-red-400 transition-all duration-300 group"
                    >
                        <Trash2 className="w-3 h-3 transition-transform group-hover:scale-110" />
                        <span className="text-[8px] font-black uppercase tracking-widest">Clear All</span>
                    </button>
                )}
            </div>

            {/* Scrollable Feed Container */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-2 min-h-0 pt-1 pb-6 pr-1 custom-scrollbar">
                {history.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in px-4 pb-16">
                        <div className="w-12 h-12 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center mb-5 shadow-inner">
                            <Clock className="w-6 h-6 text-white/5" />
                        </div>
                        <h3 className="text-xs font-bold text-white/40 mb-1.5 uppercase tracking-wide">Empty Feed</h3>
                        <p className="text-[10px] font-medium text-white/20 leading-relaxed max-w-[160px] mx-auto">
                            Copy on another device to see items here.
                        </p>
                    </div>
                ) : (
                    history.map((item, index) => (
                        <div
                            key={item.id}
                            className="animate-elastic-slide-in"
                            style={{ animationDelay: `${index * 0.04}s` }}
                        >
                            <HistoryItemRow
                                item={item}
                                isLatest={index === 0}
                            />
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
