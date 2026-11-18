"use client";
import Link from "next/link";
import { AI } from "@/components/AI";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** Everything on the rug is an item with a centre (x, y), a tilt and a stacking order. The rug is 100 units wide. */
export interface WallItem {
  id: string; kind: "note" | "pola" | "label";
  x: number; y: number; rot: number; z: number; w: number;
  src?: string; iw?: number; ih?: number;
  text?: string; uncertain?: boolean; themeId?: string; themeLabel?: string; status?: string;
  domainId?: string; domainName?: string; count?: number;
}
type Pos = { x: number; y: number; rot: number; z: number };
/** What data/wall-layout.json holds. Items that aren't listed keep their default spot. */
export interface WallLayout { height?: number; background?: string; backgroundMode?: "cover" | "tile"; items: Record<string, Pos> }

/** What scripts/embed-stickies.mjs writes to data/wall-embedding.json: where each note lands when notes are laid out by meaning, and how close each note is to each domain name. */
export interface WallEmbed {
  model: string; made: string; count: number; domains: string[];
  stats: { closestToOwnWord: number; chance: number; neighboursFromSamePile: number; perDomain: Record<string, { notes: number; closestToOwnWord: number }> };
  words: Record<string, { x: number; y: number; nearest: string[]; ownPile: number }>;
  notes: Record<string, { x: number; y: number; sim: number[] }>;
}
type View = "placed" | "meaning" | "pull" | "grid";
const VIEWS: { id: View; label: string; needs?: boolean }[] = [
  { id: "placed", label: "Where we put them" }, { id: "meaning", label: "By meaning", needs: true }, { id: "pull", label: "Pulled by the words", needs: true }, { id: "grid", label: "No groups" },
];
const VIEW_H = 124;   // the canvas is shorter in the computed views, so the map keeps its shape
const TINT: Record<string, string> = { rel: "#e8457a", wor: "#f08a24", sch: "#2f8fd8", com: "#1aa37a", cul: "#8b5cf6", tec: "#111111", pol: "#d43b3b", phy: "#7a9a1f" };
/** A steady pseudo-random number between -1 and 1 for a note, so the same note always gets the same nudge. */
const nudge = (id: string, salt: number) => { let h = salt * 374761393; for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 2654435761); return (((h >>> 0) % 2000) / 1000) - 1; };

const round = (n: number) => Math.round(n * 100) / 100;

export function Wall({ items, defaultHeight, saved, canSave, embed }: { items: WallItem[]; defaultHeight: number; saved: WallLayout | null; canSave: boolean; embed?: WallEmbed | null }) {
  const defaults = useMemo(() => Object.fromEntries(items.map((i) => [i.id, { x: i.x, y: i.y, rot: i.rot, z: i.z }])) as Record<string, Pos>, [items]);
  const [pos, setPos] = useState<Record<string, Pos>>(() => ({ ...defaults, ...(saved?.items ?? {}) }));
  const [height, setHeight] = useState(saved?.height ?? defaultHeight);
  const [bg, setBg] = useState(saved?.background ?? "");
  const [bgMode, setBgMode] = useState<"cover" | "tile">(saved?.backgroundMode ?? "cover");
  const [editing, setEditing] = useState(false);
  const [canEdit, setCanEdit] = useState(canSave);
  const [sel, setSel] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState<WallItem | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  const drag = useRef<{ id: string; px: number; py: number; x: number; y: number } | null>(null);
  const [view, setViewState] = useState<View>("placed");
  const [tint, setTint] = useState(false);
  const [pulling, setPulling] = useState(false);
  /** Where each domain word sits in the "Pulled by the words" view; drag a word and its notes follow. */
  const ring = useMemo(() => {
    const ids = embed?.domains ?? []; const out: Record<string, { x: number; y: number }> = {};
    ids.forEach((d, k) => { const a = (k / ids.length) * 2 * Math.PI - Math.PI / 2; out[d] = { x: round(50 + 40 * Math.cos(a)), y: round(VIEW_H / 2 + (VIEW_H / 2 - 14) * Math.sin(a)) }; });
    return out;
  }, [embed]);
  const [anchors, setAnchors] = useState(ring);
  useEffect(() => { setAnchors(ring); }, [ring]);
  const setView = (v: View) => {
    setViewState(v); setEditing(false); setSel(null);
    try { const u = new URL(window.location.href); if (v === "placed") u.searchParams.delete("view"); else u.searchParams.set("view", v); window.history.replaceState(null, "", u); } catch { /* fine */ }
  };
  useEffect(() => { const v = new URLSearchParams(window.location.search).get("view") as View | null; if (v && VIEWS.some((x) => x.id === v && (!x.needs || embed))) setViewState(v); }, [embed]);

  useEffect(() => { if (new URLSearchParams(window.location.search).has("edit")) { setCanEdit(true); setEditing(true); } }, []);
  useEffect(() => {
    const d = dlg.current; if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const patch = useCallback((id: string, p: Partial<Pos>) => setPos((all) => ({ ...all, [id]: { ...all[id], ...p } })), []);
  const topZ = () => Math.max(...Object.values(pos).map((p) => p.z)) + 1;
  const bottomZ = () => Math.min(...Object.values(pos).map((p) => p.z)) - 1;

  const down = (e: React.PointerEvent, id: string) => {
    if (view === "pull" && anchors[id.replace(/^label-/, "")] && id.startsWith("label-")) {
      const d = id.slice(6); e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setPulling(true); drag.current = { id: `anchor:${d}`, px: e.clientX, py: e.clientY, x: anchors[d].x, y: anchors[d].y }; return;
    }
    if (!editing) return;
    e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setSel(id); drag.current = { id, px: e.clientX, py: e.clientY, x: pos[id].x, y: pos[id].y };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current, c = canvas.current; if (!d || !c) return;
    const unit = c.getBoundingClientRect().width / 100;
    if (d.id.startsWith("anchor:")) {
      const k = d.id.slice(7), x = round(Math.min(96, Math.max(4, d.x + (e.clientX - d.px) / unit))), y = round(Math.min(VIEW_H - 5, Math.max(5, d.y + (e.clientY - d.py) / unit)));
      setAnchors((a) => ({ ...a, [k]: { x, y } })); return;
    }
    patch(d.id, { x: round(Math.min(100, Math.max(0, d.x + (e.clientX - d.px) / unit))), y: round(Math.min(height, Math.max(0, d.y + (e.clientY - d.py) / unit))) });
  };
  const up = () => { drag.current = null; setPulling(false); };
  const key = (e: React.KeyboardEvent, id: string) => {
    if (!editing) return;
    const step = e.shiftKey ? 2 : 0.5, p = pos[id];
    const moves: Record<string, Partial<Pos>> = {
      ArrowLeft: { x: round(p.x - step) }, ArrowRight: { x: round(p.x + step) }, ArrowUp: { y: round(p.y - step) }, ArrowDown: { y: round(p.y + step) },
      "[": { rot: p.rot - 5 }, "]": { rot: p.rot + 5 },
    };
    if (moves[e.key]) { e.preventDefault(); setSel(id); patch(id, moves[e.key]); }
  };

  const layout = (): WallLayout => {
    const changed: Record<string, Pos> = {};
    for (const [id, p] of Object.entries(pos)) {
      const d = defaults[id];
      if (!d || p.x !== d.x || p.y !== d.y || p.rot !== d.rot || p.z !== d.z) changed[id] = { x: round(p.x), y: round(p.y), rot: round(p.rot), z: p.z };
    }
    return { height, ...(bg && !bg.startsWith("blob:") ? { background: bg.split("?")[0], backgroundMode: bgMode } : {}), items: changed };
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(layout(), null, 1) + "\n"], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "wall-layout.json"; a.click(); URL.revokeObjectURL(url);
  };
  const save = async () => {
    try {
      const r = await fetch("/api/wall-layout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(layout()) });
      if (r.ok) { setMsg("Saved to data/wall-layout.json."); return; }
    } catch { /* fall through to download */ }
    download(); setMsg("This copy of the site can't write files, so the layout was downloaded. Put wall-layout.json in the repo's data folder.");
  };
  const pickBackground = async (file: File | undefined) => {
    if (!file) return;
    const body = new FormData(); body.append("file", file);
    try {
      const r = await fetch("/api/wall-layout", { method: "POST", body });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.path) { setBg(`${j.path}?v=${Date.now()}`); setMsg(`Background saved as public${j.path}. Press Save layout to keep it.`); return; }
      if (j?.reason && j.reason !== "read-only") { setMsg(j.reason); return; }
    } catch { /* preview only */ }
    setBg(URL.createObjectURL(file));
    setMsg("Preview only here. To keep it, add the image to the repo's public folder as wall-background.jpg (or .png) and run the site on your computer.");
  };
  const reset = () => { setPos(defaults); setHeight(defaultHeight); setSel(null); setMsg("Back to the eight piles. Nothing is saved until you press Save layout."); };

  const s = sel ? pos[sel] : null;
  const H = view === "placed" ? height : VIEW_H;
  /** Where everything sits in the view on show. "Where we put them" is the saved layout; the other views are worked out from the notes' meaning. */
  const shown = useMemo(() => {
    if (view === "placed") return pos;
    const out: Record<string, Pos> = {};
    const notes = items.filter((i) => i.kind === "note");
    if (view === "grid") {
      const cols = 15, order = notes.slice().sort((a, b) => nudge(a.id, 3) - nudge(b.id, 3));
      order.forEach((it, k) => { out[it.id] = { x: round(5 + (k % cols) * (90 / (cols - 1))), y: round(8 + Math.floor(k / cols) * 9.6), rot: round(nudge(it.id, 5) * 5), z: 1 }; });
      return out;
    }
    if (!embed) return pos;
    const doms = embed.domains;
    for (const it of notes) {
      const e = embed.notes[it.id]; if (!e) { out[it.id] = { x: 50, y: VIEW_H - 4, rot: 0, z: 0 }; continue; }
      if (view === "meaning") { out[it.id] = { x: round(7 + e.x * 86), y: round(8 + e.y * (VIEW_H - 16)), rot: round(nudge(it.id, 5) * 9), z: 1 + Math.round((nudge(it.id, 7) + 1) * 9) }; continue; }
      const w = e.sim.map((v) => Math.exp(v / 0.045)), sum = w.reduce((a, b) => a + b, 0);   // a note is pulled hardest by the word it is closest to in meaning
      let x = 0, y = 0; doms.forEach((d, k) => { x += (w[k] / sum) * anchors[d].x; y += (w[k] / sum) * anchors[d].y; });
      out[it.id] = { x: round(x + nudge(it.id, 1) * 1.6), y: round(y + nudge(it.id, 2) * 1.6), rot: round(nudge(it.id, 5) * 9), z: 1 + Math.round((nudge(it.id, 7) + 1) * 9) };
    }
    for (const d of doms) out[`label-${d}`] = view === "meaning"
      ? { x: round(7 + embed.words[d].x * 86), y: round(8 + embed.words[d].y * (VIEW_H - 16)), rot: 0, z: 40 }
      : { x: anchors[d].x, y: anchors[d].y, rot: 0, z: 40 };
    return out;
  }, [view, pos, items, embed, anchors]);
  const rugStyle: React.CSSProperties = bg
    ? { backgroundImage: `url("${bg}")`, backgroundSize: bgMode === "tile" ? "420px auto" : "cover", backgroundRepeat: bgMode === "tile" ? "repeat" : "no-repeat", backgroundPosition: "center" }
    : {};

  return (
    <>
      <div className="wallviews" role="toolbar" aria-label="How the notes are grouped">
        <span className="eyebrow">Group the notes</span>
        {VIEWS.map((v) => <button key={v.id} type="button" className="btn ghost" aria-pressed={view === v.id} disabled={!!v.needs && !embed} title={v.needs && !embed ? "Run node scripts/embed-stickies.mjs first" : ""} onClick={() => setView(v.id)}>{v.label}</button>)}
        <button type="button" className="btn ghost" aria-pressed={tint} onClick={() => setTint(!tint)} title="Ring every note in the colour of the pile we put it in">Colour by our pile</button>
        <p className="thint">
          {view === "placed" && "The eight piles, as we laid them out on the floor."}
          {view === "grid" && "Every note on its own, shuffled, with no piles and no labels."}
          {view === "meaning" && embed && <AI>A small language model read every note and placed notes that mean similar things near each other (t-SNE). Each domain name sits in the middle of the eight notes closest to it in meaning. On this map, {Math.round(embed.stats.neighboursFromSamePile * 100)}% of a note’s nearest neighbours come from the same pile we put it in.</AI>}
          {view === "pull" && embed && <AI>Each note is pulled toward the domain names it is closest to in meaning, so notes that fit several domains float in between. Drag a word and its notes follow. {embed.stats.closestToOwnWord} of {embed.count} notes are closest to the name of the pile we put them in; picking at random would give about {Math.round(embed.stats.chance)}.</AI>}
        </p>
      </div>
      {canEdit && view === "placed" && (
        <div className="walltools" role="toolbar" aria-label="Wall layout">
          {!editing ? (
            <button type="button" className="btn ghost" onClick={() => setEditing(true)}>Edit layout</button>
          ) : (
            <>
              <div className="tgroup">
                <span className="eyebrow">Selected</span>
                <button type="button" className="btn ghost" disabled={!s} onClick={() => sel && patch(sel, { rot: pos[sel].rot - 5 })} aria-label="Tilt left">↺</button>
                <button type="button" className="btn ghost" disabled={!s} onClick={() => sel && patch(sel, { rot: pos[sel].rot + 5 })} aria-label="Tilt right">↻</button>
                <button type="button" className="btn ghost" disabled={!s} onClick={() => sel && patch(sel, { rot: 0 })}>Straighten</button>
                <button type="button" className="btn ghost" disabled={!s} onClick={() => sel && patch(sel, { z: topZ() })}>To front</button>
                <button type="button" className="btn ghost" disabled={!s} onClick={() => sel && patch(sel, { z: bottomZ() })}>To back</button>
              </div>
              <div className="tgroup">
                <span className="eyebrow">Background</span>
                <label className="btn ghost filebtn">Choose image…<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { void pickBackground(e.target.files?.[0]); e.target.value = ""; }} /></label>
                <button type="button" className="btn ghost" disabled={!bg} onClick={() => setBgMode(bgMode === "cover" ? "tile" : "cover")}>{bgMode === "cover" ? "Tile it" : "Stretch it"}</button>
                <button type="button" className="btn ghost" disabled={!bg} onClick={() => setBg("")}>Use the rug</button>
              </div>
              <div className="tgroup">
                <span className="eyebrow">Rug length</span>
                <button type="button" className="btn ghost" onClick={() => setHeight((h) => Math.max(40, h - 10))} aria-label="Shorter">−</button>
                <button type="button" className="btn ghost" onClick={() => setHeight((h) => h + 10)} aria-label="Longer">+</button>
              </div>
              <div className="tgroup">
                <button type="button" className="btn" onClick={() => void save()}>Save layout</button>
                <button type="button" className="btn ghost" onClick={download}>Download file</button>
                <button type="button" className="btn ghost" onClick={reset}>Reset to piles</button>
                <button type="button" className="btn ghost" onClick={() => { setEditing(false); setSel(null); }}>Done</button>
              </div>
              <p className="thint">Drag anything to move it. Arrow keys nudge the selected item; [ and ] tilt it.</p>
            </>
          )}
          <p className="tmsg" role="status">{msg}</p>
        </div>
      )}

      <div className={`rug${editing ? " editing" : ""}${pulling ? " pulling" : ""} view-${view}`} style={rugStyle}>
        <div className="rugcanvas" ref={canvas} style={{ aspectRatio: `100 / ${H}` }} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          {items.map((it) => {
            if (view !== "placed" && (it.kind === "pola" || (it.kind === "label" && view === "grid"))) return null;
            const p = shown[it.id] ?? pos[it.id] ?? it;
            const ringColour = tint && it.domainId ? TINT[it.domainId] : undefined;
            const style = { left: `${p.x}%`, top: `${(p.y / H) * 100}%`, zIndex: p.z + 100, ["--w" as string]: it.kind === "label" && view !== "placed" ? 10 : it.w, ["--r" as string]: `${p.rot}deg`, ...(ringColour ? { outline: `.38cqw solid ${ringColour}`, outlineOffset: it.kind === "label" ? ".3cqw" : "0" } : {}) } as React.CSSProperties;
            const common = { style, "data-id": it.id, onPointerDown: (e: React.PointerEvent) => down(e, it.id), onKeyDown: (e: React.KeyboardEvent) => key(e, it.id) };
            const cls = `item ${it.kind}${sel === it.id ? " sel" : ""}`;
            if (it.kind === "label") {
              return editing || view === "pull"
                ? <div key={it.id} className={`${cls}${view === "pull" ? " grab" : ""}`} tabIndex={0} {...common}><span>{it.text}</span><small>{view === "pull" ? "drag me" : `${it.count} notes`}</small></div>
                : <Link key={it.id} className={cls} href={`/domain/${it.domainId}`} title={`Open ${it.domainName}`} style={style}><span>{it.text}</span><small>{it.count} notes</small></Link>;
            }
            if (it.kind === "pola") {
              return (
                <div key={it.id} className={cls} tabIndex={editing ? 0 : -1} aria-hidden={!editing} {...common}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.src} alt="" loading="lazy" decoding="async" draggable={false} />
                </div>
              );
            }
            return (
              <button key={it.id} type="button" className={cls} aria-label={`Sticky note: ${it.text}`} onClick={() => { if (!editing) setOpen(it); }} {...common}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.src} alt="" width={it.iw} height={it.ih} loading="lazy" decoding="async" draggable={false} />
              </button>
            );
          })}
        </div>
      </div>

      <dialog className="notedlg" ref={dlg} onClose={() => setOpen(null)} onClick={(e) => { if (e.target === dlg.current) setOpen(null); }}>
        {open && (
          <div className="notebody">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={open.src} alt="" width={open.iw} height={open.ih} />
            <div className="noteinfo">
              <span className="eyebrow">{open.domainName}</span>
              <blockquote>“{open.text}”{open.uncertain && <span className="unc"> (handwriting partly uncertain)</span>}</blockquote>
              {open.themeLabel && <p className="th"><AI>{open.themeLabel}</AI></p>}
              {open.themeId ? (
                <Link className="ext" href={`/domain/${open.domainId}#theme-${open.themeId}`}>
                  {open.status === "covered" ? "See who's working on this →" : "Untapped so far. See the details →"}
                </Link>
              ) : (
                <Link className="ext" href={`/domain/${open.domainId}`}>See the rest of {open.domainName} →</Link>
              )}
              <button type="button" className="btn ghost" onClick={() => setOpen(null)}>Close</button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
