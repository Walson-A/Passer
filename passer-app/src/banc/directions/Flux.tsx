import { ClipboardCopy, ClipboardPaste, Copy, FileText, FolderOpen, Lock, MoreHorizontal, Paperclip, ShieldQuestion, X } from "lucide-react";
import { DEVICES, THREAD, type Item } from "./donnees";
import { Fenetre, Futur, Presence } from "./Fenetre";
import { Rendu } from "./Rendu";

/**
 * C · Feed. Passer stays what it was born as - passing things between your
 * devices - and the big window makes that a conversation with each device:
 * everything that went back and forth, newest at the bottom, a drop zone to send,
 * and the device's requests (and your answers) in the same thread. Closest to
 * today's Passboard, at full size.
 */
export function Flux() {
    const d = DEVICES[0];
    const previews = ["2 photos · 11:05", "Here and now", "rapport-final.pdf · 09:58", "Offline since yesterday"];
    return (
        <Fenetre active="passboard">
            <div className="absolute inset-0 grid grid-cols-[280px_1fr]">
                {/* Conversations */}
                <aside className="border-r border-white/[0.05] py-5 px-3 flex flex-col gap-1 overflow-hidden">
                    <h2 className="px-3 pb-2 text-[11px] font-black uppercase tracking-[0.2em] text-white/60">Passboard</h2>
                    {DEVICES.filter(x => !x.thisDevice).map((x, i) => (
                        <div key={x.id} className={`flex items-center gap-3 p-2.5 rounded-xl ${i === 0 ? "bg-white/[0.07] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]" : ""}`}>
                            <span className="relative w-11 h-11 shrink-0 rounded-2xl bg-white/[0.04] border border-white/[0.07] flex items-end justify-center pb-1.5 overflow-hidden">
                                <Rendu kind={x.kind} screen={x.screen} size={x.kind === "phone" ? 0.12 : 0.09} dim={x.presence === "offline"} />
                            </span>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-[13px] font-semibold text-white/90 truncate">{x.name}</p>
                                    {i === 0 && <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />}
                                </div>
                                <p className="text-[12px] text-white/50 truncate">{previews[[0, 2, 3][i]]}</p>
                            </div>
                        </div>
                    ))}
                    <div className="mt-2 mx-1 p-3 rounded-xl border border-dashed border-white/12 text-[12px] text-white/50 leading-snug">
                        Files dropped on Passer without choosing a device land in <span className="text-white/75 font-semibold">Space</span>.
                    </div>
                </aside>

                {/* The thread */}
                <section className="flex flex-col min-h-0">
                    <header className="shrink-0 flex items-center gap-4 px-7 py-4 border-b border-white/[0.05]">
                        <span className="w-10 h-10 rounded-2xl bg-[radial-gradient(closest-side,rgba(96,165,250,0.2),transparent)] flex items-center justify-center">
                            <Rendu kind={d.kind} screen={d.screen} size={0.13} />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="text-[16px] font-bold">{d.name}</p>
                            <p className="flex items-center gap-2"><Presence d={d} /><Futur /></p>
                        </div>
                        <span className="flex items-center gap-2 h-9 px-3.5 rounded-xl border border-white/10 bg-white/[0.03] text-[12px] font-semibold text-white/80">
                            <ClipboardPaste className="w-4 h-4" strokeWidth={2} /> Get its clipboard
                            <Lock className="w-3 h-3 text-amber-300" strokeWidth={2.5} />
                        </span>
                        <span className="w-9 h-9 rounded-xl border border-white/10 bg-white/[0.03] flex items-center justify-center text-white/60"><MoreHorizontal className="w-4 h-4" /></span>
                    </header>

                    <div className="flex-1 min-h-0 overflow-hidden px-7 py-5 flex flex-col gap-3 justify-end">
                        <p className="self-center text-[11px] font-bold uppercase tracking-[0.18em] text-white/35">Today</p>
                        {THREAD.map((it, i) => <Bulle key={i} it={it} />)}
                    </div>

                    {/* Send */}
                    <div className="shrink-0 px-7 pb-6">
                        <div className="flex items-center gap-3 p-2 pl-4 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
                            <Paperclip className="w-4 h-4 text-white/45" strokeWidth={2} />
                            <span className="flex-1 text-[13px] text-white/45">Drop a file, or paste with Ctrl+V, to send it to {d.name}</span>
                            <span className="flex items-center gap-2 h-9 px-4 rounded-xl border border-blue-400/40 bg-blue-500/20 text-[12px] font-semibold text-blue-50">
                                <ClipboardCopy className="w-4 h-4" strokeWidth={2} /> Send my clipboard
                            </span>
                        </div>
                    </div>
                </section>
            </div>
        </Fenetre>
    );
}

function Bulle({ it }: { it: Item }) {
    if (it.kind === "event") {
        const tone = it.tone === "no" ? "text-red-200/80" : "text-amber-200/85";
        const Icon = it.tone === "no" ? X : ShieldQuestion;
        return (
            <div className="self-center flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-white/[0.03] border border-white/[0.06] max-w-[560px]">
                <Icon className={`w-3.5 h-3.5 shrink-0 ${tone}`} strokeWidth={2.25} />
                <span className="text-[12px] text-white/75"><span className="font-semibold text-white/90">{it.text}</span> · {it.detail}</span>
            </div>
        );
    }
    const out = it.dir === "out";
    const side = out ? "self-end items-end" : "self-start items-start";
    const card = out
        ? "bg-blue-500/[0.14] border-blue-400/25"
        : "bg-white/[0.05] border-white/[0.08]";
    return (
        <div className={`flex flex-col gap-1 max-w-[440px] ${side}`}>
            {it.kind === "image" && (
                <div className={`p-1.5 rounded-2xl border ${card}`}>
                    <div className="w-[176px] h-[104px] rounded-xl" style={{ background: `linear-gradient(135deg, ${it.hue[0]}, ${it.hue[1]})` }} />
                    <div className="flex items-center justify-between px-1.5 pt-1.5">
                        <span className="text-[12px] font-semibold text-white/80">{it.name}</span>
                        <span className="flex gap-1 text-white/55"><Copy className="w-3.5 h-3.5" /><FolderOpen className="w-3.5 h-3.5" /></span>
                    </div>
                </div>
            )}
            {it.kind === "text" && (
                <div className={`px-4 py-2.5 rounded-2xl border text-[13px] leading-snug text-white/90 ${card}`}>{it.text}</div>
            )}
            {it.kind === "file" && (
                <div className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl border ${card}`}>
                    <span className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center"><FileText className="w-4 h-4 text-white/75" /></span>
                    <div>
                        <p className="text-[13px] font-semibold text-white/90">{it.name}</p>
                        <p className="text-[11px] text-white/50">{it.size}</p>
                    </div>
                </div>
            )}
            <span className="text-[11px] text-white/35 px-1">{out ? "Sent" : "Received"} · {it.at}</span>
        </div>
    );
}
