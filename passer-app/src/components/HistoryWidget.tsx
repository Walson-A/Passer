
interface HistoryItem {
    name: string;
    time: string;
    type: string;
}

interface HistoryWidgetProps {
    items: HistoryItem[];
}

export function HistoryWidget({ items }: HistoryWidgetProps) {
    return (
        <div className="w-full px-6 mt-4">
            <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase font-bold text-white/50 tracking-wider">Recent</span>
                <button className="text-[10px] text-white/50 hover:text-white transition-colors cursor-pointer">View History</button>
            </div>

            <div className="space-y-2">
                {items.length === 0 && (
                    <div className="text-xs text-white/20 italic text-center py-2">No recent items</div>
                )}
                {items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group cursor-default">
                        <div className="flex items-center gap-3 overflow-hidden">
                            {/* Icon Placeholder based on type */}
                            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[10px] font-bold text-white/60">
                                {item.type.slice(0, 3).toUpperCase()}
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-sm text-white/90 truncate font-medium">{item.name}</span>
                                <span className="text-[10px] text-white/40">{item.time}</span>
                            </div>
                        </div>

                        {/* Arrow Icon */}
                        <svg className="w-4 h-4 text-white/20 group-hover:text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                    </div>
                ))}
            </div>
        </div>
    );
}
