import { invoke } from "@tauri-apps/api/core";
import type { HistoryItem } from "../hooks/useHistory";
import { HistoryItemRow } from "./HistoryItemRow";
import { FolderOpen, Inbox, Trash2 } from "lucide-react";
import { FOCUS } from "./deviceUi";

/** All items, one device's (by id), or the ones from iOS Shortcuts (no device). */
export type PassboardFilter = { kind: "all" } | { kind: "device"; id: string } | { kind: "shortcuts" };

interface Props {
    history: HistoryItem[];
    filter: PassboardFilter;
    onFilter: (f: PassboardFilter) => void;
    onClear: () => void;
    onDelete: (id: string) => void;
}

/**
 * The Passboard: everything that passed between your devices and this PC -
 * texts, photos, files - newest first, each saying which device it came from
 * or went to. Filtered by device from the chips, or from a device's stage.
 * What arrives as a file is in the Passboard folder.
 */
export function Passboard({ history, filter, onFilter, onClear, onDelete }: Props) {
    const openFolder = async () => {
        try {
            await invoke("open_downloads");
        } catch (e) {
            console.error("Failed to open folder", e);
        }
    };

    // One chip per device seen in the feed, in order of first appearance.
    const devices: { id: string; name: string }[] = [];
    for (const h of history) {
        if (h.deviceId && !devices.some(d => d.id === h.deviceId)) devices.push({ id: h.deviceId, name: h.device ?? "" });
    }
    const fromShortcuts = history.some(h => !h.deviceId);
    const shown = history.filter(h =>
        filter.kind === "all" ? true : filter.kind === "shortcuts" ? !h.deviceId : h.deviceId === filter.id);

    const chip = (on: boolean, label: string, f: PassboardFilter) => (
        <button
            key={label}
            onClick={() => onFilter(f)}
            aria-pressed={on}
            className={`shrink-0 h-8 px-3.5 rounded-full border text-[12px] font-semibold transition-all duration-200 cursor-pointer active:scale-[0.98] ${FOCUS}
                ${on ? "bg-white/[0.09] border-white/20 text-white" : "bg-white/[0.02] border-white/[0.07] text-white/60 hover:text-white/85 hover:border-white/15"}`}
        >
            {label}
        </button>
    );

    return (
        <div className="flex-1 min-h-0 w-full max-w-[920px] mx-auto flex flex-col px-8 pt-6">
            {/* Header */}
            <div className="shrink-0 flex items-end justify-between gap-4">
                <div className="min-w-0">
                    <h1 className="text-[12px] font-black uppercase tracking-[0.22em] text-white/75">Passboard</h1>
                    <p className="text-[13px] text-white/55 mt-1.5">What your devices sent to this PC, and what it sent them</p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                    {history.length > 0 && (
                        <button
                            onClick={onClear}
                            className={`flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-white/10 bg-white/[0.03] text-[12px] font-semibold text-white/65 hover:text-white hover:border-white/20 transition-all active:scale-[0.98] cursor-pointer ${FOCUS}`}
                        >
                            <Trash2 className="w-3.5 h-3.5" strokeWidth={2} aria-hidden /> Clear the list
                        </button>
                    )}
                    <button
                        onClick={openFolder}
                        className={`flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-white/10 bg-white/[0.03] text-[12px] font-semibold text-white/80 hover:text-white hover:border-white/20 transition-all active:scale-[0.98] cursor-pointer ${FOCUS}`}
                    >
                        <FolderOpen className="w-3.5 h-3.5 text-[var(--accent-warm)]" strokeWidth={2} aria-hidden /> Open the folder
                    </button>
                </div>
            </div>

            {/* By device */}
            {(devices.length > 0 || fromShortcuts) && (
                <div className="shrink-0 flex gap-2 mt-5 overflow-x-auto custom-scrollbar pb-1" role="group" aria-label="Show">
                    {chip(filter.kind === "all", "All", { kind: "all" })}
                    {devices.map(d => chip(filter.kind === "device" && filter.id === d.id, d.name, { kind: "device", id: d.id }))}
                    {fromShortcuts && chip(filter.kind === "shortcuts", "iOS Shortcuts", { kind: "shortcuts" })}
                </div>
            )}

            {/* The feed */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar mt-4 pb-6">
                {shown.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center pb-16 rise">
                        <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center">
                            <Inbox className="w-5 h-5 text-white/45" strokeWidth={1.75} aria-hidden />
                        </div>
                        <p className="text-[14px] font-bold text-white/85 mt-4">Nothing here yet</p>
                        <p className="text-[13px] text-white/55 mt-1.5 max-w-[340px] leading-snug">
                            {history.length === 0
                                ? "Texts, photos and files your devices send to this PC will appear here."
                                : "Nothing with this device since Passer started."}
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(330px,1fr))]">
                        {shown.map((item, index) => (
                            <div key={item.id} className="rise" style={{ ["--i" as string]: Math.min(index, 8) }}>
                                <HistoryItemRow item={item} isLatest={index === 0 && filter.kind === "all"} onDelete={onDelete} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
