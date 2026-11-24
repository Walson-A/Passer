import type { ReactNode } from "react";
import { Laptop, Monitor, MonitorSmartphone, Smartphone, Tablet, Loader2 } from "lucide-react";
import type { Kind } from "./DeviceRender";

/**
 * Shapes and small pieces shared by the Devices tab, its invitation panel and
 * the approval card. The types mirror `devices.rs` exactly - see "Device
 * network" in docs/desktop/backend.md - and must not drift from it.
 */

export interface Member {
    id: string;
    short_id: string;
    name: string;
    approver: boolean;
    this_device: boolean;
}

export interface DevicesStatus {
    device_id: string;
    group: string | null;
    running: boolean;
    development_network: boolean;
    members: Member[];
}

/** Payload of `device-joined`. `id` is the short id, not the full one. */
export interface Joined {
    name: string;
    id: string;
    sas: string;
}

/**
 * Keyboard focus, visible only to keyboard users, the same everywhere. Kept
 * soft: at full strength it sat on top of tinted borders as a second, heavier
 * outline. Nothing here is focused on the user's behalf except the safe choice
 * (Deny, Cancel), so the ring means "you got here with the keyboard".
 */
export const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-blue-300/50";

/**
 * A glyph for a device. The backend sends no device type, only the name the
 * device gave itself, so this guesses from that name. It is decoration - the
 * name is always shown next to it - so a wrong guess costs nothing.
 */
export function DeviceGlyph({ name, thisDevice, className }: { name: string; thisDevice?: boolean; className?: string }) {
    const n = name.toLowerCase();
    const Icon = thisDevice
        ? Monitor
        : /iphone|android|phone|pixel|galaxy|téléphone|mobile/.test(n)
            ? Smartphone
            : /ipad|tablet|tablette/.test(n)
                ? Tablet
                : /macbook|book|laptop|portable|surface/.test(n)
                    ? Laptop
                    : MonitorSmartphone;
    return <Icon className={className} strokeWidth={2} aria-hidden />;
}

// --- How a device looks --------------------------------------------------------------

/** The operating system as people say it. `os` is Rust's `std::env::consts::OS`. */
export function osLabel(os?: string): string | null {
    if (!os) return null;
    return ({ ios: "iOS", macos: "macOS", windows: "Windows", linux: "Linux", android: "Android" } as Record<string, string>)[os] ?? os;
}

/** This PC's own system, from the webview (it does not call itself). */
export function thisOs(): string {
    const ua = navigator.userAgent;
    return /Windows/.test(ua) ? "windows" : /Mac/.test(ua) ? "macos" : "linux";
}

/**
 * The shape to draw. passer-core sends no device type yet (a `kind` field is
 * planned), so: the system decides phone versus computer, the name decides
 * laptop versus tower. Decoration only - the name is always written beside it.
 */
export function kindOf(name: string, os?: string): Kind {
    const n = name.toLowerCase();
    if (os === "ios") return /ipad/.test(n) ? "tablet" : "phone";
    if (os === "android") return /tab/.test(n) ? "tablet" : "phone";
    if (!os) {
        if (/iphone|android|phone|pixel|galaxy|téléphone|mobile/.test(n)) return "phone";
        if (/ipad|tablet|tablette/.test(n)) return "tablet";
    }
    return /macbook|book|laptop|portable|surface|-hp|thinkpad|xps/.test(n) ? "laptop" : "desktop";
}

/** Whether a device is a computer running Passer, which answers clipboard and file calls. */
export function isComputer(os?: string) {
    return os === "windows" || os === "macos" || os === "linux";
}

const SCREENS: [string, string][] = [
    ["#3b82f6", "#a855f7"], ["#0ea5e9", "#1e3a8a"], ["#f97316", "#db2777"],
    ["#10b981", "#0f766e"], ["#eab308", "#dc2626"], ["#6366f1", "#06b6d4"],
];

/** A wallpaper per device, stable across launches: derived from its id. */
export function screenFor(id: string): [string, string] {
    let h = 0;
    for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return SCREENS[h % SCREENS.length];
}

/** Splits a 6-digit code into two groups of three, the way people read it aloud. */
export function SasDigits({ sas, tone = "emerald" }: { sas: string; tone?: "emerald" | "blue" }) {
    const digits = sas.replace(/\D/g, "").split("");
    const cell = tone === "emerald"
        ? "bg-emerald-400/[0.08] border-emerald-300/20"
        : "bg-blue-400/[0.08] border-blue-300/20";
    return (
        <div className="flex items-center justify-center gap-1.5" aria-label={`Code ${digits.join(" ")}`} role="img">
            {digits.map((d, i) => (
                <span key={i} className="contents">
                    {i === 3 && <span className="w-2" aria-hidden />}
                    <span
                        aria-hidden
                        className={`rise w-8 h-10 rounded-lg border flex items-center justify-center text-[20px] font-black text-white tabular-nums ${cell}`}
                        style={{ ["--i" as string]: i }}
                    >
                        {d}
                    </span>
                </span>
            ))}
        </div>
    );
}

type Tone = "primary" | "neutral" | "danger" | "success";

const TONES: Record<Tone, string> = {
    primary: "bg-blue-500/20 border-blue-400/40 text-blue-50 hover:bg-blue-500/30 hover:border-blue-400/60",
    neutral: "bg-white/[0.04] border-white/10 text-white/75 hover:text-white hover:border-white/20 hover:bg-white/[0.06]",
    danger: "bg-red-500/15 border-red-400/35 text-red-200 hover:bg-red-500/25 hover:border-red-400/50",
    success: "bg-emerald-500/15 border-emerald-400/35 text-emerald-200 hover:bg-emerald-500/25",
};

/**
 * The app's button: small caps, tight tracking, a tinted fill and hairline
 * border. Labels stay short - capitals stop being readable past three words.
 */
export function Action({ children, onClick, tone = "neutral", disabled, busy, icon, className = "", autoFocus, type = "button" }: {
    children: ReactNode;
    onClick?: () => void;
    tone?: Tone;
    disabled?: boolean;
    busy?: boolean;
    icon?: ReactNode;
    className?: string;
    autoFocus?: boolean;
    type?: "button" | "submit";
}) {
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled || busy}
            autoFocus={autoFocus}
            aria-busy={busy || undefined}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-[10px] font-black uppercase tracking-[0.12em]
                transition-all duration-200 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer
                ${TONES[tone]} ${FOCUS} ${className}`}
        >
            {busy ? <Loader2 className="w-3 h-3 animate-spin" strokeWidth={2.5} aria-hidden /> : icon}
            {children}
        </button>
    );
}
