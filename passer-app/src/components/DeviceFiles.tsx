import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Archive, Check, ChevronDown, ChevronUp, Download, File, FileText, FolderOpen, Image as ImageIcon, Loader2, Plus, RefreshCw, Search, Video, X } from "lucide-react";
import { InlineError } from "./DeviceInvite";
import { FOCUS, ProgressLine, formatSize, type Member, type SendProgress } from "./deviceUi";

interface SharedFile {
    name: string;
    size: number;
    /** Unix seconds. */
    modified: number;
}

const SHOWN = 8;

/** Fired on `window` when this PC's shared files change elsewhere in the window (a drop, the Passboard). */
export const SPACE_CHANGED = "passer:space-changed";

/**
 * Files, per device - there is no single shared folder: each device shares its own.
 *
 * - Another device: **what it shares** (its `file.list`), each with *Get*, which
 *   streams it into this PC's Passboard (`devices_fetch_file`) with a progress bar.
 *   Shown only when it offers `file.list`.
 * - This PC: **what this PC shares** with your devices - the Passer Space folder,
 *   which `file.list` / `file.get` offer them - with *Share files* and *Stop sharing*.
 */
export function DeviceFiles({ member, offersList }: { member: Member; offersList: boolean }) {
    if (member.this_device) return <ThisPcFiles />;
    if (!offersList) return null;
    return <TheirFiles member={member} />;
}

function TheirFiles({ member: m }: { member: Member }) {
    const [files, setFiles] = useState<SharedFile[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [all, setAll] = useState(false);
    const [getting, setGetting] = useState<string | null>(null);
    const [got, setGot] = useState<string | null>(null);
    const [failure, setFailure] = useState<{ text: string; detail: string } | null>(null);
    const progress = useProgress(`get-${m.id}`);

    const load = useCallback(async () => {
        setError(null);
        try {
            setFiles(await invoke<SharedFile[]>("devices_list_files", { id: m.id }));
        } catch (e) {
            setError(String(e));
        }
    }, [m.id]);

    useEffect(() => { setFiles(null); setAll(false); setGot(null); setFailure(null); load(); }, [load]);

    const get = async (f: SharedFile) => {
        if (getting) return;
        setGetting(f.name);
        setGot(null);
        setFailure(null);
        try {
            await invoke<string>("devices_fetch_file", { id: m.id, name: f.name, transfer: `get-${m.id}` });
            setGot(f.name);
            setTimeout(() => setGot(g => (g === f.name ? null : g)), 3000);
        } catch (e) {
            setFailure({ text: `${f.name} didn't come through.`, detail: String(e) });
        } finally {
            setGetting(null);
        }
    };

    return (
        <Panel
            title={`What ${m.name} shares`}
            note="Get a file and it lands in your Passboard."
            actions={<IconAction label="Refresh" onClick={load}><RefreshCw className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden /></IconAction>}
        >
            {error ? (
                <InlineError text={`Couldn't see what ${m.name} shares right now.`} detail={error} />
            ) : files === null ? (
                <Skeletons />
            ) : files.length === 0 ? (
                <Empty>{m.name} isn't sharing any files right now.</Empty>
            ) : (
                <FileGrid files={files} all={all} onAll={setAll} render={f => (
                    <button
                        onClick={() => get(f)}
                        disabled={!!getting}
                        aria-label={`Get ${f.name}`}
                        title="Get it into the Passboard"
                        className={`shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[12px] font-semibold transition-all active:scale-[0.97] cursor-pointer disabled:cursor-not-allowed ${FOCUS}
                            ${got === f.name
                                ? "bg-emerald-500/15 border-emerald-400/30 text-emerald-200"
                                : "bg-blue-500/15 border-blue-400/30 text-blue-100 hover:bg-blue-500/25 disabled:opacity-40"}`}
                    >
                        {getting === f.name ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                            : got === f.name ? <Check className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden />
                                : <Download className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden />}
                        {got === f.name ? "In Passboard" : "Get"}
                    </button>
                )} />
            )}
            <div aria-live="polite">
                {getting && progress && <div className="mt-3 max-w-[420px]"><ProgressLine p={progress} verb="Getting" /></div>}
                {failure && <div className="mt-3"><InlineError text={failure.text} detail={failure.detail} /></div>}
            </div>
        </Panel>
    );
}

function ThisPcFiles() {
    const [files, setFiles] = useState<SharedFile[] | null>(null);
    const [all, setAll] = useState(false);
    const [adding, setAdding] = useState(false);
    const [confirm, setConfirm] = useState<string | null>(null);
    const [failure, setFailure] = useState<{ text: string; detail: string } | null>(null);

    const load = useCallback(async () => {
        try {
            setFiles(await invoke<SharedFile[]>("space_files"));
        } catch (e) {
            setFailure({ text: "Couldn't read the shared folder.", detail: String(e) });
            setFiles([]);
        }
    }, []);

    useEffect(() => {
        load();
        window.addEventListener(SPACE_CHANGED, load);
        return () => window.removeEventListener(SPACE_CHANGED, load);
    }, [load]);

    const add = async () => {
        if (adding) return;
        setAdding(true);
        setFailure(null);
        try {
            await invoke<number>("space_pick_and_add");
            await load();
        } catch (e) {
            setFailure({ text: "The files couldn't be shared.", detail: String(e) });
        } finally {
            setAdding(false);
        }
    };

    const stop = async (name: string) => {
        setFailure(null);
        try {
            await invoke("space_remove", { name });
            setConfirm(null);
            await load();
        } catch (e) {
            setFailure({ text: `${name} couldn't be removed.`, detail: String(e) });
        }
    };

    return (
        <Panel
            title="What this PC shares"
            note="Your other devices can see these files and get them whenever they want."
            actions={
                <>
                    <button
                        onClick={() => invoke("open_webdav")}
                        className={`flex items-center gap-1.5 h-8 px-3 rounded-lg border border-white/10 bg-white/[0.03] text-[12px] font-semibold text-white/75 hover:text-white hover:border-white/20 transition-all cursor-pointer ${FOCUS}`}
                    >
                        <FolderOpen className="w-3.5 h-3.5 text-[var(--accent-warm)]" strokeWidth={2} aria-hidden /> Open the folder
                    </button>
                    <button
                        onClick={add}
                        disabled={adding}
                        className={`flex items-center gap-1.5 h-8 px-3 rounded-lg border border-blue-400/40 bg-blue-500/20 text-[12px] font-semibold text-blue-50 hover:bg-blue-500/30 transition-all cursor-pointer disabled:opacity-50 ${FOCUS}`}
                    >
                        {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <Plus className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden />}
                        Share files
                    </button>
                </>
            }
        >
            {files === null ? (
                <Skeletons />
            ) : files.length === 0 ? (
                <Empty>Nothing shared yet. Share files here, or drop them on the window and choose "Share from this PC".</Empty>
            ) : (
                <FileGrid files={files} all={all} onAll={setAll} render={f => confirm === f.name ? (
                    <span className="shrink-0 flex items-center gap-1.5">
                        <button onClick={() => stop(f.name)} autoFocus
                            className={`h-8 px-3 rounded-lg border border-red-400/40 bg-red-500/15 text-[12px] font-semibold text-red-100 hover:bg-red-500/25 transition-all cursor-pointer ${FOCUS}`}>
                            Remove it
                        </button>
                        <IconAction label="Keep it" onClick={() => setConfirm(null)}><X className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden /></IconAction>
                    </span>
                ) : (
                    <button
                        onClick={() => setConfirm(f.name)}
                        aria-label={`Stop sharing ${f.name}`}
                        title="Stop sharing"
                        className={`shrink-0 h-8 px-3 rounded-lg text-[12px] font-semibold text-white/50 hover:text-red-200 hover:bg-red-500/10 transition-all cursor-pointer ${FOCUS}`}
                    >
                        Stop sharing
                    </button>
                )} />
            )}
            {confirm && (
                <p className="mt-2 text-[12px] text-red-100/75" role="status">
                    Stopping deletes {confirm} from the Passer Space folder.
                </p>
            )}
            {failure && <div className="mt-3"><InlineError text={failure.text} detail={failure.detail} /></div>}
        </Panel>
    );
}

/** The latest progress of one transfer (`transfer-progress`). */
function useProgress(transfer: string) {
    const [p, setP] = useState<SendProgress | null>(null);
    useEffect(() => {
        setP(null);
        let off: (() => void) | undefined;
        let alive = true;
        (async () => {
            const un = await listen<SendProgress>("transfer-progress", e => {
                if (e.payload.transfer === transfer) setP(e.payload);
            });
            if (alive) off = un; else un();
        })();
        return () => { alive = false; off?.(); };
    }, [transfer]);
    return p;
}

function Panel({ title, note, actions, children }: { title: string; note: string; actions?: React.ReactNode; children: React.ReactNode }) {
    return (
        <section className="rise rounded-3xl bg-white/[0.025] border border-white/[0.06] px-5 py-4" aria-label={title}>
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-white/65 break-words">{title}</h3>
                    <p className="text-[12px] text-white/50 mt-1">{note}</p>
                </div>
                {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
            </div>
            <div className="mt-3.5">{children}</div>
        </section>
    );
}

type Sort = "newest" | "name" | "size";
type Kind = "all" | "images" | "videos" | "documents" | "archives" | "other";

const KINDS: { id: Kind; label: string; ext: string[] }[] = [
    { id: "images", label: "Images", ext: ["png", "jpg", "jpeg", "webp", "heic", "gif", "bmp"] },
    { id: "videos", label: "Videos", ext: ["mp4", "mov", "avi", "mkv"] },
    { id: "documents", label: "Documents", ext: ["pdf", "txt", "md", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "csv"] },
    { id: "archives", label: "Archives", ext: ["zip", "rar", "7z", "tar", "gz"] },
];

function kindOfFile(name: string): Kind {
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    return KINDS.find(k => k.ext.includes(ext))?.id ?? "other";
}

/**
 * The files of one device. A few at first; *See all* opens it in place into a
 * browser - search by name, sort (newest, name, size), filter by kind - so a
 * device sharing hundreds of files stays usable.
 */
function FileGrid({ files, all, onAll, render }: { files: SharedFile[]; all: boolean; onAll: (open: boolean) => void; render: (f: SharedFile) => React.ReactNode }) {
    const [query, setQuery] = useState("");
    const [sort, setSort] = useState<Sort>("newest");
    const [kind, setKind] = useState<Kind>("all");

    const shown = useMemo(() => {
        if (!all) return files.slice(0, SHOWN);
        const q = query.trim().toLowerCase();
        const list = files.filter(f => (!q || f.name.toLowerCase().includes(q)) && (kind === "all" || kindOfFile(f.name) === kind));
        return [...list].sort((a, b) =>
            sort === "name" ? a.name.localeCompare(b.name) : sort === "size" ? b.size - a.size : b.modified - a.modified);
    }, [files, all, query, sort, kind]);

    const present = KINDS.filter(k => files.some(f => kindOfFile(f.name) === k.id));
    const hasOther = files.some(f => kindOfFile(f.name) === "other");

    return (
        <>
            {all && (
                <div className="flex flex-wrap items-center gap-2 mb-3">
                    <label className="flex items-center gap-2 h-9 px-3 rounded-xl bg-black/30 border border-white/10 focus-within:border-blue-400/50 min-w-[240px] flex-1 max-w-[380px]">
                        <Search className="w-3.5 h-3.5 text-white/45 shrink-0" strokeWidth={2.25} aria-hidden />
                        <input
                            autoFocus
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Search by name"
                            aria-label="Search by name"
                            spellCheck={false}
                            className="flex-1 min-w-0 bg-transparent outline-none text-[13px] text-white/90 placeholder:text-white/35"
                        />
                        {query && (
                            <button onClick={() => setQuery("")} aria-label="Clear the search" className={`p-0.5 rounded text-white/45 hover:text-white cursor-pointer ${FOCUS}`}>
                                <X className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden />
                            </button>
                        )}
                    </label>
                    <div className="flex items-center gap-1" role="group" aria-label="Kind">
                        {[{ id: "all" as Kind, label: "All" }, ...present, ...(hasOther ? [{ id: "other" as Kind, label: "Other" }] : [])].map(k => (
                            <button key={k.id} onClick={() => setKind(k.id)} aria-pressed={kind === k.id}
                                className={`h-8 px-3 rounded-full border text-[12px] font-semibold transition-all cursor-pointer ${FOCUS}
                                    ${kind === k.id ? "bg-white/[0.09] border-white/20 text-white" : "bg-transparent border-white/[0.07] text-white/55 hover:text-white/85"}`}>
                                {k.label}
                            </button>
                        ))}
                    </div>
                    <label className="ml-auto flex items-center gap-2 text-[12px] text-white/55">
                        Sort
                        <select value={sort} onChange={e => setSort(e.target.value as Sort)}
                            className={`h-8 px-2 rounded-lg bg-black/30 border border-white/10 text-[12px] text-white/85 cursor-pointer ${FOCUS}`}>
                            <option value="newest">Newest</option>
                            <option value="name">Name</option>
                            <option value="size">Size</option>
                        </select>
                    </label>
                </div>
            )}
            {shown.length === 0 ? (
                <p className="text-[13px] text-white/55">No file matches.</p>
            ) : (
                <ul className={`grid gap-1.5 grid-cols-[repeat(auto-fill,minmax(340px,1fr))] ${all ? "max-h-[420px] overflow-y-auto custom-scrollbar pr-1" : ""}`}>
                    {shown.map(f => (
                        <li key={f.name} className="flex items-center gap-3 p-2 pl-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                            <span className="w-8 h-8 shrink-0 rounded-lg bg-white/[0.05] flex items-center justify-center" aria-hidden><FileGlyph name={f.name} /></span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-[13px] font-semibold text-white/90 truncate" title={f.name}>{f.name}</span>
                                <span className="block text-[11px] text-white/45">{formatSize(f.size)} · {dateLabel(f.modified)}</span>
                            </span>
                            {render(f)}
                        </li>
                    ))}
                </ul>
            )}
            {files.length > SHOWN || all ? (
                <button onClick={() => onAll(!all)} className={`mt-2.5 flex items-center gap-1 text-[12px] font-semibold text-white/60 hover:text-white cursor-pointer rounded ${FOCUS}`}>
                    {all
                        ? <>Show fewer <ChevronUp className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden /></>
                        : <>See all {files.length}, search and sort <ChevronDown className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden /></>}
                </button>
            ) : null}
        </>
    );
}

function FileGlyph({ name }: { name: string }) {
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    const c = "w-4 h-4";
    if (["png", "jpg", "jpeg", "webp", "heic", "gif", "bmp"].includes(ext)) return <ImageIcon className={`${c} text-blue-300/70`} strokeWidth={2} />;
    if (["mp4", "mov", "avi", "mkv"].includes(ext)) return <Video className={`${c} text-pink-300/70`} strokeWidth={2} />;
    if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return <Archive className={`${c} text-yellow-300/70`} strokeWidth={2} />;
    if (["txt", "md", "pdf", "doc", "docx"].includes(ext)) return <FileText className={`${c} text-white/60`} strokeWidth={2} />;
    return <File className={`${c} text-white/55`} strokeWidth={2} />;
}

function dateLabel(secs: number) {
    const d = new Date(secs * 1000);
    return d.toDateString() === new Date().toDateString()
        ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : d.toLocaleDateString([], { day: "numeric", month: "short" });
}

function IconAction({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
    return (
        <button onClick={onClick} aria-label={label} title={label}
            className={`p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all cursor-pointer ${FOCUS}`}>
            {children}
        </button>
    );
}

function Skeletons() {
    return <div className="grid gap-1.5 grid-cols-[repeat(auto-fill,minmax(340px,1fr))]">{[0, 1].map(i => <span key={i} className="skeleton block h-12 rounded-xl" />)}</div>;
}

function Empty({ children }: { children: React.ReactNode }) {
    return <p className="text-[13px] text-white/55 leading-snug">{children}</p>;
}
