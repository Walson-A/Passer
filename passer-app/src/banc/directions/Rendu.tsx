import { useId } from "react";
import type { Kind } from "./donnees";

/**
 * A device drawn like a product photo: a dark body with a soft rim light and
 * a lit screen. SVG, so it stays sharp at any size; the screen colours are the
 * device's own, like a wallpaper.
 */
export function Rendu({ kind, screen, size = 1, dim = false }: { kind: Kind; screen: [string, string]; size?: number; dim?: boolean }) {
    const id = useId().replace(/:/g, "");
    const lit = (
        <defs>
            <linearGradient id={`s${id}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor={screen[0]} />
                <stop offset="1" stopColor={screen[1]} />
            </linearGradient>
            <linearGradient id={`b${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#3a3a3e" />
                <stop offset="1" stopColor="#141416" />
            </linearGradient>
            <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
                <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
        </defs>
    );
    const style = { filter: dim ? "grayscale(0.85) brightness(0.55)" : undefined, transition: "filter 300ms" };

    if (kind === "phone") {
        const w = 132 * size, h = 268 * size;
        return (
            <svg width={w} height={h} viewBox="0 0 132 268" style={style} aria-hidden>
                {lit}
                <rect x="1" y="1" width="130" height="266" rx="26" fill={`url(#b${id})`} stroke="#4a4a50" strokeWidth="1" />
                <rect x="7" y="7" width="118" height="254" rx="21" fill={`url(#s${id})`} />
                <rect x="7" y="7" width="118" height="254" rx="21" fill={`url(#g${id})`} />
                <rect x="46" y="14" width="40" height="11" rx="5.5" fill="#050505" />
                {/* a hint of an interface */}
                <rect x="20" y="60" width="92" height="44" rx="10" fill="#fff" opacity="0.18" />
                <rect x="20" y="112" width="60" height="7" rx="3.5" fill="#fff" opacity="0.35" />
                <rect x="20" y="124" width="80" height="7" rx="3.5" fill="#fff" opacity="0.2" />
                <rect x="44" y="246" width="44" height="4" rx="2" fill="#fff" opacity="0.5" />
            </svg>
        );
    }

    if (kind === "laptop") {
        const w = 360 * size, h = 232 * size;
        return (
            <svg width={w} height={h} viewBox="0 0 360 232" style={style} aria-hidden>
                {lit}
                <rect x="40" y="2" width="280" height="190" rx="12" fill={`url(#b${id})`} stroke="#4a4a50" />
                <rect x="49" y="11" width="262" height="168" rx="4" fill={`url(#s${id})`} />
                <rect x="49" y="11" width="262" height="168" rx="4" fill={`url(#g${id})`} />
                <rect x="72" y="36" width="120" height="76" rx="8" fill="#0b0b0f" opacity="0.55" />
                <rect x="82" y="50" width="70" height="6" rx="3" fill="#fff" opacity="0.6" />
                <rect x="82" y="62" width="92" height="6" rx="3" fill="#fff" opacity="0.3" />
                <rect x="206" y="36" width="80" height="50" rx="8" fill="#fff" opacity="0.16" />
                <path d="M8 196 H352 L340 222 Q338 228 330 228 H30 Q22 228 20 222 Z" fill="#cfd0d4" />
                <path d="M8 196 H352 L350 200 H10 Z" fill="#f4f4f6" />
                <rect x="150" y="196" width="60" height="5" rx="2.5" fill="#9b9ca1" />
            </svg>
        );
    }

    if (kind === "tablet") {
        const w = 220 * size, h = 290 * size;
        return (
            <svg width={w} height={h} viewBox="0 0 220 290" style={style} aria-hidden>
                {lit}
                <rect x="1" y="1" width="218" height="288" rx="20" fill={`url(#b${id})`} stroke="#4a4a50" />
                <rect x="10" y="10" width="200" height="270" rx="12" fill={`url(#s${id})`} />
                <rect x="10" y="10" width="200" height="270" rx="12" fill={`url(#g${id})`} />
            </svg>
        );
    }

    // desktop
    const w = 340 * size, h = 260 * size;
    return (
        <svg width={w} height={h} viewBox="0 0 340 260" style={style} aria-hidden>
            {lit}
            <rect x="2" y="2" width="336" height="200" rx="10" fill={`url(#b${id})`} stroke="#4a4a50" />
            <rect x="10" y="10" width="320" height="184" rx="4" fill={`url(#s${id})`} />
            <rect x="10" y="10" width="320" height="184" rx="4" fill={`url(#g${id})`} />
            <rect x="34" y="34" width="150" height="90" rx="8" fill="#0b0b0f" opacity="0.5" />
            <path d="M150 202 H190 L198 244 H142 Z" fill="#2a2a2e" />
            <rect x="110" y="242" width="120" height="10" rx="5" fill="#cfd0d4" />
        </svg>
    );
}
