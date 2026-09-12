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

/**
 * Destination picker. Deliberately chrome-less: the rest of the app lives in
 * barely-there surfaces, so a bordered container with a filled pill made this
 * the heaviest element on screen. The active state is carried by brightness
 * and the app's existing glow vocabulary instead.
 */
export function TabBar({ view, onChange }: Props) {
    const index = Math.max(0, TABS.findIndex(t => t.id === view));

    return (
        <nav className="shrink-0 px-6 pt-2 pb-5 relative z-50">
            <div className="relative flex items-center">
                {TABS.map(({ id, label, Icon }) => {
                    const active = id === view;
                    return (
                        <button
                            key={id}
                            onClick={() => onChange(id)}
                            aria-current={active ? "page" : undefined}
                            className={`relative flex-1 flex flex-col items-center gap-1.5 py-1.5 rounded-xl cursor-pointer
                                transition-colors duration-200 active:scale-[0.96]
                                ${active ? "text-white" : "text-white/35 hover:text-white/70"}`}
                        >
                            <Icon
                                className={`w-[18px] h-[18px] transition-all duration-200
                                    ${active ? "drop-shadow-[0_0_8px_rgba(96,165,250,0.55)]" : ""}`}
                                strokeWidth={1.75}
                            />
                            <span className="text-[8px] font-black uppercase tracking-[0.15em] leading-none">
                                {label}
                            </span>
                        </button>
                    );
                })}

                {/* Sliding dot. Equal-width tabs, so the offset is its own width
                    times the active index. */}
                <div
                    aria-hidden
                    className="tab-indicator absolute -bottom-2 left-0 flex justify-center"
                    style={{
                        width: `${100 / TABS.length}%`,
                        transform: `translateX(calc(${index} * 100%))`,
                    }}
                >
                    <span className="w-1 h-1 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.9)]" />
                </div>
            </div>
        </nav>
    );
}
