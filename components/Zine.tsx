"use client";
import { memo, useCallback, useEffect, useRef, useState } from "react";

/** A page is 100 units wide and 100 × ratio tall. Items are placed by their centre. Text size is in the same units. */
export interface ZineItem {
  id: string; type: "image" | "text";
  x: number; y: number; w: number; h: number; rot: number; z: number;
  src?: string; text?: string; font?: string; size?: number; color?: string; bold?: boolean; italic?: boolean; align?: "left" | "center" | "right";
}
export interface ZinePage { id: string; bg: string; items: ZineItem[] }
export interface ZineDoc { ratio: number; pages: ZinePage[] }

const FONTS = ["Arial", "Georgia", "Courier New", "Bradley Hand", "Impact", "Playfair Display", "Lato"];
const stack = (f?: string) => `"${f ?? "Arial"}", ${f === "Georgia" || f === "Playfair Display" ? "serif" : f === "Courier New" ? "monospace" : f === "Bradley Hand" ? "cursive" : "Arial, sans-serif"}`;
const uid = () => Math.random().toString(36).slice(2, 9);
const r2 = (n: number) => Math.round(n * 100) / 100;

function itemStyle(it: ZineItem, ratio: number): React.CSSProperties {
  return { left: `${it.x}%`, top: `${(it.y / (100 * ratio)) * 100}%`, width: `${it.w}cqw`, height: `${it.h}cqw`, zIndex: it.z, transform: `translate(-50%,-50%) rotate(${it.rot}deg)` };
}
function ItemBody({ it }: { it: ZineItem }) {
  if (it.type === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={it.src} alt="" draggable={false} />;
  }
  return <div className="ztext" style={{ fontFamily: stack(it.font), fontSize: `${it.size ?? 4}cqw`, color: it.color, fontWeight: it.bold ? 700 : 400, fontStyle: it.italic ? "italic" : "normal", textAlign: it.align }}>{it.text}</div>;
}
/** A page as readers see it. */
const PageView = memo(function PageView({ page, ratio }: { page?: ZinePage; ratio: number }) {
  if (!page) return <div className="zpage blank" />;
  return (
    <div className="zpage" style={{ background: page.bg }}>
      {page.items.map((it) => <div key={it.id} className={`zitem ${it.type}`} style={itemStyle(it, ratio)}><ItemBody it={it} /></div>)}
    </div>
  );
});

export function Zine({ initial, canSave }: { initial: ZineDoc; canSave: boolean }) {
  const [doc, setDoc] = useState<ZineDoc>(initial);
  const [editing, setEditing] = useState(false);
  const [canEdit, setCanEdit] = useState(canSave);
  useEffect(() => { if (new URLSearchParams(window.location.search).has("edit")) { setCanEdit(true); setEditing(true); } }, []);
  return editing
    ? <Editor doc={doc} setDoc={setDoc} done={() => setEditing(false)} />
    : <Book doc={doc} onEdit={canEdit ? () => setEditing(true) : undefined} />;
}

/* ---------- Reading: the zine as one folded strip ----------
   The pages behave like an accordion-folded sheet that was never pressed flat (like M.J.'s zine in the craft scans):
   every page leans a few degrees, alternately, so the fold inside a spread sinks in (valley) and the fold between one
   spread and the next stands up (ridge). Closed, the cover lies flat in the middle. Each press pulls the strip one page
   to the left like a conveyor: the page leaving on the left swings shut behind its crease while the next page swings
   open from behind the crease on the right. Previous runs the same motion backwards. */
type Panel = { page: number; a: number; bend?: number };   // bend: how loosely the crease on this page's left curves   // a: angle about the page's left edge, degrees; + means the right edge leans away

const TILT = 11;
/** How page p leans when the zine is open. The edge between page k and k+1 is a valley when k is odd, a ridge when even. */
const rest = (p: number) => (p % 2 === 1 ? TILT : -TILT);

function layout(n: number, s: number, single: boolean): Panel[] {
  if (single) return [{ page: s, a: s === 0 || s === n - 1 ? 0 : rest(s) * 0.5 }];
  if (s === 0) return [{ page: 0, a: 0 }];
  if (s >= n) return [{ page: n - 1, a: 0 }];
  return [{ page: s - 1, a: rest(s - 1) }, { page: s, a: rest(s) }];
}
/** Panels part-way (t from 0 to 1) through the move from spread s to s+1. */
function between(n: number, s: number, t: number, single: boolean): Panel[] {
  // while a crease is moving the paper rolls over it in a looser curve, then settles back into a tight fold
  const loose = BEND + 0.17 * Math.sin(Math.PI * t);
  const out = (p: number) => ({ page: p, a: rest(p) * (1 - t) - 90 * t });     // folding shut behind its right-hand crease
  const inn = (p: number, to = rest(p)) => ({ page: p, a: 90 * (1 - t) + to * t, bend: loose }); // unfolding from behind its left-hand crease
  if (single) {
    const r = (p: number) => (p === 0 || p === n - 1 ? 0 : rest(p) * 0.5);
    return [{ page: s, a: r(s) * (1 - t) - 90 * t }, inn(s + 1, r(s + 1))];
  }
  if (s === 0) return [{ page: 0, a: rest(0) * t }, inn(1)];                              // opening: the cover lifts into its lean
  if (s + 1 >= n) return [out(n - 2), { page: n - 1, a: rest(n - 1) * (1 - t), bend: loose }];          // closing: the back cover settles flat
  return [out(s - 1), { page: s, a: rest(s), bend: loose }, inn(s + 1)];
}
/* The strip is drawn as thin vertical slices so the paper can bend: away from the creases a page is flat, and over a
   short stretch either side of each crease the angle eases from one page's lean to the next, so folds are rounded
   like real unpressed paper rather than knife-sharp hinges. An outward (ridge) crease catches a highlight along its
   curve; an inward (valley) crease falls into soft shadow. */
const BEND = 0.07;     // half-width of the curved band around a crease, in page widths
const BEND_SLICES = 9; // slices across each half of that band
const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
type Slice = { key: string; page: number; v0: number; v1: number; x: number; z: number; w: number; a: number; eL: number; eR: number };

function slices(panels: Panel[]) {
  const m = panels.length;
  const bendOf = (i: number) => Math.min(0.3, panels[i]?.bend ?? BEND);
  const angleAt = (u: number) => {                         // u: position along the strip, in page widths
    let a = panels[0].a;
    for (let i = 1; i < m; i++) { const b = bendOf(i); a += (panels[i].a - panels[i - 1].a) * smooth((u - i + b) / (2 * b)); }
    return a;
  };
  // light from the front, a little from the left; plus a highlight or shadow wherever the paper curves
  const light = (u: number) => {
    const a = (angleAt(u) * Math.PI) / 180;
    const diffuse = (Math.cos(a) - 0.35 * Math.sin(a)) / 1.06;
    const e = BEND * 0.6, curv = angleAt(Math.min(m, u + e)) - angleAt(Math.max(0, u - e));   // degrees turned nearby
    const ridge = Math.max(0, Math.min(1, curv / 50)), valley = Math.max(0, Math.min(1, -curv / 50));
    return (0.94 - diffuse) * 0.9 + valley * 0.32 - ridge * 0.4;      // > 0 darker, < 0 brighter
  };
  // cut points along the strip
  const cuts: number[] = [0];
  for (let i = 0; i < m; i++) {
    const bl = i === 0 ? 0 : bendOf(i), br = i === m - 1 ? 0 : bendOf(i + 1);
    const lo = i === 0 ? [] : Array.from({ length: BEND_SLICES }, (_, k) => i + (bl * (k + 1)) / BEND_SLICES);
    const hi = i === m - 1 ? [] : Array.from({ length: BEND_SLICES }, (_, k) => i + 1 - br + (br * k) / BEND_SLICES);
    cuts.push(...lo, ...hi, i + 1);
  }
  const uniq = [...new Set(cuts.map((c) => Math.round(c * 1e6) / 1e6))].sort((p, q) => p - q);
  let x = 0, z = 0, mzs = 0, ws = 0;
  const out: Slice[] = [];
  for (let k = 0; k < uniq.length - 1; k++) {
    const u0 = uniq[k], u1 = uniq[k + 1], len = u1 - u0;
    const i = Math.min(m - 1, Math.floor(u0 + 1e-9));
    const a = angleAt((u0 + u1) / 2), r = (a * Math.PI) / 180;
    const w = Math.cos(r) * len, dz = -Math.sin(r) * len;
    out.push({ key: `${panels[i].page}-${k}`, page: panels[i].page, v0: u0 - i, v1: u1 - i, x, z, w, a, eL: light(u0), eR: light(u1) });
    mzs += (z + dz / 2) * Math.abs(w); ws += Math.abs(w);
    x += w; z += dz;
  }
  const zc = ws ? mzs / ws : 0;
  return { total: x, items: out.map((o) => ({ ...o, z: o.z - zc })) };
}
const tone = (v: number) => (v >= 0 ? `rgba(40,26,12,${Math.min(0.42, v).toFixed(3)})` : `rgba(255,252,244,${Math.min(0.55, -v).toFixed(3)})`);
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function Book({ doc, onEdit }: { doc: ZineDoc; onEdit?: () => void }) {
  const n = doc.pages.length;
  const [s, setS] = useState(0);                    // 0 = cover alone; k = pages k-1 | k; n = last page alone
  const [move, setMove] = useState<{ from: number; t: number; dir: 1 | -1 } | null>(null);
  const [single, setSingle] = useState(false);
  const raf = useRef(0);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 700px), (orientation: portrait)"); const f = () => setSingle(mq.matches);
    f(); mq.addEventListener("change", f); return () => mq.removeEventListener("change", f);
  }, []);
  useEffect(() => { const o = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = o; cancelAnimationFrame(raf.current); }; }, []);
  const last = single ? n - 1 : n;
  const step = (dir: 1 | -1) => {
    if (move) return;
    const to = s + dir; if (to < 0 || to > last) return;
    const from = dir > 0 ? s : to;                   // a move is always described as from → from+1, played forwards or backwards
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches, dur = reduce ? 1 : 850, t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      if (k < 1) { setMove({ from, dir, t: dir > 0 ? ease(k) : 1 - ease(k) }); raf.current = requestAnimationFrame(tick); }
      else { setMove(null); setS(to); }
    };
    raf.current = requestAnimationFrame(tick);
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "ArrowRight") step(1); if (e.key === "ArrowLeft") step(-1); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  });

  const panels = move ? between(n, move.from, move.t, single) : layout(n, s, single);
  const { total, items } = slices(panels);
  return (
    <section className="zinefull" aria-label="The zine" aria-roledescription="book">
      <a className="zcorner home" href="/" aria-label="Back to the site">×</a>
      {onEdit && <button type="button" className="zcorner edit" onClick={onEdit}>Edit</button>}
      <div className={`zarea${single ? " single" : ""}`} style={{ ["--ratio" as string]: doc.ratio, ["--span" as string]: total }}>
        <div className="zground" />
        <div className="strip">
          {items.map((p) => {
            if (p.w <= 0.0005) return null;
            const style: React.CSSProperties = {
              left: `calc(var(--pw) * ${p.x})`,
              width: `calc(var(--pw) * ${p.v1 - p.v0} + 1.5px)`,   // a hair of overlap hides seams between slices
              transform: `translateZ(calc(var(--pw) * ${p.z})) rotateY(${p.a}deg)`,
              ["--tone" as string]: `linear-gradient(90deg, ${tone(p.eL)}, ${tone(p.eR)})`,
            };
            return (
              <div key={p.key} className="slice" style={style}>
                <div className="sheet" style={{ left: `calc(var(--pw) * ${-p.v0})` }}><PageView page={doc.pages[p.page]} ratio={doc.ratio} /></div>
              </div>
            );
          })}
        </div>
        <button type="button" className="turn prev" onClick={() => step(-1)} disabled={s === 0 || !!move} aria-label="Previous page">◀</button>
        <button type="button" className="turn next" onClick={() => step(1)} disabled={s === last || !!move} aria-label="Next page">▶</button>
      </div>
      <p className="sr-only" role="status">{s === 0 ? "Cover" : `Page ${Math.min(n, s + 1)} of ${n}`}</p>
    </section>
  );
}

/* ---------- Editing: one page at a time ---------- */
type Drag = { mode: "move" | "size" | "turn"; id: string; px: number; py: number; start: ZineItem; cx: number; cy: number };

function Editor({ doc, setDoc, done }: { doc: ZineDoc; setDoc: React.Dispatch<React.SetStateAction<ZineDoc>>; done: () => void }) {
  const [pi, setPi] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [typing, setTyping] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const sheet = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const page = doc.pages[Math.min(pi, doc.pages.length - 1)];
  const H = 100 * doc.ratio;
  const cur = page.items.find((i) => i.id === sel) ?? null;

  const setPage = useCallback((fn: (p: ZinePage) => ZinePage) => setDoc((d) => ({ ...d, pages: d.pages.map((p, i) => (i === pi ? fn(p) : p)) })), [pi, setDoc]);
  const patch = useCallback((id: string, c: Partial<ZineItem>) => setPage((p) => ({ ...p, items: p.items.map((it) => (it.id === id ? { ...it, ...c } : it)) })), [setPage]);
  const topZ = () => Math.max(0, ...page.items.map((i) => i.z)) + 1;
  const add = (it: Omit<ZineItem, "id" | "z" | "rot" | "x" | "y">) => { const id = uid(); setPage((p) => ({ ...p, items: [...p.items, { ...it, id, x: 50, y: H / 2, rot: 0, z: topZ() }] })); setSel(id); };

  const addImage = useCallback(async (file: File) => {
    let src = "";
    try {
      const body = new FormData(); body.append("file", file);
      const r = await fetch("/api/zine", { method: "POST", body }); const j = await r.json().catch(() => null);
      if (r.ok && j?.path) src = j.path; else if (j?.reason && j.reason !== "read-only") { setMsg(j.reason); return; }
    } catch { /* keep it inside the file instead */ }
    if (!src) src = await new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.readAsDataURL(file); });
    const dim = await new Promise<{ w: number; h: number }>((res) => { const im = new Image(); im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight }); im.onerror = () => res({ w: 1, h: 1 }); im.src = src; });
    const w = 60, h = r2(Math.min(H * 0.8, (w * dim.h) / dim.w));
    add({ type: "image", src, w: r2((h * dim.w) / dim.h), h });
  }, [H, page.items]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/"));
      if (files.length) { e.preventDefault(); files.forEach((f) => void addImage(f)); }
    };
    const onKey = (e: KeyboardEvent) => {
      if (typing || !sel || (e.target as HTMLElement)?.closest("input,select,textarea")) return;
      const it = page.items.find((i) => i.id === sel); if (!it) return;
      const s = e.shiftKey ? 2 : 0.5;
      const k: Record<string, Partial<ZineItem>> = { ArrowLeft: { x: r2(it.x - s) }, ArrowRight: { x: r2(it.x + s) }, ArrowUp: { y: r2(it.y - s) }, ArrowDown: { y: r2(it.y + s) }, "[": { rot: it.rot - 5 }, "]": { rot: it.rot + 5 } };
      if (k[e.key]) { e.preventDefault(); patch(sel, k[e.key]); }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); setPage((p) => ({ ...p, items: p.items.filter((i) => i.id !== sel) })); setSel(null); }
    };
    document.addEventListener("paste", onPaste); document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("paste", onPaste); document.removeEventListener("keydown", onKey); };
  }, [addImage, page.items, patch, sel, setPage, typing]);

  const begin = (e: React.PointerEvent, it: ZineItem, mode: Drag["mode"]) => {
    if (typing === it.id) return;
    e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const b = sheet.current!.getBoundingClientRect(), u = b.width / 100;
    setSel(it.id); drag.current = { mode, id: it.id, px: e.clientX, py: e.clientY, start: it, cx: b.left + it.x * u, cy: b.top + it.y * u };
  };
  const moveP = (e: React.PointerEvent) => {
    const d = drag.current; if (!d || !sheet.current) return;
    const u = sheet.current.getBoundingClientRect().width / 100, s = d.start;
    if (d.mode === "move") patch(d.id, { x: r2(s.x + (e.clientX - d.px) / u), y: r2(s.y + (e.clientY - d.py) / u) });
    else if (d.mode === "turn") {
      let a = (Math.atan2(e.clientY - d.cy, e.clientX - d.cx) * 180) / Math.PI + 90;
      a = ((a + 540) % 360) - 180; const snap = Math.round(a / 90) * 90; patch(d.id, { rot: Math.abs(a - snap) < 4 ? snap : Math.round(a) });
    } else {
      const t = (-s.rot * Math.PI) / 180, dx = e.clientX - d.cx, dy = e.clientY - d.cy;   // pointer in the item's own axes
      let w = Math.max(4, (2 * Math.abs(dx * Math.cos(t) - dy * Math.sin(t))) / u), h = Math.max(3, (2 * Math.abs(dx * Math.sin(t) + dy * Math.cos(t))) / u);
      if (s.type === "image" && !e.shiftKey) { const k = Math.max(w / s.w, h / s.h); w = s.w * k; h = s.h * k; }
      patch(d.id, { w: r2(w), h: r2(h) });
    }
  };

  const movePage = (to: number) => { if (to < 0 || to >= doc.pages.length) return; setDoc((d) => { const p = [...d.pages]; const [x] = p.splice(pi, 1); p.splice(to, 0, x); return { ...d, pages: p }; }); setPi(to); };
  const download = () => { const url = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 1) + "\n"], { type: "application/json" })); const a = document.createElement("a"); a.href = url; a.download = "zine.json"; a.click(); URL.revokeObjectURL(url); };
  const save = async () => {
    try { const r = await fetch("/api/zine", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(doc) }); if (r.ok) { setMsg("Saved to data/zine.json."); return; } } catch { /* download instead */ }
    download(); setMsg("This copy of the site can't write files, so zine.json was downloaded. Put it in the repo's data folder.");
  };

  return (
    <section className="zine editing" aria-label="Zine editor">
      <div className="ztools" role="toolbar" aria-label="Zine tools">
        <div className="tgroup">
          <span className="eyebrow">Page {pi + 1} of {doc.pages.length}</span>
          <button type="button" className="btn ghost" onClick={() => { setPi(Math.max(0, pi - 1)); setSel(null); }} disabled={pi === 0} aria-label="Previous page">←</button>
          <button type="button" className="btn ghost" onClick={() => { setPi(Math.min(doc.pages.length - 1, pi + 1)); setSel(null); }} disabled={pi === doc.pages.length - 1} aria-label="Next page">→</button>
          <button type="button" className="btn ghost" onClick={() => { setDoc((d) => { const p = [...d.pages]; p.splice(pi + 1, 0, { id: `p${uid()}`, bg: "#f8f3ea", items: [] }); return { ...d, pages: p }; }); setPi(pi + 1); setSel(null); }}>Add page</button>
          <button type="button" className="btn ghost" onClick={() => movePage(pi - 1)} disabled={pi === 0}>Move earlier</button>
          <button type="button" className="btn ghost" onClick={() => movePage(pi + 1)} disabled={pi === doc.pages.length - 1}>Move later</button>
          <button type="button" className="btn ghost" disabled={doc.pages.length < 2 || page.items.length > 0} title={page.items.length ? "Empty the page first" : ""} onClick={() => { setDoc((d) => ({ ...d, pages: d.pages.filter((_, i) => i !== pi) })); setPi(Math.max(0, pi - 1)); }}>Delete page</button>
          <label className="swatch">Paper <input type="color" value={page.bg} onChange={(e) => setPage((p) => ({ ...p, bg: e.target.value }))} /></label>
        </div>
        <div className="tgroup">
          <span className="eyebrow">Add</span>
          <button type="button" className="btn ghost" onClick={() => add({ type: "text", w: 60, h: 14, text: "Text", font: "Arial", size: 5, color: "#1b1037", bold: false, italic: false, align: "left" })}>Text box</button>
          <label className="btn ghost filebtn">Image…<input type="file" accept="image/*" multiple onChange={(e) => { [...(e.target.files ?? [])].forEach((f) => void addImage(f)); e.target.value = ""; }} /></label>
          <span className="thint">or paste an image (⌘V), or drop one on the page</span>
        </div>
        <div className="tgroup">
          <span className="eyebrow">Selected</span>
          {cur?.type === "text" && (
            <>
              <select aria-label="Font" value={cur.font} onChange={(e) => patch(cur.id, { font: e.target.value })}>{FONTS.map((f) => <option key={f}>{f}</option>)}</select>
              <button type="button" className="btn ghost" onClick={() => patch(cur.id, { size: r2(Math.max(1, (cur.size ?? 4) - 0.5)) })} aria-label="Smaller text">A−</button>
              <button type="button" className="btn ghost" onClick={() => patch(cur.id, { size: r2((cur.size ?? 4) + 0.5) })} aria-label="Larger text">A+</button>
              <button type="button" className="btn ghost" aria-pressed={!!cur.bold} onClick={() => patch(cur.id, { bold: !cur.bold })}><b>B</b></button>
              <button type="button" className="btn ghost" aria-pressed={!!cur.italic} onClick={() => patch(cur.id, { italic: !cur.italic })}><i>I</i></button>
              <select aria-label="Alignment" value={cur.align} onChange={(e) => patch(cur.id, { align: e.target.value as ZineItem["align"] })}><option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option></select>
              <label className="swatch">Colour <input type="color" value={cur.color ?? "#000000"} onChange={(e) => patch(cur.id, { color: e.target.value })} /></label>
            </>
          )}
          <button type="button" className="btn ghost" disabled={!cur} onClick={() => cur && patch(cur.id, { rot: 0 })}>Straighten</button>
          <button type="button" className="btn ghost" disabled={!cur} onClick={() => cur && patch(cur.id, { z: topZ() })}>To front</button>
          <button type="button" className="btn ghost" disabled={!cur} onClick={() => cur && patch(cur.id, { z: Math.min(0, ...page.items.map((i) => i.z)) - 1 })}>To back</button>
          <button type="button" className="btn ghost" disabled={!cur} onClick={() => { if (!cur) return; const id = uid(); setPage((p) => ({ ...p, items: [...p.items, { ...cur, id, x: cur.x + 4, y: cur.y + 4, z: topZ() }] })); setSel(id); }}>Duplicate</button>
          <button type="button" className="btn ghost" disabled={!cur} onClick={() => { setPage((p) => ({ ...p, items: p.items.filter((i) => i.id !== sel) })); setSel(null); }}>Delete</button>
        </div>
        <div className="tgroup">
          <button type="button" className="btn" onClick={() => void save()}>Save zine</button>
          <button type="button" className="btn ghost" onClick={download}>Download file</button>
          <button type="button" className="btn ghost" onClick={done}>Done</button>
        </div>
        <p className="thint">Drag to move. Drag the corner dot to resize (hold Shift on an image to squash it) and the top dot to rotate. Double-click a text box to type.</p>
        <p className="tmsg" role="status">{msg}</p>
      </div>

      <div className="zsheetwrap" style={{ ["--ratio" as string]: doc.ratio }}>
        <div className="zpage zsheet" ref={sheet} style={{ background: page.bg }} onPointerMove={moveP} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
          onPointerDown={(e) => { if (e.target === e.currentTarget) { setSel(null); setTyping(null); } }}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); [...e.dataTransfer.files].filter((f) => f.type.startsWith("image/")).forEach((f) => void addImage(f)); }}>
          {page.items.map((it) => (
            <div key={it.id} className={`zitem ${it.type}${sel === it.id ? " sel" : ""}${typing === it.id ? " typing" : ""}`} style={itemStyle(it, doc.ratio)}
              onPointerDown={(e) => begin(e, it, "move")} onDoubleClick={() => { if (it.type === "text") { setTyping(it.id); setSel(it.id); } }}>
              {it.type === "text" && typing === it.id ? (
                <textarea className="ztext" autoFocus value={it.text ?? ""} onChange={(e) => patch(it.id, { text: e.target.value })} onBlur={() => setTyping(null)}
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{ fontFamily: stack(it.font), fontSize: `${it.size ?? 4}cqw`, color: it.color, fontWeight: it.bold ? 700 : 400, fontStyle: it.italic ? "italic" : "normal", textAlign: it.align }} />
              ) : <ItemBody it={it} />}
              {sel === it.id && typing !== it.id && (
                <>
                  <span className="hdl turn" onPointerDown={(e) => begin(e, it, "turn")} aria-hidden="true" />
                  <span className="hdl size" onPointerDown={(e) => begin(e, it, "size")} aria-hidden="true" />
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
