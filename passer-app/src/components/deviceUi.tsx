import type { ReactNode } from "react";
import { Laptop, Monitor, MonitorSmartphone, Smartphone, Tablet, Loader2 } from "lucide-react";

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

/** Keyboard focus, visible only to keyboard users, the same everywhere. */
export const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70";

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
            className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-[9px] font-black uppercase tracking-widest
                transition-all duration-200 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer
                ${TONES[tone]} ${FOCUS} ${className}`}
        >
            {busy ? <Loader2 className="w-3 h-3 animate-spin" strokeWidth={2.5} aria-hidden /> : icon}
            {children}
        </button>
    );
}
