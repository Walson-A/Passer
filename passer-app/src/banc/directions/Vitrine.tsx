import { ChevronRight, ClipboardCopy, ClipboardPaste, FileUp, Lock, Plus, QrCode, ShieldCheck } from "lucide-react";
import { DEVICES, type Device } from "./donnees";
import { Fenetre, Futur, Presence } from "./Fenetre";
import { Rendu } from "./Rendu";

/**
 * A3 · Showroom, after Walson's read of A2: the thread beside the stage was too
 * much - a second column of bubbles, pills and a drop box competing with the
 * device. So the stage takes the whole width again (A's beauty), every device
 * stays visible in the strip (B and C's readability), and what passed between
 * them shrinks to one quiet line under the stage. The whole history, and the
 * permissions, are one click away. To send, drop on the stage.
 */
export function Vitrine() {
    const d = DEVICES[0];
    return (
        <Fenetre stop>
            <div className="absolute inset-0 flex flex-col">
                {/* Header */}
                <div className="shrink-0 flex items-end justify-between px-8 pt-6">
                    <div>
                        <h1 className="text-[12px] font-black uppercase tracking-[0.22em] text-white/75">My devices</h1>
                        <p className="text-[13px] text-white/50 mt-1.5">4 devices · 2 online<Futur /></p>
                    </div>
                    <span className="flex items-center gap-2 h-9 px-4 rounded-xl border border-blue-400/40 bg-blue-500/20 text-[12px] font-semibold text-blue-50">
                        <QrCode className="w-4 h-4" strokeWidth={2} /> Add a device
                    </span>
                </div>

                {/* Every device, at a glance */}
                <div className="shrink-0 flex items-stretch gap-3 px-8 mt-5">
                    {DEVICES.map((x, i) => <Carte key={x.id} d={x} on={i === 0} />)}
                    <div className="w-[56px] shrink-0 rounded-2xl border border-dashed border-white/15 flex items-center justify-center text-white/45" title="Add a device">
                        <Plus className="w-5 h-5" strokeWidth={2} />
                    </div>
                </div>

                {/* The chosen one, alone on stage */}
                <div className="flex-1 min-h-0 px-8 pt-5 pb-6 flex flex-col">
                    <section className="relative flex-1 min-h-0 rounded-3xl overflow-hidden border border-white/[0.05] bg-[radial-gradient(ellipse_at_38%_50%,rgba(96,165,250,0.16),rgba(168,85,247,0.06)_40%,transparent_68%)]">
                        <div className="absolute inset-0 flex items-center justify-center gap-16">
                            <div className="relative shrink-0 flex justify-center">
                                <div className="drop-shadow-[0_28px_36px_rgba(0,0,0,0.6)]">
                                    <Rendu kind={d.kind} screen={d.screen} size={1.02} />
                                </div>
                                <div className="absolute -bottom-3 w-[160px] h-5 rounded-[50%] bg-black/60 blur-xl" />
                            </div>

                            <div className="w-[340px]">
                                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08]">
                                    <Presence d={d} /><Futur />
                                </span>
                                <h2 className="text-[34px] leading-[1.05] font-bold tracking-tight mt-3">{d.name}</h2>
                                <div className="flex items-center gap-2 mt-2.5">
                                    <span className="text-[13px] text-white/55">{d.os}<Futur /></span>
                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-400/20 text-[11px] font-bold text-amber-200/90">
                                        <ShieldCheck className="w-3 h-3" strokeWidth={2.5} /> Manages devices
                                    </span>
                                </div>

                                <div className="flex gap-5 mt-8">
                                    {[
                                        { Icon: FileUp, label: "Send a file" },
                                        { Icon: ClipboardCopy, label: "Send my clipboard" },
                                        { Icon: ClipboardPaste, label: "Get its clipboard", asks: true },
                                    ].map(({ Icon, label, asks }) => (
                                        <div key={label} className="flex flex-col items-center gap-2 w-[88px]">
                                            <span className="relative w-[58px] h-[58px] rounded-full flex items-center justify-center border bg-blue-500/15 border-blue-400/35 text-blue-100 shadow-[0_0_24px_rgba(59,130,246,0.18)]">
                                                <Icon className="w-[22px] h-[22px]" strokeWidth={1.75} />
                                                {asks && (
                                                    <span className="absolute -right-0.5 -bottom-0.5 w-5 h-5 rounded-full bg-[#141416] border border-amber-400/40 flex items-center justify-center">
                                                        <Lock className="w-2.5 h-2.5 text-amber-300" strokeWidth={2.5} />
                                                    </span>
                                                )}
                                            </span>
                                            <span className="text-[12px] font-semibold text-white/85 text-center leading-tight">{label}</span>
                                            {asks && <span className="text-[10px] text-amber-200/70 -mt-1">It asks first</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* What passed between them: one line, the rest one click away */}
                    <div className="shrink-0 flex items-center gap-3 mt-3.5 px-2">
                        <div className="flex -space-x-2">
                            <span className="w-7 h-7 rounded-md border-2 border-[#121212] bg-gradient-to-br from-orange-400 to-violet-600" />
                            <span className="w-7 h-7 rounded-md border-2 border-[#121212] bg-gradient-to-br from-cyan-400 to-blue-700" />
                        </div>
                        <p className="text-[13px] text-white/65">
                            <span className="font-semibold text-white/85">2 photos</span> from it · 11:05
                        </p>
                        <span className="ml-auto inline-flex items-center gap-1 text-[12px] font-semibold text-white/55">
                            History and permissions <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.25} />
                        </span>
                    </div>
                </div>
            </div>
        </Fenetre>
    );
}

function Carte({ d, on }: { d: Device; on: boolean }) {
    return (
        <div className={`w-[196px] shrink-0 flex items-center gap-3 p-2.5 rounded-2xl border
            ${on
                ? "bg-white/[0.07] border-blue-400/40 shadow-[0_0_0_1px_rgba(96,165,250,0.15),0_8px_24px_rgba(59,130,246,0.12)]"
                : "bg-white/[0.025] border-white/[0.06]"}`}>
            <span className="w-11 h-11 shrink-0 rounded-xl bg-black/25 flex items-end justify-center pb-1 overflow-hidden">
                <Rendu kind={d.kind} screen={d.screen} size={d.kind === "phone" ? 0.13 : 0.1} dim={d.presence === "offline"} />
            </span>
            <div className="min-w-0">
                <p className={`text-[13px] font-semibold truncate ${d.presence === "offline" ? "text-white/55" : "text-white/90"}`}>{d.name}</p>
                <Presence d={d} />
            </div>
        </div>
    );
}
