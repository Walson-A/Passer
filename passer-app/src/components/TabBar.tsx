import { useEffect } from "react";
import { motion, useSpring, useVelocity, useTransform, useReducedMotion } from "framer-motion";
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
    const reduce = useReducedMotion();

    // Position in percent of the indicator's own width, so one tab = 100%.
    // A spring rather than an overshoot curve: the previous --ease-spring
    // (1.275) sent the dot past its target and back, which at 4px reads as
    // missing the mark rather than as life.
    const pos = useSpring(index * 100, reduce
        ? { stiffness: 1000, damping: 100 }
        : { stiffness: 420, damping: 34, mass: 0.7 });

    useEffect(() => {
        pos.set(index * 100);
    }, [index, pos]);

    // Stretch with speed: the dot elongates into a pill while travelling and
    // settles back into a circle on arrival. Transitions cannot do this - the
    // value has to rise and fall within a single move.
    const velocity = useVelocity(pos);
    const stretch = useTransform(velocity, [-500, 0, 500], [2.4, 1, 2.4], { clamp: true });

    const transform = useTransform(
        [pos, stretch],
        ([p, s]: number[]) => `translateX(${p}%) scaleX(${reduce ? 1 : s})`
    );

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

                <motion.div
                    aria-hidden
                    className="absolute -bottom-2 left-0 flex justify-center"
                    style={{ width: `${100 / TABS.length}%`, transform }}
                >
                    <span className="w-1 h-1 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.9)]" />
                </motion.div>
            </div>
        </nav>
    );
}
