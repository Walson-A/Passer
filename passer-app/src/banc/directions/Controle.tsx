import { Bot, Check, Clock, OctagonX, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { AGENTS, DEVICES, JOURNAL, PERMISSIONS, type Rule } from "./donnees";
import { Fenetre, Futur, Presence } from "./Fenetre";
import { Rendu } from "./Rendu";

/**
 * B · Control center. Trust first: who is in, what each one may do on this PC,
 * and what they actually did. Three columns - the devices and agents, the one
 * selected with its permissions as plain sentences, and the journal. Closer to
 * a privacy settings page than to a product page; calm, dense, honest.
 */
export function Controle() {
    const d = DEVICES[0];
    return (
        <Fenetre>
            <div className="absolute inset-0 grid grid-cols-[232px_1fr_264px]">
                {/* Who */}
                <aside className="border-r border-white/[0.05] px-4 py-6 flex flex-col gap-5 overflow-hidden">
                    <div>
                        <div className="flex items-center justify-between px-2">
                            <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/60">Devices</h2>
                            <span className="w-6 h-6 rounded-lg bg-blue-500/20 border border-blue-400/35 flex items-center justify-center"><Plus className="w-3.5 h-3.5 text-blue-100" strokeWidth={2.5} /></span>
                        </div>
                        <div className="mt-3 flex flex-col gap-1">
                            {DEVICES.map((x, i) => (
                                <div key={x.id} className={`flex items-center gap-3 p-2.5 rounded-xl ${i === 0 ? "bg-white/[0.07] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]" : ""}`}>
                                    <span className="w-9 h-9 shrink-0 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-end justify-center pb-1 overflow-hidden">
                                        <Rendu kind={x.kind} screen={x.screen} size={x.kind === "phone" ? 0.1 : 0.075} dim={x.presence === "offline"} />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-[13px] font-semibold text-white/90 truncate">{x.thisDevice ? `${x.name}` : x.name}</p>
                                        <Presence d={x} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <h2 className="px-2 text-[11px] font-black uppercase tracking-[0.2em] text-white/60">AI agents</h2>
                        {AGENTS.map(a => (
                            <div key={a.name} className="mt-3 flex items-center gap-3 p-2.5 rounded-xl">
                                <span className="w-9 h-9 shrink-0 rounded-xl bg-violet-500/15 border border-violet-400/25 flex items-center justify-center"><Bot className="w-[18px] h-[18px] text-violet-200" strokeWidth={1.75} /></span>
                                <div className="min-w-0">
                                    <p className="text-[13px] font-semibold text-white/90">{a.name}</p>
                                    <p className="text-[12px] text-white/50 truncate">on {a.via}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </aside>

                {/* What it may do */}
                <section className="px-7 py-6 overflow-hidden flex flex-col gap-5">
                    <div className="flex items-center gap-5">
                        <div className="w-[84px] h-[84px] shrink-0 rounded-3xl bg-[radial-gradient(closest-side,rgba(96,165,250,0.18),transparent)] flex items-center justify-center">
                            <Rendu kind={d.kind} screen={d.screen} size={0.3} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h1 className="text-[24px] font-bold tracking-tight leading-tight">{d.name}</h1>
                            <p className="text-[13px] text-white/55 mt-1 flex items-center gap-2 flex-wrap">
                                <Presence d={d} /><Futur /> · {d.os}<Futur /> · <span className="font-mono text-white/45">{d.id}</span>
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-400/20 text-[11px] font-bold text-amber-200/90"><ShieldCheck className="w-3 h-3" strokeWidth={2.5} /> Manages devices</span>
                            </p>
                        </div>
                    </div>

                    <div>
                        <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/60">What it can do on this PC</h2>
                        <div className="mt-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] divide-y divide-white/[0.05]">
                            {PERMISSIONS.map(p => (
                                <div key={p.title} className="flex items-center gap-4 px-4 py-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[14px] font-semibold text-white/90 flex items-center gap-2">
                                            {p.title}
                                            {p.soon && <span className="text-[10px] font-bold text-white/40 px-1.5 py-0.5 rounded bg-white/[0.05]">Soon</span>}
                                        </p>
                                        <p className="text-[12px] text-white/50 mt-0.5">{p.detail}</p>
                                    </div>
                                    <Segmented value={p.rule} />
                                </div>
                            ))}
                        </div>
                        <p className="text-[12px] text-white/45 mt-2.5 px-1">
                            "Ask" shows a request on this PC every time. A yes covers that one request only.
                        </p>
                    </div>

                    <div className="mt-auto flex items-center gap-2 whitespace-nowrap">
                        <span className="flex items-center gap-2 h-9 px-4 rounded-xl border border-red-400/30 bg-red-500/10 text-[12px] font-semibold text-red-100">
                            <OctagonX className="w-4 h-4" strokeWidth={2} /> Stop what it's doing
                        </span>
                        <span className="flex items-center gap-2 h-9 px-4 rounded-xl border border-white/10 bg-white/[0.03] text-[12px] font-semibold text-white/70">
                            <Trash2 className="w-4 h-4" strokeWidth={2} /> Remove from my devices
                        </span>
                    </div>
                </section>

                {/* What happened */}
                <aside className="border-l border-white/[0.05] px-5 py-6 overflow-hidden">
                    <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/60">On this PC, today</h2>
                    <ol className="mt-4 relative">
                        <span className="absolute left-[11px] top-2 bottom-2 w-px bg-white/[0.08]" />
                        {JOURNAL.map((c, i) => {
                            const tone = {
                                "done": { Icon: Check, c: "text-emerald-300 bg-emerald-500/15 border-emerald-400/30" },
                                "allowed once": { Icon: Check, c: "text-blue-200 bg-blue-500/15 border-blue-400/30" },
                                "refused": { Icon: X, c: "text-red-200 bg-red-500/15 border-red-400/30" },
                                "expired": { Icon: Clock, c: "text-white/60 bg-white/[0.06] border-white/15" },
                            }[c.result];
                            return (
                                <li key={i} className="relative flex gap-3 pb-5">
                                    <span className={`relative z-10 w-6 h-6 shrink-0 rounded-full border flex items-center justify-center ${tone.c}`}>
                                        <tone.Icon className="w-3 h-3" strokeWidth={2.75} />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-[13px] font-semibold text-white/90 leading-snug">{c.what}</p>
                                        <p className="text-[12px] text-white/50 leading-snug mt-0.5">{c.who}</p>
                                        <p className="text-[11px] text-white/40 mt-1">{c.at} · {c.result}</p>
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                    <p className="text-[12px] text-white/40 leading-snug">The journal keeps what was asked and the answer, never the content.</p>
                </aside>
            </div>
        </Fenetre>
    );
}

function Segmented({ value }: { value: Rule }) {
    const opts: { v: Rule; label: string; on: string }[] = [
        { v: "allow", label: "Allow", on: "bg-emerald-500/20 text-emerald-100 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.35)]" },
        { v: "ask", label: "Ask", on: "bg-amber-500/20 text-amber-100 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.35)]" },
        { v: "never", label: "Never", on: "bg-white/[0.1] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.15)]" },
    ];
    return (
        <div className="shrink-0 flex p-0.5 rounded-xl bg-black/30 border border-white/[0.06]">
            {opts.map(o => (
                <span key={o.v} className={`w-[52px] h-8 rounded-[10px] flex items-center justify-center text-[12px] font-semibold ${o.v === value ? o.on : "text-white/45"}`}>
                    {o.label}
                </span>
            ))}
        </div>
    );
}
