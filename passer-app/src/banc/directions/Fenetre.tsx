import type { ReactNode } from "react";
import { Bot, Inbox, Layers, Minus, MonitorSmartphone, Pin, Search, Settings, Square, X } from "lucide-react";
import type { Device } from "./donnees";

/**
 * The big window every direction lives in: Passer's own title bar (wordmark,
 * pin, window controls) and a sidebar for the destinations that the small panel
 * squeezed into a tab bar. Same dark glass as today, more room.
 */
export function Fenetre({ children, active = "devices" }: { children: ReactNode; active?: string }) {
    const nav = [
        { id: "passboard", label: "Passboard", Icon: Inbox, badge: "3" },
        { id: "space", label: "Space", Icon: Layers },
        { id: "devices", label: "Devices", Icon: MonitorSmartphone },
        { id: "agents", label: "AI agents", Icon: Bot },
    ];
    return (
        <div className="relative w-[1180px] h-[740px] rounded-[22px] overflow-hidden bg-[#121212] shadow-[0_30px_80px_rgba(0,0,0,0.6),inset_0_0_0_1px_rgba(255,255,255,0.09)] flex flex-col text-white">
            {/* Title bar */}
            <div className="shrink-0 h-12 flex items-center justify-between px-5 border-b border-white/[0.05]">
                <span className="text-[13px] font-black tracking-[0.24em] uppercase bg-gradient-to-b from-white to-white/50 bg-clip-text text-transparent">Passer</span>
                <div className="flex items-center gap-2 w-[340px] h-8 px-3 rounded-full bg-white/[0.04] border border-white/[0.06] text-white/40">
                    <Search className="w-3.5 h-3.5" strokeWidth={2} />
                    <span className="text-[12px]">Search files, texts, devices</span>
                    <span className="ml-auto text-[10px] font-bold text-white/30 border border-white/10 rounded px-1.5 py-px">Ctrl K</span>
                </div>
                <div className="flex items-center gap-1 text-white/45">
                    {[Pin, Minus, Square, X].map((I, i) => (
                        <span key={i} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10">
                            <I className="w-3.5 h-3.5" strokeWidth={2} />
                        </span>
                    ))}
                </div>
            </div>

            <div className="flex-1 flex min-h-0">
                {/* Sidebar */}
                <nav className="shrink-0 w-[208px] flex flex-col gap-1 px-3 py-4 border-r border-white/[0.05]">
                    {nav.map(({ id, label, Icon, badge }) => {
                        const on = id === active;
                        return (
                            <div key={id} className={`flex items-center gap-3 h-10 px-3 rounded-xl text-[13px] font-semibold
                                ${on ? "bg-white/[0.07] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]" : "text-white/55"}`}>
                                <Icon className={`w-[18px] h-[18px] ${on ? "text-blue-300 drop-shadow-[0_0_8px_rgba(96,165,250,0.55)]" : ""}`} strokeWidth={1.75} />
                                {label}
                                {badge && <span className="ml-auto text-[10px] font-black px-1.5 py-0.5 rounded-full bg-blue-500/25 text-blue-100">{badge}</span>}
                            </div>
                        );
                    })}
                    <div className="mt-auto flex flex-col gap-1">
                        <div className="flex items-center gap-3 h-10 px-3 rounded-xl text-[13px] font-semibold text-white/55">
                            <Settings className="w-[18px] h-[18px]" strokeWidth={1.75} /> Settings
                        </div>
                        <div className="mx-1 mt-2 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                                <span className="text-[11px] font-bold text-white/80">Ready</span>
                            </div>
                            <p className="text-[11px] text-white/45 mt-1 leading-snug">This PC is reachable by your devices</p>
                        </div>
                    </div>
                </nav>

                <main className="flex-1 min-w-0 relative">{children}</main>
            </div>
        </div>
    );
}

/** Marks a value passer-core does not provide yet. */
export function Futur() {
    return <sup className="text-amber-300/90 font-black ml-0.5" title="Not provided by passer-core yet">✱</sup>;
}

export function Presence({ d, withLabel = true }: { d: Device; withLabel?: boolean }) {
    const cfg = {
        online: { dot: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]", label: d.thisDevice ? "This PC" : "Online" },
        away: { dot: "border-2 border-amber-300/80", label: `Seen ${d.seen}` },
        offline: { dot: "bg-white/25", label: `Offline · ${d.seen}` },
    }[d.presence];
    return (
        <span className="inline-flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
            {withLabel && <span className="text-[12px] font-semibold text-white/70">{cfg.label}</span>}
        </span>
    );
}
