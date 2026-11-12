"use client";
import { useCallback, useEffect, useRef, useState } from "react";

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
function PageView({ page, ratio }: { page?: ZinePage; ratio: number }) {
  if (!page) return <div className="zpage blank" />;
  return (
    <div className="zpage" style={{ background: page.bg }}>
      {page.items.map((it) => <div key={it.id} className={`zitem ${it.type}`} style={itemStyle(it, ratio)}><ItemBody it={it} /></div>)}
    </div>
  );
}

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
   The pages behave like an accordion-folded sheet. Closed, the cover sits alone in the middle. Each press pulls the
   strip one page to the left, like a conveyor: the page leaving on the left folds flat away at its crease while the
   next page unfolds out from behind the crease on the right. Pages stay flat and square the whole time; only the
   creases move. Previous runs the same motion backwards. */
type Panel = { page: number; w: number; fold: "none" | "out" | "in" };   // w: shown width as a share of a page (cos of the fold angle)

function layout(n: number, s: number, single: boolean): Panel[] {
  if (single) return [{ page: s, w: 1, fold: "none" }];
  if (s === 0) return [{ page: 0, w: 1, fold: "none" }];
  if (s >= n) return [{ page: n - 1, w: 1, fold: "none" }];
  return [{ page: s - 1, w: 1, fold: "none" }, { page: s, w: 1, fold: "none" }];
}
/** Panels part-way (t from 0 to 1) through the move from spread s to s+1. Shown widths always add up, so nothing jumps. */
function between(n: number, s: number, t: number, single: boolean): Panel[] {
  if (single) return [{ page: s, w: 1 - t, fold: "out" }, { page: s + 1, w: t, fold: "in" }];
  if (s === 0) return [{ page: 0, w: 1, fold: "none" }, { page: 1, w: t, fold: "in" }];                       // opening
  if (s + 1 >= n) return [{ page: n - 2, w: 1 - t, fold: "out" }, { page: n - 1, w: 1, fold: "none" }];          // closing
  return [{ page: s - 1, w: 1 - t, fold: "out" }, { page: s, w: 1, fold: "none" }, { page: s + 1, w: t, fold: "in" }];
}
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
  const total = panels.reduce((a, p) => a + p.w, 0);
  let x = 0;
  return (
    <section className="zinefull" aria-label="The zine" aria-roledescription="book">
      <a className="zcorner home" href="/" aria-label="Back to the site">×</a>
      {onEdit && <button type="button" className="zcorner edit" onClick={onEdit}>Edit</button>}
      <div className={`zarea${single ? " single" : ""}`} style={{ ["--ratio" as string]: doc.ratio, ["--span" as string]: total }}>
        <div className="strip">
          {panels.map((p) => {
            const left = x; x += p.w;
            if (p.w <= 0.001) return null;
            const ang = (Math.acos(Math.min(1, p.w)) * 180) / Math.PI;     // how far this page is folded
            const style: React.CSSProperties = {
              left: `calc(var(--pw) * ${p.fold === "out" ? left + p.w - 1 : left})`,   // a page folding away is pinned at its right-hand crease
              transformOrigin: p.fold === "out" ? "right center" : "left center",
              transform: p.fold === "none" ? undefined : `scaleX(${p.w})`,
              ["--dark" as string]: Math.sin((ang * Math.PI) / 180) * 0.55,
            };
            // Creases alternate like a folded zine: the fold inside a spread (page 2|3, 4|5 …, the binding) is a soft
            // valley; the fold between one spread and the next (cover|2, 3|4 …) is a sharp outward ridge.
            const kind = (a: number) => (a % 2 === 1 ? "valley" : "ridge");               // edge between page a and a+1
            const idx = panels.indexOf(p);
            const cl = idx > 0 ? ` l-${kind(p.page - 1)}` : "", cr = idx < panels.length - 1 ? ` r-${kind(p.page)}` : "";
            return (
              <div key={p.page} className={`panel fold-${p.fold}${cl}${cr}`} style={style}>
                <div className="sheet"><PageView page={doc.pages[p.page]} ratio={doc.ratio} /></div>
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
