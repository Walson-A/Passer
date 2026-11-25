import ReactDOM from "react-dom/client";
import { Showroom } from "./Showroom";
import { Controle } from "./Controle";
import { Flux } from "./Flux";
import { Synthese } from "./Synthese";
import { Vitrine } from "./Vitrine";
import "../../App.css";

/**
 * Bench for the big-window directions - `npm run dev`, then /directions.html?dir=a|b|c.
 * Static mockups on fictional data: nothing is wired. ✱ marks what passer-core
 * does not provide yet. Not listed in `vite.config.ts`: dev only.
 */

const DIRS = [
    { id: "a", label: "A · Showroom", View: Showroom },
    { id: "b", label: "B · Control center", View: Controle },
    { id: "c", label: "C · Feed", View: Flux },
    { id: "a2", label: "A2 · + feed", View: Synthese },
    { id: "a3", label: "A3 · Showroom, all devices", View: Vitrine },
];

document.body.style.overflow = "auto";
document.body.style.background = "#0a0c10";
const root = document.getElementById("root")!;
root.style.height = "auto";

const id = new URLSearchParams(location.search).get("dir") ?? "a";
const current = DIRS.find(d => d.id === id) ?? DIRS[0];

function Banc() {
    return (
        <div className="min-h-screen flex flex-col items-center gap-4 py-6 bg-[radial-gradient(ellipse_at_30%_10%,#1e2a44_0%,#0b0e14_55%,#07080b_100%)] text-white">
            <div className="flex items-center gap-2 w-[1180px]">
                {DIRS.map(d => (
                    <a key={d.id} href={`?dir=${d.id}`}
                        className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold ${d.id === current.id ? "bg-white text-black" : "bg-white/10 text-white/70 hover:text-white"}`}>
                        {d.label}
                    </a>
                ))}
                <span className="ml-auto text-[12px] text-white/50">
                    Static mockups · fictional data · <span className="text-amber-300 font-black">✱</span> not provided by passer-core yet
                </span>
            </div>
            <current.View />
        </div>
    );
}

ReactDOM.createRoot(root).render(<Banc />);
