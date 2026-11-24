import { ChevronLeft, ChevronRight, ClipboardCopy, ClipboardPaste, FileUp, Lock, MonitorPlay, OctagonX, Plus, QrCode, ShieldCheck, SlidersHorizontal, Volume2 } from "lucide-react";
import { DEVICES } from "./donnees";
import { Fenetre, Futur, Presence } from "./Fenetre";
import { Rendu } from "./Rendu";

/**
 * A · Showroom. One device large under a spotlight, like a product page; its
 * name and state on the left, what is happening with it on the right, what you
 * can do with it as big round buttons, the others in a carousel. The same idea
 * Walson chose for Atlas's Devices space, in Passer's vocabulary: the commands
 * are what passer-core lets this PC ask of that device.
 */
export function Showroom() {
    const d = DEVICES[0];
    return (
        <Fenetre>
            <div className="absolute inset-0 flex flex-col">
                {/* Header */}
                <div className="shrink-0 flex items-end justify-between px-9 pt-7">
                    <div>
                        <h1 className="text-[12px] font-black uppercase tracking-[0.22em] text-white/75">My devices</h1>
                        <p className="text-[13px] text-white/50 mt-1.5">4 devices · 2 online<Futur /></p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="flex items-center gap-2 h-9 px-4 rounded-xl border border-white/10 bg-white/[0.03] text-[12px] font-semibold text-white/70">
                            <OctagonX className="w-4 h-4 text-red-300" strokeWidth={2} /> Stop remote activity
                        </span>
                        <span className="flex items-center gap-2 h-9 px-4 rounded-xl border border-blue-400/40 bg-blue-500/20 text-[12px] font-semibold text-blue-50">
                            <QrCode className="w-4 h-4" strokeWidth={2} /> Add a device
                        </span>
                    </div>
                </div>

                {/* Stage */}
                <div className="relative flex-1 min-h-0 grid grid-cols-[260px_1fr_260px] items-center px-9">
                    {/* spotlight */}
                    <div className="pointer-events-none absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 w-[560px] h-[420px] bg-[radial-gradient(closest-side,rgba(96,165,250,0.16),rgba(168,85,247,0.06)_55%,transparent)]" />

                    <div className="relative flex flex-col items-end text-right gap-3">
                        <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08]">
                            <Presence d={d} /><Futur />
                        </span>
                        <h2 className="text-[34px] leading-[1.05] font-bold tracking-tight">{d.name}</h2>
                        <p className="text-[13px] text-white/55">{d.os}<Futur /> · <span className="font-mono text-white/45">{d.id}</span></p>
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-400/20 text-[11px] font-bold text-amber-200/90">
                            <ShieldCheck className="w-3.5 h-3.5" strokeWidth={2.25} /> Manages devices
                        </span>
                        <span className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-white/50">
                            <SlidersHorizontal className="w-3.5 h-3.5" strokeWidth={2} /> Permissions and details
                        </span>
                    </div>

                    <div className="relative flex items-center justify-center">
                        <div className="drop-shadow-[0_30px_40px_rgba(0,0,0,0.6)]">
                            <Rendu kind={d.kind} screen={d.screen} size={1.05} />
                        </div>
                        <div className="absolute bottom-[-6px] w-[200px] h-6 rounded-[50%] bg-black/60 blur-xl" />
                    </div>

                    <div className="relative flex flex-col gap-3">
                        <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.07]">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Last from it</p>
                            <div className="flex items-center gap-3 mt-3">
                                <div className="flex -space-x-3">
                                    <span className="w-11 h-11 rounded-lg border-2 border-[#121212] bg-gradient-to-br from-orange-400 to-violet-600" />
                                    <span className="w-11 h-11 rounded-lg border-2 border-[#121212] bg-gradient-to-br from-cyan-400 to-blue-700" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[13px] font-bold">2 photos</p>
                                    <p className="text-[12px] text-white/50">In Passboard · 11:05</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.07] flex items-center gap-4">
                            <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90 shrink-0">
                                <circle cx="24" cy="24" r="19" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
                                <circle cx="24" cy="24" r="19" fill="none" stroke="#34d399" strokeWidth="5" strokeLinecap="round" strokeDasharray={119.4} strokeDashoffset={119.4 * 0.36} />
                            </svg>
                            <div>
                                <p className="text-[22px] font-bold leading-none">64 %<Futur /></p>
                                <p className="text-[12px] text-white/50 mt-1">Battery</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Commands */}
                <div className="shrink-0 flex items-start justify-center gap-7 pb-5">
                    {[
                        { Icon: FileUp, label: "Send a file", ready: true },
                        { Icon: ClipboardCopy, label: "Send my clipboard", ready: true },
                        { Icon: ClipboardPaste, label: "Get its clipboard", ready: true, asks: true },
                        { Icon: Volume2, label: "Ring it", soon: true },
                        { Icon: MonitorPlay, label: "See its screen", soon: true },
                    ].map(({ Icon, label, ready, asks, soon }) => (
                        <div key={label} className="flex flex-col items-center gap-2 w-[92px]">
                            <span className={`relative w-[60px] h-[60px] rounded-full flex items-center justify-center border
                                ${ready ? "bg-blue-500/15 border-blue-400/35 text-blue-100 shadow-[0_0_24px_rgba(59,130,246,0.18)]" : "bg-white/[0.03] border-white/10 text-white/40"}`}>
                                <Icon className="w-[22px] h-[22px]" strokeWidth={1.75} />
                                {asks && (
                                    <span className="absolute -right-0.5 -bottom-0.5 w-5 h-5 rounded-full bg-[#121212] border border-amber-400/40 flex items-center justify-center">
                                        <Lock className="w-2.5 h-2.5 text-amber-300" strokeWidth={2.5} />
                                    </span>
                                )}
                            </span>
                            <span className={`text-[12px] font-semibold text-center leading-tight ${ready ? "text-white/85" : "text-white/45"}`}>{label}</span>
                            {soon && <span className="text-[10px] text-white/35 -mt-1">Soon</span>}
                            {asks && <span className="text-[10px] text-amber-200/70 -mt-1">It asks first</span>}
                        </div>
                    ))}
                </div>

                {/* Carousel */}
                <div className="shrink-0 flex items-center justify-center gap-3 pb-6">
                    <span className="w-8 h-8 rounded-full bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-white/45"><ChevronLeft className="w-4 h-4" /></span>
                    {DEVICES.map((x, i) => (
                        <div key={x.id} className={`w-[132px] h-[92px] rounded-2xl flex flex-col items-center justify-end gap-1.5 pb-2.5 border
                            ${i === 0 ? "bg-white/[0.07] border-white/15" : "bg-white/[0.02] border-white/[0.05]"}`}>
                            <div className="h-[48px] flex items-end">
                                <Rendu kind={x.kind} screen={x.screen} size={x.kind === "phone" ? 0.17 : 0.13} dim={x.presence === "offline"} />
                            </div>
                            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-white/80 max-w-[118px]">
                                <Presence d={x} withLabel={false} />
                                <span className="truncate">{x.thisDevice ? "This PC" : x.name}</span>
                            </span>
                        </div>
                    ))}
                    <div className="w-[92px] h-[92px] rounded-2xl border border-dashed border-white/15 flex flex-col items-center justify-center gap-1.5 text-white/50">
                        <Plus className="w-5 h-5" strokeWidth={2} />
                        <span className="text-[11px] font-semibold">Add</span>
                    </div>
                    <span className="w-8 h-8 rounded-full bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-white/45"><ChevronRight className="w-4 h-4" /></span>
                </div>
            </div>
        </Fenetre>
    );
}
