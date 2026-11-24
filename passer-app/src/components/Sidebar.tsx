import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Check, Inbox, Loader2, MonitorSmartphone, OctagonX, Settings as SettingsIcon } from "lucide-react";
import { FOCUS, type DevicesStatus } from "./deviceUi";

export type View = "devices" | "passboard" | "settings";

// Devices first: it is what Passer is about now. Space - a folder shared at
// the OS level - is folded away until passer-core can stream files of any size.
const MAIN = [
    { id: "devices" as const, label: "Devices", Icon: MonitorSmartphone },
    { id: "passboard" as const, label: "Passboard", Icon: Inbox },
];

interface Props {
    view: View;
    onChange: (view: View) => void;
}

/**
 * Destinations, down the left edge of the window. It replaced the bottom tab bar
 * when Passer became a full window: a vertical list leaves the width to the
 * content, and the Devices strip - horizontal - never competes with it.
 *
 * At the foot, the state of this PC on the device network and the way out:
 * "Stop remote activity" ends everything other devices are doing here. It lives
 * here rather than on one device because it concerns the whole PC.
 */
export function Sidebar({ view, onChange }: Props) {
    const item = (id: View, label: string, Icon: typeof Inbox) => {
        const on = id === view;
        return (
            <button
                key={id}
                onClick={() => onChange(id)}
                aria-current={on ? "page" : undefined}
                className={`w-full flex items-center gap-3 h-10 px-3 rounded-xl text-[13px] font-semibold transition-all duration-200 cursor-pointer active:scale-[0.98] ${FOCUS}
                    ${on
                        ? "bg-white/[0.07] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                        : "text-white/55 hover:text-white/85 hover:bg-white/[0.03]"}`}
            >
                <Icon
                    className={`w-[18px] h-[18px] transition-all duration-200 ${on ? "text-blue-300 drop-shadow-[0_0_8px_rgba(96,165,250,0.55)]" : ""}`}
                    strokeWidth={1.75}
                    aria-hidden
                />
                {label}
            </button>
        );
    };

    return (
        <nav className="shrink-0 w-[208px] flex flex-col gap-1 px-3 py-4 border-r border-white/[0.05]" aria-label="Passer">
            {MAIN.map(m => item(m.id, m.label, m.Icon))}
            <div className="mt-auto flex flex-col gap-2">
                {item("settings", "Settings", SettingsIcon)}
                <NetworkCard />
            </div>
        </nav>
    );
}

function NetworkCard() {
    const [status, setStatus] = useState<DevicesStatus | null>(null);
    const [busy, setBusy] = useState(false);
    const [stopped, setStopped] = useState(false);

    useEffect(() => {
        let alive = true;
        const load = () => invoke<DevicesStatus>("devices_status")
            .then(s => { if (alive) setStatus(s); })
            .catch(() => { if (alive) setStatus(null); });
        load();
        const t = setInterval(load, 8000);
        return () => { alive = false; clearInterval(t); };
    }, []);

    // Nothing to say before this PC belongs to a group.
    if (!status?.group) return null;
    const others = status.members.length - 1;

    const stop = async () => {
        if (busy) return;
        setBusy(true);
        try {
            await invoke("devices_stop_sessions");
            setStopped(true);
            setTimeout(() => setStopped(false), 2500);
        } catch (e) {
            console.error("stop failed", e);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="mx-1 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]" role="status">
            <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${status.running
                    ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]"
                    : "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.3)]"}`} aria-hidden />
                <span className="text-[11px] font-bold text-white/85">{status.running ? "Ready" : "Offline"}</span>
            </div>
            <p className="text-[11px] text-white/50 mt-1 leading-snug">
                {status.running ? "Your devices can reach this PC" : "Your devices can't reach this PC"}
            </p>
            {others > 0 && (
                <button
                    onClick={stop}
                    disabled={busy || !status.running}
                    aria-live="polite"
                    className={`w-full flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-white/[0.06] text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed rounded ${FOCUS}
                        ${stopped ? "text-emerald-300" : "text-red-200/85 hover:text-red-100"}`}
                >
                    {busy
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} aria-hidden />
                        : stopped
                            ? <Check className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden />
                            : <OctagonX className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />}
                    {stopped ? "Stopped" : "Stop remote activity"}
                </button>
            )}
        </div>
    );
}
