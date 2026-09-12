import { Inbox, Layers, Settings as SettingsIcon } from "lucide-react";

export type View = "passboard" | "space" | "settings";

const TABS = [
    { id: "passboard" as const, label: "Passboard", Icon: Inbox },
    { id: "space" as const, label: "Space", Icon: Layers },
    { id: "settings" as const, label: "Settings", Icon: SettingsIcon },
];

interface Props {
    view: View;
    onChange: (view: View) => void;
}

export function TabBar({ view, onChange }: Props) {
    const index = Math.max(0, TABS.findIndex(t => t.id === view));

    return (
        <nav className="shrink-0 px-4 pb-4 pt-1 relative z-50">
            <div className="relative flex items-center p-1 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                {/* Sliding indicator. The tabs are equal width, so the offset is
                    simply its own width times the active index. */}
                <div
                    aria-hidden
                    className="tab-indicator absolute top-1 bottom-1 left-1 rounded-xl bg-white/[0.07] border border-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
                    style={{
                        width: `calc((100% - 0.5rem) / ${TABS.length})`,
                        transform: `translateX(calc(${index} * 100%))`,
                    }}
                />

                {TABS.map(({ id, label, Icon }) => {
                    const active = id === view;
                    return (
                        <button
                            key={id}
                            onClick={() => onChange(id)}
                            aria-current={active ? "page" : undefined}
                            className={`relative z-10 flex-1 flex flex-col items-center gap-1 py-2 rounded-xl cursor-pointer
                                transition-colors duration-200 active:scale-[0.97]
                                ${active ? "text-white" : "text-white/40 hover:text-white/75"}`}
                        >
                            <Icon className="w-[18px] h-[18px]" strokeWidth={2} />
                            <span className="text-[8.5px] font-black uppercase tracking-[0.12em] leading-none">
                                {label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
