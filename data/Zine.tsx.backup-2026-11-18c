"use client";
import { memo, useCallback, useEffect, useRef, useState } from "react";

/** A page is 100 units wide and 100 × ratio tall. Items are placed by their centre. Text size is in the same units. */
export interface ZineItem {
  id: string; type: "image" | "text" | "flip" | "orbit";   // orbit: words (one per line) circling the middle of the box
  x: number; y: number; w: number; h: number; rot: number; z: number;
  src?: string; text?: string; font?: string; size?: number; color?: string; bold?: boolean; italic?: boolean; align?: "left" | "center" | "right";
  srcs?: string[]; speed?: number;   // flip: a set of photos shown one after another, like a flipbook; speed is milliseconds per photo
  win?: boolean; title?: string;      // text: draw it as a little retro window with a title bar
  lock?: boolean;   // pinned in the editor so it can't be picked up by accident; readers see no difference
}
export interface ZinePage { id: string; bg: string; items: ZineItem[] }
export interface ZineDoc { ratio: number; pages: ZinePage[] }

const FONTS = ["Space Grotesk", "Hanken Grotesk", "Arial", "Courier New", "Impact", "Georgia"];
const stack = (f?: string) => `"${f ?? "Arial"}", ${f === "Georgia" || f === "Playfair Display" ? "serif" : f === "Courier New" ? "monospace" : f === "Bradley Hand" ? "cursive" : "Arial, sans-serif"}`;
const uid = () => Math.random().toString(36).slice(2, 9);
const r2 = (n: number) => Math.round(n * 100) / 100;

function itemStyle(it: ZineItem, ratio: number): React.CSSProperties {
  return { left: `${it.x}%`, top: `${(it.y / (100 * ratio)) * 100}%`, width: `${it.w}cqw`, height: `${it.h}cqw`, zIndex: it.z, transform: `translate(-50%,-50%) rotate(${it.rot}deg)` };
}
const pic = (it: ZineItem) => it.type === "image" || it.type === "flip";
/** A stack of photos that takes turns, like thumbing a flipbook. Holds still for people who ask for less motion. */
function Flip({ srcs, speed }: { srcs: string[]; speed?: number }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (srcs.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % srcs.length), Math.max(120, speed ?? 450));
    return () => clearInterval(t);
  }, [srcs.length, speed]);
  // eslint-disable-next-line @next/next/no-img-element
  return <>{srcs.map((s, k) => <img key={k} src={s} alt="" draggable={false} className="zflip" style={{ opacity: k === i % srcs.length ? 1 : 0 }} />)}</>;
}
/** Words drifting round an oval, like a mobile: one word per line of text. A full lap takes `speed` milliseconds. Stands still for people who ask for less motion. */
function Orbit({ it }: { it: ZineItem }) {
  const words = (it.text ?? "").split("\n").map((w) => w.trim()).filter(Boolean);
  const T = Math.max(4000, it.speed ?? 26000) / 1000;
  return (
    <div className="zorbit" style={{ fontFamily: stack(it.font), fontSize: `${it.size ?? 4}cqw`, color: it.color, fontWeight: it.bold ? 700 : 400, fontStyle: it.italic ? "italic" : "normal" }}>
      {words.map((w, k) => {
        const f = k / words.length, a = 2 * Math.PI * f;
        return <span key={k} style={{ left: `${50 - 40 * Math.cos(a)}%`, top: `${50 - 38 * Math.sin(a)}%`, animationDuration: `${T / 2}s`, animationDelay: `${-f * T}s, ${-(f + 0.75) * T}s, ${-(f + 0.75) * T}s` }}>{w}</span>;
      })}
    </div>
  );
}
function ItemBody({ it }: { it: ZineItem }) {
  if (it.type === "flip") return <Flip srcs={it.srcs ?? []} speed={it.speed} />;
  if (it.type === "orbit") return <Orbit it={it} />;
  if (it.type === "text" && it.win) {
    return (
      <div className="zwin">
        <div className="zwinbar"><span>{it.title || "Overheard"}</span><i /><i /><i /></div>
        <div className="ztext" style={{ fontFamily: stack(it.font), fontSize: `${it.size ?? 4}cqw`, color: it.color, fontWeight: it.bold ? 700 : 400, fontStyle: it.italic ? "italic" : "normal", textAlign: it.align }}>{it.text}</div>
      </div>
    );
  }
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

/* ---------- Editing ----------
   One page is active (editable) at a time; the pages either side can be shown next to it so a spread reads as it will
   in the zine. Click a neighbouring page to work on it. */
type Corner = "nw" | "ne" | "sw" | "se";
type Drag = (
  | { mode: "move"; ids: string[]; lead: string; px: number; py: number; starts: Record<string, ZineItem> }
  | { mode: "size"; id: string; start: ZineItem; corner: Corner }
  | { mode: "turn"; id: string; cx: number; cy: number }
  | { mode: "box"; x0: number; y0: number; add: string[]; hit?: string }
) & { moved?: boolean };
const SNAP = 0.8;                                   // how close (in page units) an edge has to be before it snaps
const rad = (d: number) => (d * Math.PI) / 180;
const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
/** Half the width and height of the box an item takes up on the page, allowing for its rotation. */
const half = (it: ZineItem) => { const c = Math.abs(Math.cos(rad(it.rot))), s = Math.abs(Math.sin(rad(it.rot))); return { hw: (it.w * c + it.h * s) / 2, hh: (it.w * s + it.h * c) / 2 }; };
/** Resize to a new width; images keep their shape. */
const widen = (it: ZineItem, w: number): Partial<ZineItem> => (pic(it) ? { w: r2(w), h: r2((it.h * w) / it.w) } : { w: r2(w) });

function Num({ label, value, step = 0.5, onChange }: { label: string; value: number; step?: number; onChange: (v: number) => void }) {
  return <label className="num">{label}<input type="number" step={step} value={value} onChange={(e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) onChange(v); }} /></label>;
}

function Editor({ doc, setDoc, done }: { doc: ZineDoc; setDoc: React.Dispatch<React.SetStateAction<ZineDoc>>; done: () => void }) {
  const [pi, setPi] = useState(0);
  const [sel, setSel] = useState<string[]>([]);
  const [typing, setTyping] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [lib, setLib] = useState(false);            // the photo library panel beside the page
  const [view, setView] = useState(1);              // how many pages to show side by side
  const [first, setFirst] = useState(0);            // the leftmost page on show
  const [clip, setClip] = useState(true);           // hide whatever hangs off the page, as the reader will see it
  const [guides, setGuides] = useState<{ x?: number; y?: number } | null>(null);
  const [box, setBox] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const past = useRef<ZineDoc[]>([]);
  const live = useRef(doc); live.current = doc;
  const n = doc.pages.length, cp = Math.min(pi, n - 1);
  const page = doc.pages[cp];
  const H = 100 * doc.ratio;
  const picked = page.items.filter((i) => sel.includes(i.id));
  const cur = picked.length === 1 ? picked[0] : null;

  useEffect(() => { try { const v = Number(localStorage.getItem("zine-view")); if (v === 2 || v === 4) setView(v); } catch { /* fine */ } }, []);
  const count = Math.min(view, n), s0 = Math.max(0, Math.min(first, n - count));
  const start = cp < s0 ? cp : cp >= s0 + count ? cp - count + 1 : s0;
  useEffect(() => { if (start !== first) setFirst(start); }, [start, first]);
  const go = (to: number) => { setPi(Math.max(0, Math.min(n - 1, to))); setSel([]); setTyping(null); };
  const show = (v: number) => { setView(v); try { localStorage.setItem("zine-view", String(v)); } catch { /* fine */ } };

  /** Remember the zine as it is now, so the next change can be undone. */
  const keep = () => { past.current.push(live.current); if (past.current.length > 80) past.current.shift(); };
  const undo = () => { const p = past.current.pop(); if (p) { setDoc(p); setSel([]); setTyping(null); } };

  const setPage = useCallback((fn: (p: ZinePage) => ZinePage) => setDoc((d) => ({ ...d, pages: d.pages.map((p, i) => (i === cp ? fn(p) : p)) })), [cp, setDoc]);
  const patch = useCallback((id: string, c: Partial<ZineItem>) => setPage((p) => ({ ...p, items: p.items.map((it) => (it.id === id ? { ...it, ...c } : it)) })), [setPage]);
  /** Change every selected item in one undoable step. */
  const each = (fn: (it: ZineItem) => Partial<ZineItem>, pinnedToo = true) => { keep(); setPage((p) => ({ ...p, items: p.items.map((it) => (sel.includes(it.id) && (pinnedToo || !it.lock) ? { ...it, ...fn(it) } : it)) })); };
  const edit = (id: string, c: Partial<ZineItem>) => { keep(); patch(id, c); };
  const topZ = () => Math.max(0, ...page.items.map((i) => i.z)) + 1;
  const add = (it: Omit<ZineItem, "id" | "z" | "rot" | "x" | "y">, at?: { x: number; y: number }) => { const id = uid(); keep(); setPage((p) => ({ ...p, items: [...p.items, { ...it, id, x: at?.x ?? 50, y: at?.y ?? H / 2, rot: 0, z: topZ() }] })); setSel([id]); };
  const remove = () => { if (!sel.length) return; keep(); setPage((p) => ({ ...p, items: p.items.filter((i) => !sel.includes(i.id)) })); setSel([]); };

  /** Puts a picture file in public/zine (or inside the zine file when the site can't save) and says where it went. */
  const store = async (file: File): Promise<string | null> => {
    let src = "";
    try {
      const body = new FormData(); body.append("file", file);
      const r = await fetch("/api/zine", { method: "POST", body }); const j = await r.json().catch(() => null);
      if (r.ok && j?.path) src = j.path; else if (j?.reason && j.reason !== "read-only") { setMsg(j.reason); return null; }
    } catch { /* keep it inside the file instead */ }
    if (!src) src = await new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.readAsDataURL(file); });
    return src;
  };
  const measure = (src: string) => new Promise<{ w: number; h: number }>((res) => { const im = new Image(); im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight }); im.onerror = () => res({ w: 1, h: 1 }); im.src = src; });
  const addImage = useCallback(async (file: File) => {
    const src = await store(file); if (!src) return;
    const dim = await measure(src);
    const w = 60, h = r2(Math.min(H * 0.8, (w * dim.h) / dim.w));
    add({ type: "image", src, w: r2((h * dim.w) / dim.h), h });
  }, [H, page.items]); // eslint-disable-line react-hooks/exhaustive-deps
  /** Several photos become one flipbook, in file-name order; its frame takes the shape of the first photo. */
  const addFlip = async (files: File[]) => {
    const srcs: string[] = [];
    for (const f of [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))) { const src = await store(f); if (src) srcs.push(src); }
    if (!srcs.length) return;
    const dim = await measure(srcs[0]);
    const w = 60, h = r2(Math.min(H * 0.8, (w * dim.h) / dim.w));
    add({ type: "flip", srcs, speed: 450, w: r2((h * dim.w) / dim.h), h });
  };

  /** Copies a picture from the photo library into public/zine and says where it went. */
  const fromLib = async (f: string): Promise<string | null> => {
    try {
      const r = await fetch("/api/zine/library", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ f }) });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.path) return j.path as string;
      setMsg(j?.reason ?? "Couldn't add that picture.");
    } catch { setMsg("Couldn't reach the photo library. Is npm run dev running?"); }
    return null;
  };
  const addLib = async (f: string, at?: { x: number; y: number }) => {
    const src = await fromLib(f); if (!src) return;
    const dim = await measure(src);
    const w = 60, h = r2(Math.min(H * 0.8, (w * dim.h) / dim.w));
    add({ type: "image", src, w: r2((h * dim.w) / dim.h), h }, at);
  };
  const libSrcs = async (fs: string[]) => { const out: string[] = []; for (const f of fs) { const s = await fromLib(f); if (s) out.push(s); } return out; };
  const flipLib = async (fs: string[]) => {
    const srcs = await libSrcs(fs); if (!srcs.length) return;
    const dim = await measure(srcs[0]);
    const w = 60, h = r2(Math.min(H * 0.8, (w * dim.h) / dim.w));
    add({ type: "flip", srcs, speed: 450, w: r2((h * dim.w) / dim.h), h });
  };

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/"));
      if (files.length) { e.preventDefault(); files.forEach((f) => void addImage(f)); }
    };
    const onKey = (e: KeyboardEvent) => {
      if (typing || (e.target as HTMLElement)?.closest("input,select,textarea")) return;
      const mod = e.metaKey || e.ctrlKey, key = e.key.toLowerCase();
      if (mod && key === "z") { e.preventDefault(); undo(); return; }
      if (mod && key === "a") { e.preventDefault(); setSel(page.items.filter((i) => !i.lock).map((i) => i.id)); return; }
      if (e.key === "Escape") { setSel([]); return; }
      if (mod || !sel.length) return;
      const s = e.shiftKey ? 2 : 0.5;
      const mv = ({ ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, -s], ArrowDown: [0, s] } as Record<string, number[]>)[e.key];
      if (mv) { e.preventDefault(); each((it) => ({ x: r2(it.x + mv[0]), y: r2(it.y + mv[1]) }), false); return; }
      if (e.key === "[" || e.key === "]") { e.preventDefault(); each((it) => ({ rot: it.rot + (e.key === "[" ? -5 : 5) })); return; }
      if (e.key === "{" || e.key === "}") { e.preventDefault(); each((it) => ({ rot: it.rot + (e.key === "{" ? -1 : 1) })); return; }
      if ("-_=+".includes(e.key)) { e.preventDefault(); const k = 1 + (e.key === "-" || e.key === "_" ? -1 : 1) * (e.shiftKey ? 0.01 : 0.05); each((it) => ({ w: r2(it.w * k), h: r2(it.h * k) })); return; }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); remove(); }
    };
    document.addEventListener("paste", onPaste); document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("paste", onPaste); document.removeEventListener("keydown", onKey); };
  }); // re-bound every render so the handlers always see the current page and selection

  const toPage = (e: React.PointerEvent) => { const b = sheet.current!.getBoundingClientRect(), u = b.width / 100; return { x: (e.clientX - b.left) / u, y: (e.clientY - b.top) / u, u, b }; };
  const beginMove = (e: React.PointerEvent, it: ZineItem) => {
    if (typing === it.id) return;
    e.preventDefault(); e.stopPropagation();
    if (it.lock) {   // pinned: dragging from it draws a selection box instead of moving it; a plain click selects it
      setTyping(null); sheet.current!.setPointerCapture(e.pointerId);
      const p = toPage(e);
      drag.current = { mode: "box", x0: p.x, y0: p.y, add: e.shiftKey ? sel : [], hit: it.id };
      return;
    }
    if (e.shiftKey) { setSel((s) => (s.includes(it.id) ? s.filter((x) => x !== it.id) : [...s, it.id])); return; }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const ids = sel.includes(it.id) ? sel : [it.id];
    if (!sel.includes(it.id)) { setSel([it.id]); setTyping(null); }
    drag.current = { mode: "move", ids, lead: it.id, px: e.clientX, py: e.clientY, starts: Object.fromEntries(page.items.filter((i) => ids.includes(i.id)).map((i) => [i.id, i])) };
  };
  const beginHandle = (e: React.PointerEvent, it: ZineItem, corner?: Corner) => {
    e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const p = toPage(e);
    drag.current = corner ? { mode: "size", id: it.id, start: it, corner } : { mode: "turn", id: it.id, cx: p.b.left + it.x * p.u, cy: p.b.top + it.y * p.u };
  };
  const beginBox = (e: React.PointerEvent) => {
    const t = e.target as HTMLElement;
    if (t !== e.currentTarget && !t.classList.contains("zclip")) return;
    setTyping(null); e.currentTarget.setPointerCapture(e.pointerId);
    const p = toPage(e);
    drag.current = { mode: "box", x0: p.x, y0: p.y, add: e.shiftKey ? sel : [] };
    if (!e.shiftKey) setSel([]);
  };
  const moveP = (e: React.PointerEvent) => {
    const d = drag.current; if (!d || !sheet.current) return;
    const p = toPage(e);
    if (d.mode === "box") {
      if (!d.moved && Math.hypot(p.x - d.x0, p.y - d.y0) < 0.6) return;
      d.moved = true;
      const l = Math.min(d.x0, p.x), r = Math.max(d.x0, p.x), t = Math.min(d.y0, p.y), b = Math.max(d.y0, p.y);
      setBox({ x0: l, y0: t, x1: r, y1: b });
      setSel([...new Set([...d.add, ...page.items.filter((i) => !i.lock && i.x >= l && i.x <= r && i.y >= t && i.y <= b).map((i) => i.id)])]);
      return;
    }
    if (!d.moved) { keep(); d.moved = true; }
    if (d.mode === "move") {
      let dx = (e.clientX - d.px) / p.u, dy = (e.clientY - d.py) / p.u;
      const g: { x?: number; y?: number } = {};
      if (!e.altKey) {
        // snap the dragged item's edges and centre to the page's and to every other item's
        const s = d.starts[d.lead], { hw, hh } = half(s), xs = [0, 50, 100], ys = [0, H / 2, H];
        for (const o of page.items) { if (d.ids.includes(o.id)) continue; const h = half(o); xs.push(o.x - h.hw, o.x, o.x + h.hw); ys.push(o.y - h.hh, o.y, o.y + h.hh); }
        const near = (c: number, hf: number, lines: number[]) => { let best = SNAP, line: number | undefined; for (const off of [-hf, 0, hf]) for (const L of lines) { const dd = L - (c + off); if (Math.abs(dd) < Math.abs(best)) { best = dd; line = L; } } return line === undefined ? null : { d: best, line }; };
        const bx = near(s.x + dx, hw, xs), by = near(s.y + dy, hh, ys);
        if (bx) { dx += bx.d; g.x = bx.line; }
        if (by) { dy += by.d; g.y = by.line; }
      }
      setGuides(g.x !== undefined || g.y !== undefined ? g : null);
      setPage((pg) => ({ ...pg, items: pg.items.map((it) => (d.starts[it.id] ? { ...it, x: r2(d.starts[it.id].x + dx), y: r2(d.starts[it.id].y + dy) } : it)) }));
    } else if (d.mode === "turn") {
      let a = (Math.atan2(e.clientY - d.cy, e.clientX - d.cx) * 180) / Math.PI + 90;
      a = ((a + 540) % 360) - 180; const snap = Math.round(a / 90) * 90; patch(d.id, { rot: Math.abs(a - snap) < 4 ? snap : Math.round(a) });
    } else {
      // the corner opposite the one being dragged stays put
      const s = d.start, sx = d.corner[1] === "e" ? 1 : -1, sy = d.corner[0] === "s" ? 1 : -1, c = Math.cos(rad(s.rot)), sn = Math.sin(rad(s.rot));
      const ax = s.x - (sx * s.w / 2) * c + (sy * s.h / 2) * sn, ay = s.y - (sx * s.w / 2) * sn - (sy * s.h / 2) * c;
      const vx = p.x - ax, vy = p.y - ay;
      let w = sx * (vx * c + vy * sn), h = sy * (-vx * sn + vy * c);          // pointer measured along the item's own sides
      if (pic(s) && !e.shiftKey) { const k = Math.max(3 / s.w, (w * s.w + h * s.h) / (s.w * s.w + s.h * s.h)); w = s.w * k; h = s.h * k; }   // follow the diagonal
      else { w = Math.max(3, w); h = Math.max(2, h); }
      patch(d.id, { w: r2(w), h: r2(h), x: r2(ax + (sx * w / 2) * c - (sy * h / 2) * sn), y: r2(ay + (sx * w / 2) * sn + (sy * h / 2) * c) });
    }
  };
  const endP = () => { const d = drag.current; if (d?.mode === "box" && !d.moved && d.hit) setSel([...d.add.filter((x) => x !== d.hit), d.hit]); drag.current = null; setGuides(null); setBox(null); };

  /* ----- arranging several items at once ----- */
  const align = (how: "left" | "centre" | "right" | "top" | "middle" | "bottom") => {
    if (picked.length < 2) return;
    const bx = picked.map((it) => ({ it, ...half(it) }));
    const L = Math.min(...bx.map((b) => b.it.x - b.hw)), R = Math.max(...bx.map((b) => b.it.x + b.hw)), T = Math.min(...bx.map((b) => b.it.y - b.hh)), B = Math.max(...bx.map((b) => b.it.y + b.hh));
    each((it) => { const { hw, hh } = half(it); return how === "left" ? { x: r2(L + hw) } : how === "right" ? { x: r2(R - hw) } : how === "centre" ? { x: r2((L + R) / 2) } : how === "top" ? { y: r2(T + hh) } : how === "bottom" ? { y: r2(B - hh) } : { y: r2((T + B) / 2) }; });
  };
  const sameWidth = () => { if (picked.length < 2) return; const W = median(picked.map((i) => i.w)); each((it) => widen(it, W)); };
  /** Equal gaps between the selected items, left to right or top to bottom; the two end items stay where they are. */
  const space = (across: boolean) => {
    if (picked.length < 3) return;
    const pos = (it: ZineItem) => (across ? it.x : it.y), ext = (it: ZineItem) => (across ? half(it).hw : half(it).hh);
    const order = [...picked].sort((a, b) => pos(a) - pos(b));
    const lo = pos(order[0]) - ext(order[0]), hi = pos(order[order.length - 1]) + ext(order[order.length - 1]);
    const gap = (hi - lo - order.reduce((t, it) => t + 2 * ext(it), 0)) / (order.length - 1);
    const to: Record<string, number> = {}; let at = lo;
    for (const it of order) { to[it.id] = r2(at + ext(it)); at += 2 * ext(it) + gap; }
    each((it) => (across ? { x: to[it.id] } : { y: to[it.id] }));
  };
  /** Rows as they roughly are now, made exact: one width, even gutters, rows stacked with the same gutter. */
  const tidy = () => {
    if (picked.length < 2) return;
    const W0 = median(picked.map((i) => i.w)), rowGap = median(picked.map((i) => i.h)) * 0.5;
    const rows: ZineItem[][] = [];
    for (const it of [...picked].sort((a, b) => a.y - b.y)) { const r = rows[rows.length - 1]; if (r && it.y - r.reduce((t, q) => t + q.y, 0) / r.length < rowGap) r.push(it); else rows.push([it]); }
    rows.forEach((r) => r.sort((a, b) => a.x - b.x));
    const L = Math.min(...picked.map((i) => i.x - i.w / 2)), R = Math.max(...picked.map((i) => i.x + i.w / 2)), T = Math.min(...picked.map((i) => i.y - i.h / 2));
    const cols = Math.max(...rows.map((r) => r.length));
    let W = W0, g = cols > 1 ? (R - L - cols * W) / (cols - 1) : 1.5;
    if (g < 1) { g = 1; W = cols > 1 ? (R - L - (cols - 1) * g) / cols : W0; }
    const to: Record<string, Partial<ZineItem>> = {}; let top = T;
    for (const r of rows) {
      const hs = r.map((it) => (pic(it) ? (it.h * W) / it.w : it.h)), rh = Math.max(...hs);
      r.forEach((it, c) => { to[it.id] = { ...widen(it, W), x: r2(L + W / 2 + c * (W + g)), y: r2(top + rh / 2), rot: 0 }; });
      top += rh + g;
    }
    each((it) => to[it.id] ?? {});
  };

  const movePage = (to: number) => { if (to < 0 || to >= n) return; keep(); setDoc((d) => { const p = [...d.pages]; const [x] = p.splice(cp, 1); p.splice(to, 0, x); return { ...d, pages: p }; }); setPi(to); };
  const download = () => { const url = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 1) + "\n"], { type: "application/json" })); const a = document.createElement("a"); a.href = url; a.download = "zine.json"; a.click(); URL.revokeObjectURL(url); };
  const save = async () => {
    try { const r = await fetch("/api/zine", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(doc) }); if (r.ok) { setMsg("Saved to data/zine.json."); return; } } catch { /* download instead */ }
    download(); setMsg("This copy of the site can't write files, so zine.json was downloaded. Put it in the repo's data folder.");
  };
  const textStyle = (it: ZineItem): React.CSSProperties => ({ fontFamily: stack(it.font), fontSize: `${it.size ?? 4}cqw`, color: it.color, fontWeight: it.bold ? 700 : 400, fontStyle: it.italic ? "italic" : "normal", textAlign: it.align });
  const many = picked.length > 1, pinned = picked.length > 0 && picked.every((i) => i.lock), locked = page.items.some((i) => i.lock);

  return (
    <section className="zine editing" aria-label="Zine editor">
      <div className="ztools" role="toolbar" aria-label="Zine tools">
        <div className="tgroup">
          <span className="eyebrow">Page {cp + 1} of {n}</span>
          <button type="button" className="btn ghost" onClick={() => go(cp - 1)} disabled={cp === 0} aria-label="Previous page">←</button>
          <button type="button" className="btn ghost" onClick={() => go(cp + 1)} disabled={cp === n - 1} aria-label="Next page">→</button>
          <button type="button" className="btn ghost" onClick={() => { keep(); setDoc((d) => { const p = [...d.pages]; p.splice(cp + 1, 0, { id: `p${uid()}`, bg: "#f8f3ea", items: [] }); return { ...d, pages: p }; }); go(cp + 1); }}>Add page</button>
          <button type="button" className="btn ghost" onClick={() => movePage(cp - 1)} disabled={cp === 0}>Move earlier</button>
          <button type="button" className="btn ghost" onClick={() => movePage(cp + 1)} disabled={cp === n - 1}>Move later</button>
          <button type="button" className="btn ghost" disabled={n < 2 || page.items.length > 0} title={page.items.length ? "Empty the page first" : ""} onClick={() => { keep(); setDoc((d) => ({ ...d, pages: d.pages.filter((_, i) => i !== cp) })); go(cp - 1); }}>Delete page</button>
          <label className="swatch">Paper <input type="color" value={page.bg} onChange={(e) => setPage((p) => ({ ...p, bg: e.target.value }))} /></label>
        </div>
        <div className="tgroup">
          <span className="eyebrow">Show</span>
          {[1, 2, 4].map((v) => <button key={v} type="button" className="btn ghost" aria-pressed={view === v} onClick={() => show(v)}>{v === 1 ? "1 page" : `${v} pages`}</button>)}
          <button type="button" className="btn ghost" aria-pressed={clip} onClick={() => setClip(!clip)} title="Hide whatever hangs off the edge of the page, the way readers will see it">Trim to page</button>
        </div>
        <div className="tgroup">
          <span className="eyebrow">Add</span>
          <button type="button" className="btn ghost" onClick={() => add({ type: "text", w: 60, h: 14, text: "Text", font: "Arial", size: 5, color: "#1b1037", bold: false, italic: false, align: "left" })}>Text box</button>
          <button type="button" className="btn ghost" onClick={() => add({ type: "text", win: true, title: "Overheard", w: 64, h: 30, text: "Type what was said here.", font: "Space Grotesk", size: 3.6, color: "#2b2755", bold: false, italic: false, align: "left" })}>Window box</button>
          <button type="button" className="btn ghost" title="Words circling the middle of the box. Double-click it to type, one word per line." onClick={() => add({ type: "orbit", w: 84, h: 70, text: "one\nword\nper\nline", font: "Space Grotesk", size: 4.5, color: "#2b2755", bold: true, italic: false, align: "center", speed: 26000 })}>Word orbit</button>
          <label className="btn ghost filebtn">Flipbook…<input type="file" accept="image/*" multiple onChange={(e) => { void addFlip([...(e.target.files ?? [])]); e.target.value = ""; }} /></label>
          <label className="btn ghost filebtn">Image…<input type="file" accept="image/*" multiple onChange={(e) => { [...(e.target.files ?? [])].forEach((f) => void addImage(f)); e.target.value = ""; }} /></label>
          <button type="button" className="btn ghost" aria-pressed={lib} onClick={() => setLib(!lib)} title="Every photo in your retreat folder, ready to drag onto the page">Photo library</button>
          <span className="thint">or paste an image (⌘V), or drop one on the page</span>
        </div>
        <div className="tgroup">
          <span className="eyebrow">{many ? `${picked.length} selected` : "Selected"}</span>
          {cur?.type === "orbit" && <Num label="Lap (ms)" value={cur.speed ?? 26000} step={1000} onChange={(v) => edit(cur.id, { speed: Math.max(4000, v) })} />}
          {(cur?.type === "text" || cur?.type === "orbit") && (
            <>
              <select aria-label="Font" value={cur.font} onChange={(e) => edit(cur.id, { font: e.target.value })}>{FONTS.map((f) => <option key={f}>{f}</option>)}</select>
              <button type="button" className="btn ghost" onClick={() => edit(cur.id, { size: r2(Math.max(1, (cur.size ?? 4) - 0.5)) })} aria-label="Smaller text">A−</button>
              <button type="button" className="btn ghost" onClick={() => edit(cur.id, { size: r2((cur.size ?? 4) + 0.5) })} aria-label="Larger text">A+</button>
              <button type="button" className="btn ghost" aria-pressed={!!cur.bold} onClick={() => edit(cur.id, { bold: !cur.bold })}><b>B</b></button>
              <button type="button" className="btn ghost" aria-pressed={!!cur.italic} onClick={() => edit(cur.id, { italic: !cur.italic })}><i>I</i></button>
              <select aria-label="Alignment" value={cur.align} onChange={(e) => edit(cur.id, { align: e.target.value as ZineItem["align"] })}><option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option></select>
              <label className="swatch">Colour <input type="color" value={cur.color ?? "#000000"} onChange={(e) => patch(cur.id, { color: e.target.value })} /></label>
              {cur.type === "text" && <button type="button" className="btn ghost" aria-pressed={!!cur.win} onClick={() => edit(cur.id, { win: !cur.win })}>Window</button>}
              {cur.win && <label className="swatch">Title <input type="text" className="wintitle" value={cur.title ?? ""} placeholder="Overheard" onChange={(e) => patch(cur.id, { title: e.target.value })} /></label>}
            </>
          )}
          {cur?.type === "flip" && (
            <>
              <span className="eyebrow">{cur.srcs?.length ?? 0} photos</span>
              <Num label="Speed (ms)" value={cur.speed ?? 450} step={50} onChange={(v) => edit(cur.id, { speed: Math.max(120, v) })} />
              <label className="btn ghost filebtn">Add photos…<input type="file" accept="image/*" multiple onChange={async (e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ""; const more: string[] = []; for (const f of fs) { const src = await store(f); if (src) more.push(src); } if (more.length) edit(cur.id, { srcs: [...(cur.srcs ?? []), ...more] }); }} /></label>
            </>
          )}
          {cur && (
            <>
              <Num label="Width" value={cur.w} onChange={(v) => edit(cur.id, widen(cur, Math.max(1, v)))} />
              <Num label="Across" value={cur.x} onChange={(v) => edit(cur.id, { x: v })} />
              <Num label="Down" value={cur.y} onChange={(v) => edit(cur.id, { y: v })} />
              <Num label="Turn" value={cur.rot} step={1} onChange={(v) => edit(cur.id, { rot: v })} />
            </>
          )}
          <button type="button" className="btn ghost" disabled={!picked.length} onClick={() => each(() => ({ rot: 0 }))}>Straighten</button>
          <button type="button" className="btn ghost" disabled={!cur} onClick={() => cur && edit(cur.id, { z: topZ() })}>To front</button>
          <button type="button" className="btn ghost" disabled={!cur} onClick={() => cur && edit(cur.id, { z: Math.min(0, ...page.items.map((i) => i.z)) - 1 })}>To back</button>
          <button type="button" className="btn ghost" disabled={!cur} onClick={() => { if (!cur) return; const id = uid(); keep(); setPage((p) => ({ ...p, items: [...p.items, { ...cur, id, x: cur.x + 4, y: cur.y + 4, z: topZ() }] })); setSel([id]); }}>Duplicate</button>
          <button type="button" className="btn ghost" disabled={!picked.length} title="Pin in place so it can't be dragged by accident (good for backgrounds). Click a pinned item to select it, then Unpin." onClick={() => { const on = !pinned; each(() => ({ lock: on })); if (on) setSel([]); }}>{pinned ? "Unpin" : "Pin"}</button>
          <button type="button" className="btn ghost" disabled={!locked} onClick={() => { keep(); setPage((p) => ({ ...p, items: p.items.map((i) => (i.lock ? { ...i, lock: false } : i)) })); }}>Unpin all</button>
          <button type="button" className="btn ghost" disabled={!picked.length} onClick={remove}>Delete</button>
        </div>
        <div className="tgroup">
          <span className="eyebrow">Arrange</span>
          <button type="button" className="btn ghost" disabled={!many} onClick={tidy} title="Keep the rows as they are, but make every item the same width with even gaps">Tidy into grid</button>
          <button type="button" className="btn ghost" disabled={!many} onClick={sameWidth}>Same width</button>
          <button type="button" className="btn ghost" disabled={picked.length < 3} onClick={() => space(true)}>Space across</button>
          <button type="button" className="btn ghost" disabled={picked.length < 3} onClick={() => space(false)}>Space down</button>
          {(["left", "centre", "right", "top", "middle", "bottom"] as const).map((h) => <button key={h} type="button" className="btn ghost" disabled={!many} onClick={() => align(h)}>{h[0].toUpperCase() + h.slice(1)}</button>)}
        </div>
        <div className="tgroup">
          <button type="button" className="btn" onClick={() => void save()}>Save zine</button>
          <button type="button" className="btn ghost" onClick={download}>Download file</button>
          <button type="button" className="btn ghost" onClick={undo}>Undo</button>
          <button type="button" className="btn ghost" onClick={done}>Done</button>
        </div>
        <p className="thint">Drag to move; edges snap to the page and to other items (hold Option to turn that off). Drag any corner to resize: the opposite corner stays put, and Shift squashes an image. Shift-click or drag across empty paper to select several, ⌘A for everything, ⌘Z to undo. Keys: arrows nudge, − and = shrink and grow, [ and ] rotate. Double-click a text box to type.</p>
        <p className="tmsg" role="status">{msg}</p>
      </div>

      <div className={`zwork${lib ? " withlib" : ""}`}>
      <div className={`zspread${count > 1 ? " multi" : ""}`} style={{ ["--ratio" as string]: doc.ratio, ["--n" as string]: count }}>
        {doc.pages.slice(start, start + count).map((pg, k) => {
          const i = start + k;
          if (i !== cp) return (
            <div key={pg.id} className="zsheetwrap zother" role="button" tabIndex={0} aria-label={`Edit page ${i + 1}`} onClick={() => go(i)} onKeyDown={(e) => { if (e.key === "Enter") go(i); }}>
              <PageView page={pg} ratio={doc.ratio} /><span className="zpno">Page {i + 1}</span>
            </div>
          );
          return (
            <div key={pg.id} className="zsheetwrap zactive">
              <div className="zpage zsheet" ref={sheet} style={{ background: page.bg }} onPointerDown={beginBox} onPointerMove={moveP} onPointerUp={endP} onPointerCancel={endP}
                onDragOver={(e) => e.preventDefault()} onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.getData("text/x-zine-lib");
                  if (f) { const b = sheet.current!.getBoundingClientRect(), u = b.width / 100; void addLib(f, { x: r2((e.clientX - b.left) / u), y: r2((e.clientY - b.top) / u) }); return; }
                  [...e.dataTransfer.files].filter((f) => f.type.startsWith("image/")).forEach((f) => void addImage(f)); }}>
                <div className={`zclip${clip ? " on" : ""}`}>
                  {page.items.map((it) => (
                    <div key={it.id} className={`zitem ${it.type}${it.lock ? " locked" : ""}${typing === it.id ? " typing" : ""}`} style={itemStyle(it, doc.ratio)}
                      onPointerDown={(e) => beginMove(e, it)} onDoubleClick={() => { if (it.type === "text" || it.type === "orbit") { keep(); setTyping(it.id); setSel([it.id]); } }}>
                      {(it.type === "text" || it.type === "orbit") && typing === it.id ? (
                        <textarea className="ztext" autoFocus value={it.text ?? ""} onChange={(e) => patch(it.id, { text: e.target.value })} onBlur={() => setTyping(null)} onPointerDown={(e) => e.stopPropagation()} style={textStyle(it)} />
                      ) : <ItemBody it={it} />}
                    </div>
                  ))}
                </div>
                <div className="zover" aria-hidden="true">
                  {picked.map((it) => typing === it.id ? null : (
                    <div key={it.id} className={`zframe${it.lock ? " locked" : ""}`} style={{ ...itemStyle(it, doc.ratio), zIndex: undefined }}>
                      {cur && !cur.lock && (
                        <>
                          <span className="hdl turn" onPointerDown={(e) => beginHandle(e, it)} />
                          {(["nw", "ne", "sw", "se"] as const).map((c) => <span key={c} className={`hdl ${c}`} onPointerDown={(e) => beginHandle(e, it, c)} />)}
                        </>
                      )}
                    </div>
                  ))}
                  {guides?.x !== undefined && <span className="zguide v" style={{ left: `${guides.x}%` }} />}
                  {guides?.y !== undefined && <span className="zguide h" style={{ top: `${(guides.y / H) * 100}%` }} />}
                  {box && <span className="zbox" style={{ left: `${box.x0}%`, top: `${(box.y0 / H) * 100}%`, width: `${box.x1 - box.x0}%`, height: `${((box.y1 - box.y0) / H) * 100}%` }} />}
                </div>
              </div>
              <span className="zpno">Page {i + 1}</span>
            </div>
          );
        })}
      </div>
      {lib && <Library onAdd={(f) => void addLib(f)} onFlip={(fs) => void flipLib(fs)}
        intoFlip={cur?.type === "flip" ? (fs) => void libSrcs(fs).then((more) => { if (more.length) edit(cur.id, { srcs: [...(cur.srcs ?? []), ...more] }); }) : undefined} />}
      </div>
    </section>
  );
}

/** Every picture in the retreat folder as small previews: drag one onto the page, click to add it, or ⌘-click several for a flipbook. */
function Library({ onAdd, onFlip, intoFlip }: { onAdd: (f: string) => void; onFlip: (fs: string[]) => void; intoFlip?: (fs: string[]) => void }) {
  const [files, setFiles] = useState<string[] | null>(null);
  const [err, setErr] = useState("");
  const [dir, setDir] = useState("");
  const [q, setQ] = useState("");
  const [more, setMore] = useState(1);
  const [pick, setPick] = useState<string[]>([]);
  useEffect(() => {
    fetch("/api/zine/library").then((r) => r.json()).then((j) => {
      if (j?.ok) setFiles(j.files as string[]);
      else setErr(j?.reason === "read-only" ? "The photo library only works while the site runs on your computer (npm run dev)." : j?.reason ?? "Couldn't load the photo library.");
    }).catch(() => setErr("Couldn't load the photo library."));
  }, []);
  const folder = (f: string) => (f.includes("/") ? f.slice(0, f.lastIndexOf("/")) : "");
  const counts = new Map<string, number>();
  for (const f of files ?? []) { const parts = folder(f).split("/").filter(Boolean); for (let i = 1; i <= parts.length; i++) { const d = parts.slice(0, i).join("/"); counts.set(d, (counts.get(d) ?? 0) + 1); } }
  const dirs = [...counts.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const needle = q.trim().toLowerCase();
  const shown = (files ?? []).filter((f) => (!dir || f.startsWith(dir + "/")) && (!needle || f.toLowerCase().includes(needle)));
  const vis = shown.slice(0, 90 * more);
  const toggle = (f: string) => setPick((p) => (p.includes(f) ? p.filter((x) => x !== f) : [...p, f]));
  return (
    <aside className="zlib" aria-label="Photo library">
      <div className="zlibtop"><span className="eyebrow">Photo library</span><span className="thint">{files ? `${shown.length} of ${files.length}` : err ? "" : "Loading…"}</span></div>
      {err && <p className="thint">{err}</p>}
      {files && (
        <>
          <select aria-label="Folder" value={dir} onChange={(e) => { setDir(e.target.value); setMore(1); }}>
            <option value="">All folders</option>
            {dirs.map((d) => <option key={d} value={d}>{"\u00a0\u00a0".repeat(d.split("/").length - 1)}{d.split("/").pop()} ({counts.get(d)})</option>)}
          </select>
          <input type="search" placeholder="Search file names" aria-label="Search file names" value={q} onChange={(e) => { setQ(e.target.value); setMore(1); }} />
          <p className="thint">Drag a photo onto the page, or click to add it. ⌘-click several to make a flipbook.</p>
          {pick.length > 0 && (
            <div className="zlibpick">
              <button type="button" className="btn ghost" onClick={() => { onFlip(pick); setPick([]); }}>Flipbook of {pick.length}</button>
              {intoFlip && <button type="button" className="btn ghost" onClick={() => { intoFlip(pick); setPick([]); }}>Add to selected flipbook</button>}
              <button type="button" className="btn ghost" onClick={() => setPick([])}>Clear</button>
            </div>
          )}
          <div className="zlibgrid">
            {vis.map((f) => (
              <button key={f} type="button" draggable title={f} aria-pressed={pick.includes(f)}
                onDragStart={(e) => { e.dataTransfer.setData("text/x-zine-lib", f); e.dataTransfer.effectAllowed = "copy"; }}
                onClick={(e) => (e.metaKey || e.ctrlKey || e.shiftKey ? toggle(f) : onAdd(f))}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/zine/library?t=1&f=${encodeURIComponent(f)}`} alt={f.split("/").pop() ?? ""} loading="lazy" draggable={false} />
                {pick.includes(f) && <span className="zlibn">{pick.indexOf(f) + 1}</span>}
              </button>
            ))}
          </div>
          {shown.length > vis.length && <button type="button" className="btn ghost" onClick={() => setMore((m) => m + 1)}>Show more ({shown.length - vis.length} left)</button>}
        </>
      )}
    </aside>
  );
}
