import { useEffect, useState } from "react";
import { HudCard, type TransferPayload } from "../components/HudCard";

/**
 * Le banc du HUD — **toutes les variantes en même temps.**
 *
 * On ne juge pas une animation seule : jouée isolément, une entrée paraît
 * toujours à peu près juste. Posée à côté d'une plus courte et d'une plus
 * lente, on voit immédiatement laquelle est molle et laquelle est sèche.
 * Pareil pour une ombre, qui ne se juge que par comparaison et que sur le fond
 * réel — une ombre correcte sur fond sombre devient une tache sur fond clair.
 *
 * Chaque cellule rejoue la sienne, en boucle et **en même temps que les
 * autres**, pour que les écarts soient lisibles. Rien à cliquer : on regarde.
 *
 * Entrée de développement : `npm run dev` puis `/banc.html`. Hors de
 * `vite.config.ts` — dev seulement, aucun poids en production.
 */

/** Toutes les cellules rejouent ensemble : c'est la simultanéité qui compare. */
const PERIODE_MS = 2600;

const TEXTE: TransferPayload = {
    kind: "text", direction: "incoming", target: "clipboard",
    name: "Rendez-vous jeudi 14h, salle du fond", path: null, size: null,
};
const FICHIER: TransferPayload = {
    kind: "file", direction: "incoming", target: "folder",
    name: "contrat-signe-2026.pdf", path: null, size: 284_517,
};
const IMAGE: TransferPayload = {
    kind: "image", direction: "incoming", target: "clipboard",
    name: null, path: null, size: 1_204_889,
};
const LONG: TransferPayload = {
    kind: "file", direction: "incoming", target: "folder",
    name: "capture-decran-2026-09-12-a-14h32m07s-tres-longue.png", path: null, size: 3_910_442,
};
const SORTANT: TransferPayload = {
    kind: "text", direction: "outgoing", target: "clipboard",
    name: "Contenu repris depuis le PC", path: null, size: null,
};

type Cellule = {
    nom: string;
    /** Ce que la cellule cherche à montrer. */
    quoi: string;
    payload: TransferPayload;
    /** Surcharge l'animation de `.hud-card`. Vide = celle du produit. */
    animation?: string;
    /** Surcharge l'ombre. Vide = celle du produit. */
    ombre?: string;
    /** Marge de la carte dans sa fenêtre. C'est elle qui borne l'ombre :
     *  au-delà de `marge` px de débord, l'ombre est rognée par le bord. */
    marge?: number;
    /** Taille de la fenêtre simulée, quand la marge change. */
    cadre?: { w: number; h: number };
};

/** L'entrée : même carte, mêmes couleurs, seule la motion change. */
const ANIMATIONS: Cellule[] = [
    { nom: "produit", quoi: "ce qui est livré : 14px, 260ms, ease-out-expo", payload: TEXTE },
    { nom: "sans animation", quoi: "la référence — apparition sèche, pour mesurer l'apport des autres", payload: TEXTE, animation: "none" },
    { nom: "course courte", quoi: "8px : plus discret, mais l'œil peut le rater", payload: TEXTE, animation: "banc-in-court 260ms var(--ease-out-expo) both" },
    { nom: "course longue", quoi: "22px et 360ms : lisible, au risque de paraître lourd", payload: TEXTE, animation: "banc-in-long 360ms var(--ease-out-expo) both" },
    { nom: "ressort", quoi: "la courbe à dépassement de l'app — vivant, ou nerveux ?", payload: TEXTE, animation: "banc-in-long 320ms var(--ease-spring) both" },
    { nom: "sans échelle", quoi: "translation seule : est-ce que le scale apporte vraiment ?", payload: TEXTE, animation: "banc-in-plat 260ms var(--ease-out-expo) both" },
];

/** L'ombre : figée, parce qu'une ombre se regarde, elle ne se joue pas. */
const OMBRES: Cellule[] = [
    { nom: "produit", quoi: "0 6px 18px /.55 — dimensionnée pour tenir dans les 24px de marge", payload: FICHIER, animation: "none" },
    { nom: "l'ancienne", quoi: "0 12px 32px /.7 — celle qui était rognée par le bord de la fenêtre", payload: FICHIER, animation: "none", ombre: "0 12px 32px rgba(0,0,0,0.7)" },
    { nom: "serrée", quoi: "0 4px 12px /.5 — posée, presque collée au fond", payload: FICHIER, animation: "none", ombre: "0 4px 12px rgba(0,0,0,0.5)" },
    { nom: "large et douce", quoi: "0 10px 28px /.4 — flotte davantage, salit moins", payload: FICHIER, animation: "none", ombre: "0 10px 28px rgba(0,0,0,0.4)" },
    { nom: "aucune", quoi: "la référence : la carte tient-elle sans ombre du tout ?", payload: FICHIER, animation: "none", ombre: "none" },
];

/**
 * La meilleure ombre du lot — 0 10px 28px — déborde de 38px et ne tient pas
 * dans les 24px actuels : la reprendre telle quelle recréerait le rognage
 * d'origine. Ces cellules élargissent donc la marge ET la fenêtre, pour voir
 * si le gain justifie la fenêtre plus grande.
 */
const MARGES: Cellule[] = [
    { nom: "24px — l'actuel", quoi: "0 6px 18px /.55 : déborde de 24px, tient tout juste", payload: FICHIER, animation: "none" },
    {
        nom: "32px + ombre large", quoi: "0 8px 22px /.45 : déborde de 30px, tient dans 32px",
        payload: FICHIER, animation: "none", ombre: "0 8px 22px rgba(0,0,0,0.45)",
        marge: 32, cadre: { w: 396, h: 172 },
    },
    {
        nom: "40px + la meilleure", quoi: "0 10px 28px /.4 : déborde de 38px, exige 40px de marge",
        payload: FICHIER, animation: "none", ombre: "0 10px 28px rgba(0,0,0,0.4)",
        marge: 40, cadre: { w: 412, h: 188 },
    },
];

/** Le contenu : mêmes réglages, charges utiles différentes. */
const CONTENUS: Cellule[] = [
    { nom: "texte", quoi: "le cas courant", payload: TEXTE },
    { nom: "fichier", quoi: "nom et taille", payload: FICHIER },
    { nom: "image", quoi: "sans nom — la taille porte seule", payload: IMAGE },
    { nom: "nom très long", quoi: "le cas qui casse une mise en page", payload: LONG },
    { nom: "sortant", quoi: "l'autre direction : vert, flèche inversée", payload: SORTANT },
];

/** Le HUD flotte sur le bureau : une ombre ne se juge pas hors de son fond. */
const FONDS = [
    { nom: "bureau sombre", css: "linear-gradient(135deg, #0b1220, #17233a)" },
    { nom: "bureau clair", css: "linear-gradient(135deg, #d8dee9, #f2f4f8)" },
    { nom: "photo chargée", css: "linear-gradient(135deg, #6b2d5c, #c9803a 55%, #1f6f6b)" },
];

function Cellule({ cellule, tick, fond }: { cellule: Cellule; tick: number; fond: string }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 340 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ color: "#fff", fontSize: 12, fontWeight: 800, letterSpacing: ".04em" }}>{cellule.nom}</span>
            </div>
            <p style={{ color: "rgba(255,255,255,.45)", fontSize: 11, lineHeight: 1.45, margin: 0, minHeight: 32 }}>
                {cellule.quoi}
            </p>

            {/* La fenêtre réelle : 372x148, carte encastrée de 24px. Reproduite
                telle quelle, sinon l'ombre aurait une place qu'elle n'a pas. */}
            <div style={{
                // La vraie fenêtre, d'après tauri.conf.json. À resynchroniser si
                // elle change : un banc qui simule une fenêtre périmée ment.
                width: cellule.cadre?.w ?? 396, height: cellule.cadre?.h ?? 172,
                background: fond, borderRadius: 10, position: "relative", overflow: "hidden",
            }}>
                <HudCard
                    key={`${cellule.nom}-${tick}`}
                    payload={cellule.payload}
                    style={{
                        ...(cellule.animation ? { animation: cellule.animation } : {}),
                        ...(cellule.ombre ? { boxShadow: cellule.ombre === "none" ? "none" : cellule.ombre } : {}),
                        ...(cellule.marge != null ? { margin: cellule.marge } : {}),
                    }}
                />
            </div>
        </div>
    );
}

function Rangee({ titre, sous, cellules, tick, fond }: {
    titre: string; sous: string; cellules: Cellule[]; tick: number; fond: string;
}) {
    return (
        <section style={{ marginBottom: 44 }}>
            <h2 style={{ color: "#fff", fontSize: 14, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".18em", margin: "0 0 4px" }}>
                {titre}
            </h2>
            <p style={{ color: "rgba(255,255,255,.4)", fontSize: 12, margin: "0 0 18px", maxWidth: 760, lineHeight: 1.5 }}>{sous}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 28 }}>
                {cellules.map(c => <Cellule key={c.nom} cellule={c} tick={tick} fond={fond} />)}
            </div>
        </section>
    );
}

/**
 * Échelle d'affichage du banc.
 *
 * Rien à voir avec le produit : c'est pour que plusieurs cellules tiennent dans
 * une capture d'écran étroite. Un banc dont on ne voit qu'une cellule à la fois
 * n'est plus un banc, c'est un diaporama — et toute sa valeur tient dans la
 * comparaison simultanée.
 */
const ECHELLES = [0.5, 0.7, 1];

export function HudBanc() {
    const [tick, setTick] = useState(0);
    // Le fond clair par défaut : c'est lui qui révèle une ombre. Sur le fond
    // sombre les cinq variantes se ressemblent toutes, donc la vue par défaut
    // serait celle qui n'apprend rien.
    const [fond, setFond] = useState(FONDS[1].css);
    const [echelle, setEchelle] = useState(0.7);

    useEffect(() => {
        const id = window.setInterval(() => setTick(t => t + 1), PERIODE_MS);
        return () => window.clearInterval(id);
    }, []);

    return (
        <div style={{
            minHeight: "100vh", background: "#0a0a0a", padding: "32px 36px",
            fontFamily: "Inter, system-ui, sans-serif",
            // Purely so several cells fit one screenshot - see ECHELLES.
            zoom: echelle,
        }}>
            {/* Variantes propres au banc : elles ne partent pas en production. */}
            <style>{`
                @keyframes banc-in-court { from { opacity:0; transform: translateY(8px) scale(.97) } to { opacity:1; transform:none } }
                @keyframes banc-in-long  { from { opacity:0; transform: translateY(22px) scale(.94) } to { opacity:1; transform:none } }
                @keyframes banc-in-plat  { from { opacity:0; transform: translateY(14px) } to { opacity:1; transform:none } }
            `}</style>

            <header style={{ marginBottom: 34 }}>
                <h1 style={{ color: "#fff", fontSize: 19, fontWeight: 900, margin: "0 0 6px", letterSpacing: "-.01em" }}>
                    Banc du HUD
                </h1>
                <p style={{ color: "rgba(255,255,255,.45)", fontSize: 12.5, margin: 0, maxWidth: 760, lineHeight: 1.6 }}>
                    Toutes les variantes rejouent ensemble, toutes les {PERIODE_MS / 1000} s. Rien à cliquer : on regarde et on compare.
                    Chaque cadre reproduit la vraie fenêtre (396×172) avec sa marge de 32 px, pour que l'ombre dispose de la place
                    qu'elle aura réellement.
                </p>

                <div style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "center" }}>
                    <span style={{ color: "rgba(255,255,255,.35)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".14em", fontWeight: 800 }}>
                        Fond
                    </span>
                    {FONDS.map(f => (
                        <button
                            key={f.nom}
                            onClick={() => setFond(f.css)}
                            style={{
                                cursor: "pointer", fontSize: 11, padding: "5px 11px", borderRadius: 999,
                                border: fond === f.css ? "1px solid rgba(96,165,250,.55)" : "1px solid rgba(255,255,255,.12)",
                                background: fond === f.css ? "rgba(59,130,246,.16)" : "transparent",
                                color: fond === f.css ? "#93c5fd" : "rgba(255,255,255,.55)",
                            }}
                        >
                            {f.nom}
                        </button>
                    ))}

                    <span style={{ color: "rgba(255,255,255,.35)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".14em", fontWeight: 800, marginLeft: 18 }}>
                        Échelle
                    </span>
                    {ECHELLES.map(e => (
                        <button
                            key={e}
                            onClick={() => setEchelle(e)}
                            style={{
                                cursor: "pointer", fontSize: 11, padding: "5px 11px", borderRadius: 999,
                                border: echelle === e ? "1px solid rgba(96,165,250,.55)" : "1px solid rgba(255,255,255,.12)",
                                background: echelle === e ? "rgba(59,130,246,.16)" : "transparent",
                                color: echelle === e ? "#93c5fd" : "rgba(255,255,255,.55)",
                            }}
                        >
                            {Math.round(e * 100)}%
                        </button>
                    ))}
                </div>
            </header>

            <Rangee
                titre="Entrée"
                sous="Même carte, même fond : seule la motion change. La cellule « sans animation » est la référence — si une variante ne se distingue pas d'elle, elle ne sert à rien."
                cellules={ANIMATIONS} tick={tick} fond={fond}
            />
            <Rangee
                titre="Ombre"
                sous="Figées exprès : une ombre se regarde, elle ne se joue pas. Change le fond ci-dessus — c'est sur le fond clair qu'une ombre trop appuyée se trahit."
                cellules={OMBRES} tick={tick} fond={fond}
            />
            <Rangee
                titre="Marge et fenêtre"
                sous="L'ombre est bornée par la marge : au-delà, elle est rognée par le bord de la fenêtre. Élargir l'ombre impose donc d'élargir la fenêtre. Ces trois-là montrent ce que coûte, et ce que rapporte, chaque palier."
                cellules={MARGES} tick={tick} fond={fond}
            />
            <Rangee
                titre="Contenu"
                sous="Mêmes réglages, charges utiles différentes. Le nom très long est là pour casser la mise en page avant qu'un vrai transfert ne s'en charge."
                cellules={CONTENUS} tick={tick} fond={fond}
            />
        </div>
    );
}
