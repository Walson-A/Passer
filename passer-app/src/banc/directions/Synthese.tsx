import { ChevronRight, ClipboardCopy, ClipboardPaste, FileText, FileUp, Lock, Paperclip, Plus, QrCode, ShieldCheck, ShieldQuestion, X } from "lucide-react";
import { DEVICES, type Device } from "./donnees";
import { Fenetre, Futur, Presence } from "./Fenetre";
import { Rendu } from "./Rendu";

/**
 * A2 · Showroom, after Walson's read of A, B and C: A is the most beautiful, B
 * and C the most readable, mostly because you see every device at once. So:
 *
 * - every device in one horizontal strip at the top - all visible, no carousel
 *   arrows, and horizontal so it does not compete with the vertical sidebar;
 * - the chosen one on stage, smaller than in A, with only what a person acts on:
 *   its name, its state, three commands that work today;
 * - next to it, the thread of what went between this PC and that device (C's
 *   best idea), with a place to drop or paste;
 * - out: the battery ring, the "Soon" buttons, the raw id, the per-device stop -
 *   the stop belongs to the PC, so it moves to the sidebar status card.
 */
export function Synthese() {
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

                {/* The chosen one */}
                <div className="flex-1 min-h-0 grid grid-cols-[1fr_372px] gap-6 px-8 pt-5 pb-6">
                    <section className="relative rounded-3xl overflow-hidden bg-[radial-gradient(ellipse_at_32%_45%,rgba(96,165,250,0.14),rgba(168,85,247,0.05)_45%,transparent_70%)] border border-white/[0.05] flex items-center gap-8 px-8">
                        <div className="relative shrink-0 w-[170px] flex justify-center">
                            <div className="drop-shadow-[0_26px_34px_rgba(0,0,0,0.6)]">
                                <Rendu kind={d.kind} screen={d.screen} size={0.92} />
                            </div>
                            <div className="absolute -bottom-3 w-[150px] h-5 rounded-[50%] bg-black/60 blur-xl" />
                        </div>

                        <div className="min-w-0 flex-1">
                            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08]">
                                <Presence d={d} /><Futur />
                            </span>
                            <h2 className="text-[30px] leading-[1.08] font-bold tracking-tight mt-3">{d.name}</h2>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <span className="text-[13px] text-white/55">{d.os}<Futur /></span>
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-400/20 text-[11px] font-bold text-amber-200/90">
                                    <ShieldCheck className="w-3 h-3" strokeWidth={2.5} /> Manages devices
                                </span>
                            </div>

                            <div className="flex gap-6 mt-7">
                                {[
                                    { Icon: FileUp, label: "Send a file" },
                                    { Icon: ClipboardCopy, label: "Send my clipboard" },
                                    { Icon: ClipboardPaste, label: "Get its clipboard", asks: true },
                                ].map(({ Icon, label, asks }) => (
                                    <div key={label} className="flex flex-col items-center gap-2 w-[84px]">
                                        <span className="relative w-[56px] h-[56px] rounded-full flex items-center justify-center border bg-blue-500/15 border-blue-400/35 text-blue-100 shadow-[0_0_24px_rgba(59,130,246,0.18)]">
                                            <Icon className="w-[21px] h-[21px]" strokeWidth={1.75} />
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

                            <span className="mt-7 inline-flex items-center gap-1 text-[12px] font-semibold text-white/55">
                                What it can do on this PC, and its history <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.25} />
                            </span>
                        </div>
                    </section>

                    {/* Between this PC and it */}
                    <aside className="flex flex-col min-h-0 rounded-3xl bg-white/[0.03] border border-white/[0.06]">
                        <div className="shrink-0 flex items-center justify-between px-5 pt-4 pb-3">
                            <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-white/60">With this PC, today</h3>
                            <span className="text-[12px] font-semibold text-white/45">All</span>
                        </div>
                        <div className="flex-1 min-h-0 overflow-hidden flex flex-col justify-end gap-2.5 px-4">
                            <Sortant><span className="flex items-center gap-2"><FileText className="w-3.5 h-3.5 text-white/70" />Billet-train-Lyon.pdf</span></Sortant>
                            <Evenement Icon={ShieldQuestion} tone="text-amber-200/85" text="Claude read the clipboard" detail="allowed once · 10:42" />
                            <Entrant>
                                <div className="flex gap-1.5">
                                    <span className="w-[72px] h-[52px] rounded-lg bg-gradient-to-br from-orange-400 to-violet-600" />
                                    <span className="w-[72px] h-[52px] rounded-lg bg-gradient-to-br from-cyan-400 to-blue-700" />
                                </div>
                                <p className="text-[11px] text-white/55 mt-1.5">2 photos · in Passboard · 11:05</p>
                            </Entrant>
                            <Entrant><span className="text-[13px]">Pense à envoyer le devis à Martin avant 18 h</span><p className="text-[11px] text-white/45 mt-1">11:31 · copied to the clipboard</p></Entrant>
                            <Evenement Icon={X} tone="text-red-200/80" text="Asked for the clipboard" detail="you refused · 11:48" />
                        </div>
                        <div className="shrink-0 m-3 mt-3.5 flex items-center gap-2.5 h-11 px-3.5 rounded-2xl border border-dashed border-white/15 text-white/45">
                            <Paperclip className="w-4 h-4" strokeWidth={2} />
                            <span className="text-[12px]">Drop or paste here to send it</span>
                        </div>
                    </aside>
                </div>
            </div>
        </Fenetre>
    );
}

function Carte({ d, on }: { d: Device; on: boolean }) {
    return (
        <div className={`w-[196px] shrink-0 flex items-center gap-3 p-2.5 rounded-2xl border transition-colors
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

function Entrant({ children }: { children: React.ReactNode }) {
    return <div className="self-start max-w-[290px] px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-white/[0.06] border border-white/[0.07] text-white/90">{children}</div>;
}

function Sortant({ children }: { children: React.ReactNode }) {
    return <div className="self-end max-w-[290px] px-3.5 py-2.5 rounded-2xl rounded-br-md bg-blue-500/[0.14] border border-blue-400/25 text-[13px] text-white/90">{children}</div>;
}

function Evenement({ Icon, tone, text, detail }: { Icon: typeof X; tone: string; text: string; detail: string }) {
    return (
        <div className="self-center flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
            <Icon className={`w-3.5 h-3.5 ${tone}`} strokeWidth={2.25} />
            <span className="text-[11px] text-white/70"><span className="font-semibold text-white/85">{text}</span> · {detail}</span>
        </div>
    );
}
