"use client";
import POEMS from "@/data/poems.json";
import { WordCloud, type CloudNote } from "@/components/WordCloud";
import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

/** A page is 100 units wide and 100 × ratio tall. Items are placed by their centre. Text size is in the same units. */
export interface ZineItem {
  id: string; type: "image" | "text" | "flip" | "orbit" | "pile" | "map" | "poem" | "cloud";   // cloud: the live word cloud from the site (src is the still image used when printing)   // orbit: words (one per line) circling the middle of the box
  x: number; y: number; w: number; h: number; rot: number; z: number;
  src?: string; text?: string; font?: string; size?: number; color?: string; bold?: boolean; italic?: boolean; align?: "left" | "center" | "right";
  srcs?: string[]; speed?: number;   // flip: a set of photos shown one after another, like a flipbook; speed is milliseconds per photo
  win?: boolean; title?: string; term?: boolean;   // term: draw it as a macOS Terminal window (monospace, traffic lights); title is the window title      // text: draw it as a little retro window with a title bar
  // pile: one domain's sticky notes around its index card. Places are shares of the box (0 to 1). Readers can press a note to read it.
  card?: { src: string; x: number; y: number; w: number; rot: number }; notes?: { id: string; src: string; x: number; y: number; w: number; rot: number; z: number; text: string; dom?: string; m?: [number, number]; sim?: number[] }[];
  // map: every sticky note in one box, which readers can regroup. x, y are where the note lay on the rug; m is its place on the map of meaning; sim is how close it is to each domain's name (same order as words).
  words?: { id: string; name: string; tint: string; src: string; x: number; y: number; w: number; m: [number, number] }[];
  blend?: boolean;  // picture: white paper turns see-through, so only the ink or drawing shows over whatever is behind it
  crop?: { l: number; t: number; r: number; b: number };   // picture: how much is trimmed off each side, as a share of the original (0 to 0.9)
  spread?: boolean; // image or flipbook: whatever hangs off the right edge carries on at the left edge of the next page
  poem?: Poem;      // poem: a poem read at the retreat, shown as its scan/screenshot (src) or as a card that links to where it is published (url)
  link?: string;   // text: a web address; readers can press the text to open it in a new tab
  track?: number; gap?: number;   // text: extra space between letters and between words, in ems
  ai?: boolean;     // text drafted by AI (Claude, or a summary Granola wrote): readers see the site's dashed underline, and the site-wide switch can blur it
  beat?: number;  // flip: turns every `beat` eighth notes of a shared 6/8 pulse (1 to 6), set from its order on the page
  fill?: string;   // text: a solid box behind plain text so it reads over a picture background
  lock?: boolean;   // pinned in the editor so it can't be picked up by accident; readers see no difference
}
export interface ZinePage { id: string; bg: string; items: ZineItem[]; bgImg?: string; bgFit?: "cover" | "contain" | "fill"; tags?: string[] }   // tags: the domains this page touches, shown as small chips in its corner   // bgImg: a picture behind everything on the page, scaled to fill it (cover), to show whole (contain), or stretched to the page edges (fill)
/** The page's own background: its colour, with its background picture over it if it has one. */
const pageBg = (p: ZinePage): React.CSSProperties => (p.bgImg ? { backgroundColor: p.bg, backgroundImage: `url("${p.bgImg}")`, backgroundSize: p.bgFit === "fill" ? "100% 100%" : p.bgFit ?? "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" } : { background: p.bg });
/** The paper every plain page is printed on: its colour, and whether a scan of a real notebook page is laid over it. */
export type Paper = { color?: string; texture?: "none" | "grain" | "page" };
const PAPERS: [string, string][] = [["#fdfef9", "Near white"], ["#fcfcf0", "Moleskine cream"], ["#f8f3ea", "Warm (the old one)"]];
const PLAIN = PAPERS.map(([c]) => c);
export interface ZineDoc { ratio: number; pages: ZinePage[]; paper?: Paper; story?: { title?: string; text: string } }   // story: everything written, in one piece; readers open it as a pop-up

const FONTS = ["Arial", "Space Grotesk", "Hanken Grotesk", "Courier New", "Impact", "Georgia"];
const stack = (f?: string) => `"${f ?? "Arial"}", ${f === "Georgia" || f === "Playfair Display" ? "serif" : f === "Courier New" ? "monospace" : f === "Bradley Hand" ? "cursive" : "Arial, sans-serif"}`;
const uid = () => Math.random().toString(36).slice(2, 9);
const AITIP = "Drafted with AI (Claude, or Granola's summary). Check it against the sources.";
const r2 = (n: number) => Math.round(n * 100) / 100;

function itemStyle(it: ZineItem, ratio: number): React.CSSProperties {
  return { left: `${it.x}%`, top: `${(it.y / (100 * ratio)) * 100}%`, width: `${it.w}cqw`, height: `${it.h}cqw`, zIndex: it.z, transform: `translate(-50%,-50%) rotate(${it.rot}deg)` };
}
const pic = (it: ZineItem) => it.type === "image" || it.type === "flip" || it.type === "pile" || it.type === "map";
const spot = (o: { x: number; y: number; w: number; rot: number }, z: number): React.CSSProperties => ({ left: `${o.x * 100}%`, top: `${o.y * 100}%`, width: `${o.w * 100}%`, transform: `translate(-50%,-50%) rotate(${o.rot}deg)`, zIndex: z });
/** One domain's pile: the index card with its sticky notes around it. Each note is its own picture, so readers can press one to read it. */
function Pile({ it }: { it: ZineItem }) {
  return (
    <div className="zpile">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {it.card && <img className="zpcard" src={it.card.src} alt={it.title ?? ""} draggable={false} style={spot(it.card, 500)} />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {(it.notes ?? []).map((n, k) => <img key={n.id} className="zsticky" data-sticky={k} src={n.src} alt={`Sticky note: ${n.text}`} loading="lazy" draggable={false} style={spot(n, n.z)} />)}
    </div>
  );
}
export type Poem = { title: string; author: string; reader?: string; url?: string; src?: string; note?: string };
/** A poem read at the retreat: its scan or screenshot with a caption, or (when there is no picture) a card that links to the published poem.
    Poems are never retyped here: either the picture the reader brought, or a link. */
function PoemCard({ p }: { p: Poem }) {
  const cap = <>“{p.title}” by {p.author}{p.reader ? <>, read by {p.reader}</> : null}{p.url ? <span className="zlinkmark"> ↗</span> : null}</>;
  const inner = p.src
    // eslint-disable-next-line @next/next/no-img-element
    ? <div className="zpoem img"><img src={p.src} alt={`${p.title} by ${p.author}`} draggable={false} /><div className="zpoemcap">{cap}</div></div>
    : <div className="zpoem card"><span className="eyebrow">Poem</span><b>“{p.title}”</b><span>{p.author}</span>{p.reader && <span>read by {p.reader}</span>}{p.url && <span className="zpoemgo">Read it ↗</span>}</div>;
  return p.url ? <a className="zlink" href={p.url} target="_blank" rel="noopener noreferrer">{inner}</a> : inner;
}
type TodoItem = { id: string; text: string; group: string; page?: number; done?: boolean };
/** The editor's checklist of what is left: decisions and to-dos, kept in data/zine-todo.json (only while the site runs on your computer). */
function Todo() {
  const [items, setItems] = useState<TodoItem[] | null>(null);
  const [err, setErr] = useState("");
  const [hide, setHide] = useState(false);
  const [draft, setDraft] = useState("");
  useEffect(() => {
    fetch("/api/zine/todo").then((r) => r.json()).then((j) => { if (Array.isArray(j?.items)) setItems(j.items); else setErr(j?.reason === "read-only" ? "The checklist only works while the site runs on your computer (npm run dev)." : "Couldn't load the checklist."); }).catch(() => setErr("Couldn't load the checklist."));
  }, []);
  const store = (next: TodoItem[]) => { setItems(next); void fetch("/api/zine/todo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: next }) }).then((r) => { if (!r.ok) setErr("Couldn't save the tick."); }).catch(() => setErr("Couldn't save the tick.")); };
  const groups = items ? [...new Set(items.map((i) => i.group))] : [];
  const left = items?.filter((i) => !i.done).length ?? 0;
  return (
    <aside className="zlib ztodo" aria-label="What is left">
      <div className="zlibtop"><span className="eyebrow">What is left</span><span className="thint">{items ? `${left} of ${items.length} open` : err ? "" : "Loading…"}</span></div>
      {err && <p className="thint">{err}</p>}
      {items && <label className="zchk"><input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} /> Hide done</label>}
      <div className="ztodolist">
        {groups.map((g) => (
          <div key={g} className="ztodogroup">
            <span className="eyebrow">{g}</span>
            {items!.filter((i) => i.group === g && !(hide && i.done)).map((i) => (
              <label key={i.id} className={`zchk${i.done ? " done" : ""}`}>
                <input type="checkbox" checked={!!i.done} onChange={(e) => store(items!.map((x) => (x.id === i.id ? { ...x, done: e.target.checked } : x)))} />
                <span>{i.page ? <b>p{i.page} </b> : null}{i.text}</span>
              </label>
            ))}
          </div>
        ))}
      </div>
      {items && (
        <form className="ztodoadd" onSubmit={(e) => { e.preventDefault(); const t = draft.trim(); if (!t) return; store([...items, { id: uid(), text: t, group: "Added by Rhea" }]); setDraft(""); }}>
          <input type="search" value={draft} placeholder="Add something…" onChange={(e) => setDraft(e.target.value)} />
        </form>
      )}
    </aside>
  );
}
/** What a reader has done to each map so far. Kept by the book, because a page can be drawn in several slices at once. */
type MapS = { view?: string; tint?: boolean; anchors?: Record<string, { x: number; y: number }> };
/** The sticky notes for the live word cloud, handed down from the page. */
export type CloudData = { notes: CloudNote[]; domains: { id: string; name: string }[] };
const CloudCtx = createContext<CloudData | null>(null);
function CloudBox({ it }: { it: ZineItem }) {
  const data = useContext(CloudCtx);
  return (
    <div className="zcloud">
      {data && <div className="zcloudlive" onPointerDown={(e) => e.stopPropagation()}><WordCloud notes={data.notes} domains={data.domains} compact /></div>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {it.src && <img className={`zcloudprint${data ? "" : " only"}`} src={it.src} alt="Word cloud of the sticky notes" draggable={false} />}
    </div>
  );
}
const MapCtx = createContext<[Record<string, MapS>, React.Dispatch<React.SetStateAction<Record<string, MapS>>>] | null>(null);
const MAPVIEWS: [string, string][] = [["rug", "On the rug"], ["none", "No groups"], ["meaning", "By meaning"], ["pull", "Pulled by the words"]];
/** A steady pseudo-random number between -1 and 1 for a note, so the same note always gets the same nudge. */
const nudge = (id: string, salt: number) => { let h = salt * 374761393; for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 2654435761); return (((h >>> 0) % 2000) / 1000) - 1; };
/** Every sticky note in one box. Readers switch between where the notes lay on the rug, no groups at all, a map where notes that mean
    similar things sit together (with each domain's name plotted on it), and a view where each note is pulled towards the domain names it
    is closest to in meaning; there the names can be dragged. Pressing a note opens it. */
function ZMap({ it }: { it: ZineItem }) {
  const ctx = useContext(MapCtx); const [own, setOwn] = useState<MapS>({});
  const st: MapS = ctx ? ctx[0][it.id] ?? {} : own;
  const put = (p: MapS) => (ctx ? ctx[1]((m) => ({ ...m, [it.id]: { ...m[it.id], ...p } })) : setOwn((m) => ({ ...m, ...p })));
  const view = st.view ?? "rug", words = it.words ?? [], notes = it.notes ?? [];
  const ring = useMemo(() => Object.fromEntries(words.map((w, k) => { const a = (k / words.length) * 2 * Math.PI - Math.PI / 2; return [w.id, { x: 0.5 + 0.39 * Math.cos(a), y: 0.55 + 0.37 * Math.sin(a) }]; })), [words]);
  const anchors: Record<string, { x: number; y: number }> = { ...ring, ...st.anchors };
  const rank = useMemo(() => { const o = notes.map((n) => n.id).sort((a, b) => nudge(a, 3) - nudge(b, 3)); return Object.fromEntries(o.map((id, k) => [id, k])); }, [notes]);
  const mx = (v: number) => 0.06 + v * 0.88, my = (v: number) => 0.13 + v * 0.82;
  const place = (n: NonNullable<ZineItem["notes"]>[number]) => {
    if (view === "rug") return { x: n.x, y: n.y, w: n.w, rot: n.rot, z: n.z };
    const tilt = nudge(n.id, 5) * 8, z = 1 + Math.round((nudge(n.id, 7) + 1) * 9), w = 0.047;
    if (view === "none") { const k = rank[n.id] ?? 0, cols = 15, rows = Math.ceil(notes.length / cols); return { x: 0.05 + (k % cols) * (0.9 / (cols - 1)), y: 0.14 + Math.floor(k / cols) * (0.8 / Math.max(1, rows - 1)), w, rot: tilt * 0.6, z: 1 }; }
    if (view === "meaning" && n.m) return { x: mx(n.m[0]), y: my(n.m[1]), w, rot: tilt, z };
    if (view === "pull" && n.sim) {
      const e = n.sim.map((v) => Math.exp(v / 0.045)), sum = e.reduce((a, b) => a + b, 0);   // a note is pulled hardest by the name it is closest to in meaning
      let x = 0, y = 0; words.forEach((d, k) => { x += (e[k] / sum) * anchors[d.id].x; y += (e[k] / sum) * anchors[d.id].y; });
      return { x: x + nudge(n.id, 1) * 0.014, y: y + nudge(n.id, 2) * 0.014, w, rot: tilt, z };
    }
    return { x: 0.5, y: 0.97, w, rot: 0, z: 0 };
  };
  const drag = useRef<{ id: string; box: DOMRect } | null>(null);
  const down = (e: React.PointerEvent<HTMLElement>, id: string) => {
    if (view !== "pull") return;
    const box = e.currentTarget.parentElement?.getBoundingClientRect(); if (!box) return;
    e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); drag.current = { id, box };
  };
  const moveWord = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current; if (!d) return;
    const x = Math.min(0.96, Math.max(0.04, (e.clientX - d.box.left) / d.box.width)), y = Math.min(0.97, Math.max(0.12, (e.clientY - d.box.top) / d.box.height));
    put({ anchors: { ...st.anchors, [d.id]: { x, y } } });
  };
  const tint = Object.fromEntries(words.map((w) => [w.id, w.tint]));
  /* Pairs of domains, for the pulled view: a note counts towards the pair made of the two names it is closest to in meaning. Each pair with
     enough notes gets a curve from one name to the other, bent so its middle passes through the middle of that pair's notes; thicker = more notes. */
  const pairs = useMemo(() => {
    const m = new Map<string, { a: number; b: number; ids: number[] }>();
    notes.forEach((n, k) => { if (!n.sim) return; const o = n.sim.map((v, i) => [v, i] as const).sort((p, q) => q[0] - p[0]); const a = Math.min(o[0][1], o[1][1]), b = Math.max(o[0][1], o[1][1]), key = `${a}-${b}`; if (!m.has(key)) m.set(key, { a, b, ids: [] }); m.get(key)!.ids.push(k); });
    return [...m.values()].filter((p) => p.ids.length >= 5);
  }, [notes]);
  const curves = view !== "pull" ? [] : pairs.map((p) => {
    const A = anchors[words[p.a].id], B = anchors[words[p.b].id]; let cx = 0, cy = 0;
    p.ids.forEach((k) => { const q = place(notes[k]); cx += q.x; cy += q.y; }); cx /= p.ids.length; cy /= p.ids.length;
    return { key: `${p.a}-${p.b}`, n: p.ids.length, A, B, qx: 2 * cx - (A.x + B.x) / 2, qy: 2 * cy - (A.y + B.y) / 2, ca: words[p.a].tint, cb: words[p.b].tint, label: `${words[p.a].name} + ${words[p.b].name}: ${p.ids.length} notes` };
  });
  return (
    <div className="zmap" data-view={view}>
      <div className="zmviews">
        {MAPVIEWS.map(([id, label]) => <button key={id} type="button" aria-pressed={view === id} onClick={(e) => { e.stopPropagation(); put({ view: id }); }}>{label}</button>)}
      </div>
      {curves.length > 0 && (
        <svg className="zmcurves" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
          <defs>{curves.map((c) => <linearGradient key={c.key} id={`zmc-${it.id}-${c.key}`} gradientUnits="userSpaceOnUse" x1={c.A.x} y1={c.A.y} x2={c.B.x} y2={c.B.y}><stop offset="0" stopColor={c.ca} /><stop offset="1" stopColor={c.cb} /></linearGradient>)}</defs>
          {curves.map((c) => <path key={c.key} d={`M${c.A.x} ${c.A.y} Q${c.qx} ${c.qy} ${c.B.x} ${c.B.y}`} fill="none" stroke={`url(#zmc-${it.id}-${c.key})`} strokeWidth={Math.min(9, 1 + c.n * 0.45)} strokeLinecap="round" vectorEffect="non-scaling-stroke"><title>{c.label}</title></path>)}
        </svg>
      )}
      {words.map((w) => view === "rug"
        // eslint-disable-next-line @next/next/no-img-element
        ? <img key={w.id} className="zpcard" src={w.src} alt={w.name} draggable={false} style={spot({ x: w.x, y: w.y, w: w.w, rot: 0 }, 0)} />
        : view === "none" ? null
        : <span key={w.id} className={`zmword${view === "pull" ? " grab" : ""}`} style={{ left: `${(view === "meaning" ? mx(w.m[0]) : anchors[w.id].x) * 100}%`, top: `${(view === "meaning" ? my(w.m[1]) : anchors[w.id].y) * 100}%`, color: w.tint }}
            onPointerDown={(e) => down(e, w.id)} onPointerMove={moveWord} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onClick={(e) => e.stopPropagation()}>{w.name}</span>)}
      {/* On the rug each note is its picture; in the other views it is a dot in its pile's colour, so the shape of the groups is easy to see. Pressing either opens the note. */}
      {notes.map((n, k) => { const p = place(n), rug = view === "rug"; return (
        <span key={n.id} className={`zsticky zmnote${rug ? "" : " dot"}`} data-sticky={k} role="img" aria-label={`Sticky note: ${n.text}`} style={{ ...spot(rug ? p : { ...p, w: 0.026, rot: 0 }, p.z), background: rug ? undefined : tint[n.dom ?? ""] ?? "#2b2755" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {rug && <img src={n.src} alt="" loading="lazy" draggable={false} />}
        </span>); })}
    </div>
  );
}
/** A stack of photos that takes turns, like thumbing a flipbook. Holds still for people who ask for less motion. */
/** Flipbooks keep time together in 6/8: one eighth note is EIGHTH ms (a bar is six of them).
    A flipbook with beat n turns every n eighths, so on a page the first turns on every eighth, the second every other eighth, and so on up to a full bar. */
const EIGHTH = 500;
function Flip({ srcs, beat }: { srcs: string[]; beat?: number }) {
  const n = Math.min(6, Math.max(1, Math.round(beat ?? 1)));
  const at = () => Math.floor(Date.now() / EIGHTH / n) % Math.max(1, srcs.length);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (srcs.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setI(at());
    let iv: ReturnType<typeof setInterval> | undefined;
    const t0 = setTimeout(() => { setI(at()); iv = setInterval(() => setI(at()), EIGHTH); }, EIGHTH - (Date.now() % EIGHTH));   // start on the next eighth, in step with every other flipbook
    return () => { clearTimeout(t0); if (iv) clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcs.length, n]);
  // eslint-disable-next-line @next/next/no-img-element
  // only the frame on show and the next one are loaded, so a page with many flipbooks opens quickly
  const cur = i % Math.max(1, srcs.length), nxt = (cur + 1) % Math.max(1, srcs.length);
  return <>{srcs.map((s, k) => (k === cur || k === nxt) ? <img key={k} src={s} alt="" draggable={false} decoding="async" className="zflip" style={{ opacity: k === cur ? 1 : 0 }} /> : null)}</>;
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
  if (it.type === "cloud") return <CloudBox it={it} />;
  if (it.type === "flip") return <Flip srcs={it.srcs ?? []} beat={it.beat} />;
  if (it.type === "orbit") return <Orbit it={it} />;
  if (it.type === "pile") return <Pile it={it} />;
  if (it.type === "map") return <ZMap it={it} />;
  if (it.type === "poem" && it.poem) return <PoemCard p={it.poem} />;
  if (it.type === "text" && it.term) {
    return (
      <div className="zterm">
        <div className="ztermbar"><i /><i /><i /><span>{it.title || "user — -zsh"}</span></div>
        <div className={`ztermtext${it.ai ? " ai-generated" : ""}`} title={it.ai ? AITIP : undefined} style={{ fontSize: `${it.size ?? 2}cqw`, textAlign: it.align }}>{it.text}</div>
      </div>
    );
  }
  if (it.type === "text" && it.win) {
    return (
      <div className="zwin">
        <div className="zwinbar"><span>{it.title || "Overheard"}</span><i /><i /><i /></div>
        <div className={`ztext${it.ai ? " ai-generated" : ""}`} title={it.ai ? AITIP : undefined} style={{ fontFamily: stack(it.font), fontSize: `${it.size ?? 4}cqw`, color: it.color, fontWeight: it.bold ? 700 : 400, fontStyle: it.italic ? "italic" : "normal", textAlign: it.align }}>{it.text}</div>
      </div>
    );
  }
  if (it.type === "image") {
    const c = it.crop, blend = it.blend ? { mixBlendMode: "multiply" as const } : undefined;
    if (c && (c.l || c.t || c.r || c.b)) {
      const kw = 1 - c.l - c.r, kh = 1 - c.t - c.b;
      // eslint-disable-next-line @next/next/no-img-element
      return <div className="zcrop" style={blend}><img src={it.src} alt="" draggable={false} style={{ position: "absolute", width: `${100 / kw}%`, height: `${100 / kh}%`, left: `${(-c.l / kw) * 100}%`, top: `${(-c.t / kh) * 100}%` }} /></div>;
    }
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={it.src} alt="" draggable={false} decoding="async" style={blend} />;
  }
  const body = <div className={`ztext${it.ai ? " ai-generated" : ""}`} title={it.ai ? AITIP : undefined} style={{ fontFamily: stack(it.font), fontSize: `${it.size ?? 4}cqw`, color: it.color, fontWeight: it.bold ? 700 : 400, fontStyle: it.italic ? "italic" : "normal", textAlign: it.align, letterSpacing: it.track ? `${it.track}em` : undefined, wordSpacing: it.gap ? `${it.gap}em` : undefined, ...(it.fill ? { background: it.fill, padding: "0.35em 0.55em", boxSizing: "border-box", height: "100%" } : {}) }}>{it.text}{it.link && <span className="zlinkmark"> ↗</span>}</div>;
  return it.link ? <a className="zlink" href={it.link} target="_blank" rel="noopener noreferrer">{body}</a> : body;
}
/** A page as readers see it. */
/** The items of the page before that run across the fold onto this one, moved one page-width to the left. */
const spill = (prev?: ZinePage) => (prev?.items ?? []).filter((i) => i.spread && pic(i) && i.x + i.w / 2 > 100).map((i) => ({ ...i, x: i.x - 100 }));
/** The eight domains, for page tags. Colours match the wall and the map. */
const DOMS: { id: string; name: string; tint: string }[] = [
  { id: "rel", name: "Relationships", tint: "#e8457a" }, { id: "com", name: "Community", tint: "#1aa37a" }, { id: "phy", name: "Physical spaces", tint: "#7a9a1f" },
  { id: "pol", name: "Policy", tint: "#d43b3b" }, { id: "cul", name: "Culture & art", tint: "#8b5cf6" }, { id: "sch", name: "School", tint: "#2f8fd8" },
  { id: "wor", name: "Work", tint: "#f08a24" }, { id: "tec", name: "Tech", tint: "#111111" },
];
const PageView = memo(function PageView({ page, ratio, prev }: { page?: ZinePage; ratio: number; prev?: ZinePage }) {
  if (!page) return <div className="zpage blank" />;
  return (
    <div className="zpage" style={pageBg(page)}>
      {spill(prev).map((it) => <div key={`s-${it.id}`} className={`zitem ${it.type}`} style={itemStyle(it, ratio)}><ItemBody it={it} /></div>)}
      {page.items.map((it) => <div key={it.id} className={`zitem ${it.type}`} data-zid={it.id} style={itemStyle(it, ratio)}><ItemBody it={it} /></div>)}
      {!!page.tags?.length && <div className="ztags">{DOMS.filter((d) => page.tags!.includes(d.id)).map((d) => <span key={d.id} style={{ ["--t" as string]: d.tint }}>{d.name}</span>)}</div>}
    </div>
  );
});

export function Zine({ initial, canSave, gated, cloud }: { initial: ZineDoc; canSave: boolean; gated?: boolean; cloud?: CloudData }) {
  const [doc, setDoc] = useState<ZineDoc>(initial);
  const [editing, setEditing] = useState(false);
  const [canEdit, setCanEdit] = useState(canSave);
  const [print, setPrint] = useState(false);
  useEffect(() => { const q = new URLSearchParams(window.location.search); if (q.has("edit")) { setCanEdit(true); setEditing(true); } if (q.has("print")) setPrint(true); }, []);
  if (print) return <CloudCtx.Provider value={cloud ?? null}><PrintView doc={doc} /></CloudCtx.Provider>;
  return (
    <CloudCtx.Provider value={cloud ?? null}>
      {editing
        ? <Editor doc={doc} setDoc={setDoc} done={() => setEditing(false)} />
        : <Book doc={doc} gated={gated} onEdit={canEdit ? () => setEditing(true) : undefined} />}
    </CloudCtx.Provider>
  );
}

/** Every page in order, one per sheet, for printing a booklet (5.5 × 8.5 in, the zine's own shape). Open /zine?print=1. */
function PrintView({ doc }: { doc: ZineDoc }) {
  return (
    <div className="zprintview" data-paper={doc.paper?.texture ?? "grain"}>
      <div className="zprintbar"><button type="button" className="btn" onClick={() => window.print()}>Print / save as PDF</button><span className="thint">One page per sheet, 5.5 × 8.5 in. In the print dialog choose “Save as PDF” for a file, or print double-sided and fold.</span></div>
      {doc.pages.map((p, i) => <div key={p.id} className="zprintpage" style={{ ["--ratio" as string]: doc.ratio }}><PageView page={p} prev={doc.pages[i - 1]} ratio={doc.ratio} /></div>)}
    </div>
  );
}

/* ---------- Reading: the zine as one folded strip ----------
   The pages behave like an accordion-folded sheet that was never pressed flat (like M.J.'s zine in the craft scans):
   every page leans a few degrees, alternately, so the fold inside a spread sinks in (valley) and the fold between one
   spread and the next stands up (ridge). Closed, the cover lies flat in the middle. Each press pulls the strip one page
   to the left like a conveyor: the page leaving on the left swings shut behind its crease while the next page swings
   open from behind the crease on the right. Previous runs the same motion backwards. */
type Panel = { page: number; a: number; bend?: number };   // bend: how loosely the crease on this page's left curves   // a: angle about the page's left edge, degrees; + means the right edge leans away

const TILT = 0;   // pages lie flat while you read; they only fold while a page is turning
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
    // one page at a time: the two pages meet in a sharp, acute fold mid-turn (each swings past 45° before settling)
    const r = (p: number) => (p === 0 || p === n - 1 ? 0 : rest(p) * 0.5), sharp = 32 * Math.sin(Math.PI * t);
    return [{ page: s, a: r(s) * (1 - t) - 90 * t - sharp }, { page: s + 1, a: 90 * (1 - t) + r(s + 1) * t + sharp, bend: BEND * 0.6 }];
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

function Book({ doc, onEdit, gated }: { doc: ZineDoc; onEdit?: () => void; gated?: boolean }) {
  const n = doc.pages.length;
  const [story, setStory] = useState(false);
  const [at, setAt] = useState<{ from: number; to: number } | null>(null);   // the passage of the whole story the reader came from
  const markRef = useRef<HTMLElement>(null);
  /** Where a page's text box sits inside the whole story, if it is a piece of it. */
  const findInStory = (text?: string) => { const t = (text ?? "").trim(), st = doc.story?.text ?? ""; if (t.length < 40) return null; const i = st.indexOf(t); return i < 0 ? null : { from: i, to: i + t.length }; };
  const pieces = useMemo(() => new Set(doc.pages.flatMap((p) => p.items.filter((i) => i.type === "text" && findInStory(i.text)).map((i) => i.id))), [doc]); // eslint-disable-line react-hooks/exhaustive-deps
  const [note, setNote] = useState<{ src: string; text: string; domain: string } | null>(null);
  const maps = useState<Record<string, MapS>>({});
  const noteDlg = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = noteDlg.current; if (!d) return; if (note && !d.open) d.showModal(); if (!note && d.open) d.close(); }, [note]);
  const openFrom = (e: React.MouseEvent) => {
    const st = (e.target as HTMLElement).closest<HTMLElement>("[data-sticky]");
    if (st) {
      const zid = st.closest<HTMLElement>("[data-zid]")?.dataset.zid, pile = doc.pages.flatMap((p) => p.items).find((i) => i.id === zid), n = pile?.notes?.[Number(st.dataset.sticky)];
      if (n) setNote({ src: n.src, text: n.text, domain: (n.dom && pile?.words?.find((w) => w.id === n.dom)?.name) || (pile?.title ?? "") });
      return;
    }
    const id = (e.target as HTMLElement).closest<HTMLElement>("[data-zid]")?.dataset.zid; if (!id || !pieces.has(id)) return;
    const it = doc.pages.flatMap((p) => p.items).find((i) => i.id === id); const hit = findInStory(it?.text); if (!hit) return;
    setAt(hit); setStory(true);
  };
  useEffect(() => { if (story && at) requestAnimationFrame(() => markRef.current?.scrollIntoView({ block: "start" })); }, [story, at]);
  const [inside, setInside] = useState(!gated);     // has this browser logged in to the rest of the site?
  const storyDlg = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (gated) setInside(document.cookie.split("; ").includes("rithm_in=1")); }, [gated]);
  useEffect(() => { const d = storyDlg.current; if (!d) return; if (story && !d.open) d.showModal(); if (!story && d.open) d.close(); }, [story]);
  const [s, setS] = useState(0);                    // 0 = cover alone; k = pages k-1 | k; n = last page alone
  const [move, setMove] = useState<{ from: number; t: number; dir: 1 | -1 } | null>(null);
  const [narrow, setNarrow] = useState(false);       // a phone or a portrait window: always one page at a time
  const [onePage, setOnePage] = useState(false);     // the reader chose one page at a time on a wide screen
  const single = narrow || onePage;
  const raf = useRef(0);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 700px), (orientation: portrait)"); const f = () => setNarrow(mq.matches);
    f(); mq.addEventListener("change", f); return () => mq.removeEventListener("change", f);
  }, []);
  useEffect(() => { try { setOnePage(localStorage.getItem("zine-view") === "one"); } catch { /* storage blocked: start with spreads */ } }, []);
  /** Switch between spreads and one page at a time, keeping the reader on the same page. In spreads, s = k shows pages k-1 | k. */
  const toggleView = () => {
    if (move || narrow) return;
    const next = !onePage;
    setS((cur) => (next ? Math.max(0, Math.min(n - 1, cur === 0 ? 0 : cur - 1)) : cur === 0 ? 0 : Math.min(n, cur + 1)));
    setOnePage(next);
    try { localStorage.setItem("zine-view", next ? "one" : "spread"); } catch { /* fine */ }
  };
  // full screen: the browser's own full-screen mode, where the browser supports it (not iPhone Safari)
  const [fs, setFs] = useState(false), [canFs, setCanFs] = useState(false);
  useEffect(() => {
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    setCanFs(!!(el.requestFullscreen || el.webkitRequestFullscreen));
    const f = () => setFs(!!(document.fullscreenElement || (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement));
    document.addEventListener("fullscreenchange", f); document.addEventListener("webkitfullscreenchange", f);
    return () => { document.removeEventListener("fullscreenchange", f); document.removeEventListener("webkitfullscreenchange", f); };
  }, []);
  const toggleFs = () => {
    const d = document as Document & { webkitExitFullscreen?: () => void }, el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    try { if (fs) { if (d.exitFullscreen) void d.exitFullscreen(); else d.webkitExitFullscreen?.(); } else if (el.requestFullscreen) void el.requestFullscreen(); else el.webkitRequestFullscreen?.(); } catch { /* the browser said no */ }
  };
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
    const k = (e: KeyboardEvent) => {
      if (story || note) return;
      if (e.key === "ArrowRight") step(1); if (e.key === "ArrowLeft") step(-1);
      if (e.metaKey || e.ctrlKey) return;                               // leave the browser's own zoom keys alone
      if (e.key === "+" || e.key === "=") zoomAt(zoom * 1.4); if (e.key === "-") zoomAt(zoom / 1.4); if (e.key === "0") fit();
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  });

  // zoom + pan, to explore a page up close; "Fit" puts the zine back, centred and fully seen
  const ZMAX = 5;
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const areaRef = useRef<HTMLDivElement>(null);
  const grab = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null);
  const swallowClick = useRef(false);
  const fit = () => { setZoom(1); setPan({ x: 0, y: 0 }); };
  // the zoom bar sits on the right; drag its handle to move it anywhere (double-click the handle to put it back)
  const [zbar, setZbar] = useState<{ x: number; y: number } | null>(null);
  const zdrag = useRef<{ dx: number; dy: number } | null>(null);
  useEffect(() => { try { const v = JSON.parse(localStorage.getItem("zine-zoombar") ?? "null"); if (v && typeof v.x === "number") setZbar(v); } catch { /* fine */ } }, []);
  const zbarDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    const bar = e.currentTarget.parentElement; if (!bar) return;
    const r = bar.getBoundingClientRect(); zdrag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const zbarMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = zdrag.current, bar = e.currentTarget.parentElement; if (!d || !bar) return;
    const r = bar.getBoundingClientRect();
    setZbar({ x: Math.max(4, Math.min(window.innerWidth - r.width - 4, e.clientX - d.dx)), y: Math.max(4, Math.min(window.innerHeight - r.height - 4, e.clientY - d.dy)) });
  };
  const zbarUp = () => { zdrag.current = null; setZbar((p) => { try { localStorage.setItem("zine-zoombar", JSON.stringify(p)); } catch { /* fine */ } return p; }); };
  const zbarReset = () => { setZbar(null); try { localStorage.removeItem("zine-zoombar"); } catch { /* fine */ } };
  /** Zoom to z, keeping the point under (cx, cy) on screen where it is; no point = the middle of what is shown. */
  const zoomAt = (z: number, cx?: number, cy?: number) => {
    const el = areaRef.current; if (!el) return;
    const nz = Math.min(ZMAX, Math.max(1, z));
    if (nz <= 1.001) { fit(); return; }
    const r = el.getBoundingClientRect(), bx = r.left - pan.x, by = r.top - pan.y;
    const vx = (cx ?? window.innerWidth / 2) - bx, vy = (cy ?? window.innerHeight / 2) - by;
    setPan({ x: vx - (vx - pan.x) * (nz / zoom), y: vy - (vy - pan.y) * (nz / zoom) });
    setZoom(nz);
  };
  useEffect(() => {
    const el = areaRef.current; if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomAt(zoom * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY); }   // trackpad pinch, or ⌘/ctrl + scroll
      else if (zoom > 1) { e.preventDefault(); setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY })); }
    };
    el.addEventListener("wheel", wheel, { passive: false }); return () => el.removeEventListener("wheel", wheel);
  });
  const onDown = (e: React.PointerEvent) => {
    if (zoom <= 1 || (e.target as HTMLElement).closest("button")) return;
    grab.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, moved: false };
  };
  const onMoveP = (e: React.PointerEvent) => {
    const g = grab.current; if (!g) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (!g.moved && Math.hypot(dx, dy) < 4) return;
    if (!g.moved) { g.moved = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }
    setPan({ x: g.px + dx, y: g.py + dy });
  };
  const onUp = () => { if (grab.current?.moved) swallowClick.current = true; grab.current = null; };

  const panels = move ? between(n, move.from, move.t, single) : layout(n, s, single);
  const { total, items } = slices(panels);
  return (
    <section className="zinefull" data-paper={doc.paper?.texture ?? "grain"} aria-label="The zine" aria-roledescription="book">
      {inside ? <a className="zcorner home" href="/" aria-label="Back to the site">×</a> : <a className="zcorner home login" href="/login">Network log in</a>}
      {onEdit && <button type="button" className="zcorner edit" onClick={onEdit}>Edit</button>}
      {!narrow && <button type="button" className={`zcorner view${onEdit ? "" : " solo"}`} aria-pressed={onePage} onClick={toggleView} title={onePage ? "Show two pages side by side" : "Show one page at a time, as big as the screen allows"}>{onePage ? "Two pages" : "One page"}</button>}
      {canFs && <div className={`zfs${fs ? " on" : ""}`}><button type="button" className="zfsbtn" onClick={toggleFs}>{fs ? "Exit full screen" : "Full screen"}</button>{!fs && <span>We recommend reading in full screen</span>}</div>}
      <dialog className="notedlg" ref={noteDlg} onClose={() => setNote(null)} onClick={(e) => { if (e.target === noteDlg.current) setNote(null); }}>
        {note && (
          <div className="notebody">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={note.src} alt="" />
            <div className="noteinfo">
              <span className="eyebrow">{note.domain}</span>
              <blockquote>“{note.text}”</blockquote>
              <button type="button" className="btn ghost" onClick={() => setNote(null)}>Close</button>
            </div>
          </div>
        )}
      </dialog>
      <dialog className="storydlg" ref={storyDlg} onClose={() => setStory(false)} onClick={(e) => { if (e.target === storyDlg.current) setStory(false); }}>
        {doc.story?.text && (
          <div className="storybody">
            <div className="zwinbar"><span>{doc.story.title || "The whole story"}</span><button type="button" onClick={() => setStory(false)} aria-label="Close">×</button></div>
            <div className="storytext">{at ? <>{doc.story.text.slice(0, at.from)}<mark ref={markRef}>{doc.story.text.slice(at.from, at.to)}</mark>{doc.story.text.slice(at.to)}</> : doc.story.text}</div>
          </div>
        )}
      </dialog>
      <div className={`zzoom${zbar ? " moved" : ""}`} role="group" aria-label="Zoom" style={zbar ? { left: zbar.x, top: zbar.y } : undefined}>
        <button type="button" className="zgrip" aria-label="Move the zoom controls" title="Drag to move · double-click to put back" onPointerDown={zbarDown} onPointerMove={zbarMove} onPointerUp={zbarUp} onPointerCancel={zbarUp} onDoubleClick={zbarReset}>⋮⋮</button>
        {zoom > 1 && <button type="button" onClick={() => step(-1)} disabled={s === 0 || !!move} aria-label="Previous page">‹</button>}
        <button type="button" onClick={() => zoomAt(zoom / 1.4)} disabled={zoom <= 1} aria-label="Zoom out">−</button>
        <span aria-live="polite">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => zoomAt(zoom * 1.4)} disabled={zoom >= ZMAX} aria-label="Zoom in">+</button>
        <button type="button" className="fit" onClick={fit} disabled={zoom === 1 && pan.x === 0 && pan.y === 0} title="Back to centred, whole pages (key 0)">Fit</button>
        {zoom > 1 && <button type="button" onClick={() => step(1)} disabled={s === last || !!move} aria-label="Next page">›</button>}
      </div>
      <div ref={areaRef} className={`zarea${single ? " single" : ""}${zoom > 1 ? " zoomed" : ""}`}
        style={{ ["--ratio" as string]: doc.ratio, ["--span" as string]: total, transform: zoom > 1 || pan.x || pan.y ? `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` : undefined, transformOrigin: "0 0" }}
        onPointerDown={onDown} onPointerMove={onMoveP} onPointerUp={onUp} onPointerCancel={onUp}
        onClickCapture={(e) => { if (swallowClick.current) { swallowClick.current = false; e.stopPropagation(); e.preventDefault(); } }}>
        <div className="zground" />
        <MapCtx.Provider value={maps}><div className="strip" onClick={openFrom}>
          {pieces.size > 0 && <style>{[...pieces].map((id) => `.zinefull [data-zid="${id}"]{cursor:pointer}.zinefull [data-zid="${id}"] .zwinbar span::after{content:"  ·  part of the whole story ↗";font-weight:400;opacity:.8}`).join("")}</style>}
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
                <div className="sheet" style={{ left: `calc(var(--pw) * ${-p.v0})` }}><PageView page={doc.pages[p.page]} prev={doc.pages[p.page - 1]} ratio={doc.ratio} /></div>
              </div>
            );
          })}
        </div></MapCtx.Provider>
        <button type="button" className="turn prev" onClick={() => step(-1)} disabled={s === 0 || !!move} aria-label="Previous page">‹</button>
        <button type="button" className="turn next" onClick={() => step(1)} disabled={s === last || !!move} aria-label="Next page">›</button>
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
  const [lib, setLib] = useState(false);
  const [libBig, setLibBig] = useState(true);       // wide photo library with large, uncropped thumbnails            // the photo library panel beside the page
  const [qbank, setQbank] = useState(false);
  const [todo, setTodo] = useState(true);           // the checklist of what is left, on the left of the page        // the quote bank panel beside the page
  const [bank, setBank] = useState<QuoteBank | null>(null);
  const [bankErr, setBankErr] = useState("");
  useEffect(() => {
    if (!qbank || bank) return;
    fetch("/api/zine/quotes").then((r) => r.json()).then((j) => { if (j?.quotes) setBank(j as QuoteBank); else setBankErr(j?.reason === "read-only" ? "The quote bank only works while the site runs on your computer (npm run dev)." : j?.reason ?? "Couldn't load the quote bank."); }).catch(() => setBankErr("Couldn't load the quote bank."));
  }, [qbank, bank]);
  const clipItems = useRef<ZineItem[]>([]);         // what ⌘C or ⌘X last picked up, so it can be pasted on any page
  const [checking, setChecking] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false); // the box for editing the whole story (the pop-up readers open)
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
  /** A picture that fills the whole page, placed behind everything and pinned. It is an ordinary item, so it can be unpinned, moved, or brought in front of other things. */
  const addBackground = async (src: string) => {
    const dim = await measure(src), k = Math.max(100 / dim.w, H / dim.h), id = uid();
    keep(); setPage((p) => ({ ...p, items: [...p.items, { id, type: "image", src, x: 50, y: r2(H / 2), w: r2(dim.w * k), h: r2(dim.h * k), rot: 0, z: Math.min(0, ...p.items.map((i) => i.z)) - 1, lock: true }] }));
    setSel([id]);
  };
  /** Move the selected item one layer up or down: it swaps places with the item just above or just below it. */
  const layer = (dir: 1 | -1) => {
    if (!cur) return;
    const order = [...page.items].sort((a, b) => a.z - b.z || page.items.indexOf(a) - page.items.indexOf(b));
    const i = order.findIndex((x) => x.id === cur.id), j = i + dir; if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    const z = Object.fromEntries(order.map((x, k) => [x.id, k + 1]));
    keep(); setPage((p) => ({ ...p, items: p.items.map((it) => ({ ...it, z: z[it.id] })) }));
  };
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
  /** Puts a quote on the page as a window box, word for word, with where it came from in the title bar. */
  const addQuote = (q: BankQuote, at?: { x: number; y: number }) => {
    const w = 72, size = 2.6, lines = q.t.split("\n").reduce((n, l) => n + Math.max(1, Math.ceil(l.length / 50)), 0);
    add({ type: "text", win: true, title: q.src.replace(/ \(.*\)$/, ""), w, h: r2(lines * size * 1.18 + 8), text: q.t, font: "Arial", size, color: "#2b2755", bold: false, italic: false, align: "left" }, at);
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
      if (files.length) { e.preventDefault(); files.forEach((f) => void addImage(f)); return; }
      if (typing || (e.target as HTMLElement)?.closest("input,select,textarea") || !clipItems.current.length) return;
      e.preventDefault(); keep();
      const fresh = clipItems.current.map((it, k) => ({ ...it, id: uid(), z: topZ() + k, lock: false }));
      setPage((p) => ({ ...p, items: [...p.items, ...fresh] })); setSel(fresh.map((f) => f.id)); setMsg(`Pasted ${fresh.length} item${fresh.length > 1 ? "s" : ""} onto page ${cp + 1}.`);
    };
    const onKey = (e: KeyboardEvent) => {
      if (typing || (e.target as HTMLElement)?.closest("input,select,textarea")) return;
      const mod = e.metaKey || e.ctrlKey, key = e.key.toLowerCase();
      if (mod && key === "z") { e.preventDefault(); undo(); return; }
      if (mod && (key === "c" || key === "x") && picked.length) {
        e.preventDefault(); clipItems.current = picked.map((i) => ({ ...i }));
        if (key === "x") remove();
        setMsg(`${key === "x" ? "Cut" : "Copied"} ${picked.length} item${picked.length > 1 ? "s" : ""}. Go to any page and press ⌘V.`); return;
      }
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
    <section className="zine editing" data-paper={doc.paper?.texture ?? "grain"} aria-label="Zine editor">
      <div className="ztools" role="toolbar" aria-label="Zine tools">
        <div className="tgroup">
          <span className="eyebrow">Page {cp + 1} of {n}</span>
          <button type="button" className="btn ghost" onClick={() => go(cp - 1)} disabled={cp === 0} aria-label="Previous page">←</button>
          <button type="button" className="btn ghost" onClick={() => go(cp + 1)} disabled={cp === n - 1} aria-label="Next page">→</button>
          <button type="button" className="btn ghost" onClick={() => { keep(); setDoc((d) => { const p = [...d.pages]; p.splice(cp + 1, 0, { id: `p${uid()}`, bg: d.paper?.color ?? "#f8f3ea", items: [] }); return { ...d, pages: p }; }); go(cp + 1); }}>Add page</button>
          <button type="button" className="btn ghost" onClick={() => movePage(cp - 1)} disabled={cp === 0}>Move earlier</button>
          <button type="button" className="btn ghost" onClick={() => movePage(cp + 1)} disabled={cp === n - 1}>Move later</button>
          <button type="button" className="btn ghost" disabled={n < 2} title="Removes this page and everything on it. ⌘Z brings it back." onClick={() => { keep(); setDoc((d) => ({ ...d, pages: d.pages.filter((_, i) => i !== cp) })); go(cp - 1); }}>Delete page</button>
          <label className="swatch">Colour <input type="color" value={page.bg} onChange={(e) => setPage((p) => ({ ...p, bg: e.target.value }))} /></label>
          <span className="ztagpick" role="group" aria-label="Domains this page touches">{DOMS.map((d) => { const on = !!page.tags?.includes(d.id); return <button key={d.id} type="button" aria-pressed={on} title={`Tag this page: ${d.name}`} style={{ ["--t" as string]: d.tint }} onClick={() => setPage((p) => ({ ...p, tags: on ? (p.tags ?? []).filter((t) => t !== d.id) : [...(p.tags ?? []), d.id] }))}>{d.name.slice(0, 3)}</button>; })}</span>
          <a className="btn ghost" href="/zine?print=1" target="_blank" rel="noopener noreferrer" title="Every page, one per sheet, ready to print or save as a PDF booklet (save first)">Print booklet</a>
          <label className="btn ghost filebtn" title="A picture that fills this page, behind everything. Afterwards it is a normal picture: select it to unpin, move, or change its layer.">Background image…<input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; const src = await store(f); if (src) await addBackground(src); }} /></label>
        </div>
        <div className="tgroup">
          <span className="eyebrow">Paper for every plain page</span>
          {PAPERS.map(([c, l]) => <button key={c} type="button" className="btn ghost" aria-pressed={(doc.paper?.color ?? "#f8f3ea") === c} title={c}
            onClick={() => { keep(); setDoc((d) => ({ ...d, paper: { ...d.paper, color: c }, pages: d.pages.map((pg) => (PLAIN.includes(pg.bg.toLowerCase()) ? { ...pg, bg: c } : pg)) })); }}>
            <i className="pswatch" style={{ background: c }} />{l}</button>)}
          <select aria-label="Paper texture" value={doc.paper?.texture ?? "grain"} onChange={(e) => { keep(); setDoc((d) => ({ ...d, paper: { ...d.paper, texture: e.target.value as Paper["texture"] } })); }}>
            <option value="none">Flat colour</option><option value="grain">Paper grain</option>
          </select>
        </div>
        <div className="tgroup">
          <span className="eyebrow">Show</span>
          {[1, 2, 4].map((v) => <button key={v} type="button" className="btn ghost" aria-pressed={view === v} onClick={() => show(v)}>{v === 1 ? "1 page" : `${v} pages`}</button>)}
          <button type="button" className="btn ghost" aria-pressed={clip} onClick={() => setClip(!clip)} title="Hide whatever hangs off the edge of the page, the way readers will see it">Trim to page</button>
        </div>
        <div className="tgroup">
          <span className="eyebrow">Add</span>
          <button type="button" className="btn ghost" onClick={() => add({ type: "text", w: 60, h: 14, text: "Text", font: "Arial", size: 5, color: "#1b1037", bold: false, italic: false, align: "left" })}>Text box</button>
          <button type="button" className="btn ghost" onClick={() => add({ type: "text", win: true, title: "Overheard", w: 64, h: 30, text: "Type what was said here.", font: "Arial", size: 3.6, color: "#2b2755", bold: false, italic: false, align: "left" })}>Window box</button>
          <button type="button" className="btn ghost" title="Words circling the middle of the box. Double-click it to type, one word per line." onClick={() => add({ type: "orbit", w: 84, h: 70, text: "one\nword\nper\nline", font: "Arial", size: 4.5, color: "#2b2755", bold: true, italic: false, align: "center", speed: 26000 })}>Word orbit</button>
          <select className="btn ghost" aria-label="Add a poem" value="" title="Poems read at the retreat: the scan or screenshot when there is one, otherwise a card linking to the published poem. The list is data/poems.json." onChange={(e) => { const p = (POEMS as Poem[])[Number(e.target.value)]; if (p) add({ type: "poem", poem: p, w: p.src ? 44 : 40, h: p.src ? 66 : 20 }); }}>
            <option value="">Poem…</option>
            {(POEMS as Poem[]).map((p, k) => <option key={k} value={k}>{p.title} ({p.author})</option>)}
          </select>
          <label className="btn ghost filebtn">Flipbook…<input type="file" accept="image/*" multiple onChange={(e) => { void addFlip([...(e.target.files ?? [])]); e.target.value = ""; }} /></label>
          <label className="btn ghost filebtn">Image…<input type="file" accept="image/*" multiple onChange={(e) => { [...(e.target.files ?? [])].forEach((f) => void addImage(f)); e.target.value = ""; }} /></label>
          <button type="button" className="btn ghost" aria-pressed={todo} onClick={() => setTodo(!todo)} title="What is left to decide and to do, from the chats with Claude. Ticks save to data/zine-todo.json">To do</button>
          <button type="button" className="btn ghost" aria-pressed={lib} onClick={() => { setLib(!lib); setQbank(false); }} title="Every photo in your retreat folder, ready to drag onto the page">Photo library</button>
          <button type="button" className="btn ghost" aria-pressed={qbank} onClick={() => { setQbank(!qbank); setLib(false); }} title="Every quote that could belong on this page, word for word">Quotes for this page</button>
          <span className="thint">or paste an image (⌘V), or drop one on the page</span>
        </div>
        <div className="tgroup">
          <span className="eyebrow">{many ? `${picked.length} selected` : "Selected"}</span>
          {cur?.type === "orbit" && <Num label="Lap (ms)" value={cur.speed ?? 26000} step={1000} onChange={(v) => edit(cur.id, { speed: Math.max(4000, v) })} />}
          {(cur?.type === "text" || cur?.type === "orbit") && (
            <>
              <select aria-label="Font" value={cur.font} onChange={(e) => edit(cur.id, { font: e.target.value })}>{FONTS.map((f) => <option key={f}>{f}</option>)}</select>
              <button type="button" className="btn ghost" onClick={() => edit(cur.id, { size: r2(Math.max(1, (cur.size ?? 4) - 0.5)) })} aria-label="Smaller text">A−</button>
              <label className="zsizenum" title="Text size in points when printed (page is 5.5 in wide)"><input type="number" min={2} max={200} step={0.5} value={Math.round((cur.size ?? 4) * 3.96 * 2) / 2} onChange={(e) => { const v = parseFloat(e.target.value); if (v > 0) edit(cur.id, { size: Math.round(v / 3.96 * 1000) / 1000 }); }} /> pt</label>
              <button type="button" className="btn ghost" onClick={() => edit(cur.id, { size: r2((cur.size ?? 4) + 0.5) })} aria-label="Larger text">A+</button>
              <button type="button" className="btn ghost" aria-pressed={!!cur.bold} onClick={() => edit(cur.id, { bold: !cur.bold })}><b>B</b></button>
              <button type="button" className="btn ghost" aria-pressed={!!cur.italic} onClick={() => edit(cur.id, { italic: !cur.italic })}><i>I</i></button>
              <select aria-label="Alignment" value={cur.align} onChange={(e) => edit(cur.id, { align: e.target.value as ZineItem["align"] })}><option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option></select>
              <label className="swatch">Colour <input type="color" value={cur.color ?? "#000000"} onChange={(e) => patch(cur.id, { color: e.target.value })} /></label>
              {cur.type === "text" && <button type="button" className="btn ghost" aria-pressed={!!cur.win} onClick={() => edit(cur.id, { win: !cur.win, term: false })}>Window</button>}
              {cur.type === "text" && !cur.win && !cur.term && <button type="button" className="btn ghost" aria-pressed={!!cur.fill} title="Solid box behind the text" onClick={() => edit(cur.id, { fill: cur.fill ? undefined : "#fbf3e1" })}>Box</button>}
              {cur.type === "text" && <button type="button" className="btn ghost" aria-pressed={!!cur.term} title="Draw this text as a Mac Terminal window" onClick={() => edit(cur.id, { term: !cur.term, win: false })}>Terminal</button>}
              <button type="button" className="btn ghost" aria-pressed={!!cur.ai} title="Mark this text as written by AI: readers see a dashed underline, like the rest of the site" onClick={() => edit(cur.id, { ai: !cur.ai })}>AI-written</button>
              {cur.type === "text" && <label className="swatch">Link <input type="url" className="wintitle" value={cur.link ?? ""} placeholder="https://…" onChange={(e) => patch(cur.id, { link: e.target.value || undefined })} /></label>}
              {(cur.win || cur.term) && <label className="swatch">Title <input type="text" className="wintitle" value={cur.title ?? ""} placeholder="Overheard" onChange={(e) => patch(cur.id, { title: e.target.value })} /></label>}
            </>
          )}
          {cur?.type === "image" && (
            <>
              <button type="button" className="btn ghost" aria-pressed={!!cur.blend} title="For scans of handwriting or drawings: the white paper disappears and only the ink shows over whatever is behind. Works on light pages and photos, not on dark ones." onClick={() => edit(cur.id, { blend: !cur.blend })}>See-through paper</button>
              <span className="eyebrow">Trim %</span>
              {(["l", "t", "r", "b"] as const).map((k) => <Num key={k} label={{ l: "Left", t: "Top", r: "Right", b: "Bottom" }[k]} step={1} value={Math.round((cur.crop?.[k] ?? 0) * 100)}
                onChange={(v) => { const c = { l: 0, t: 0, r: 0, b: 0, ...cur.crop }, old = c[k]; c[k] = Math.min(0.9, Math.max(0, v / 100)); if (c.l + c.r > 0.95 || c.t + c.b > 0.95) return;
                  const horiz = k === "l" || k === "r", was = horiz ? 1 - (c.l + c.r) + (c[k] - old) : 1 - (c.t + c.b) + (c[k] - old), now = horiz ? 1 - c.l - c.r : 1 - c.t - c.b;
                  edit(cur.id, horiz ? { crop: c, w: r2((cur.w * now) / was) } : { crop: c, h: r2((cur.h * now) / was) }); }} />)}
            </>
          )}
          {cur && pic(cur) && <button type="button" className="btn ghost" aria-pressed={!!cur.spread} title="Let this picture run across the fold: the part that hangs off the right edge shows on the next page" onClick={() => edit(cur.id, { spread: !cur.spread })}>Runs onto next page</button>}
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
          <button type="button" className="btn ghost" disabled={!cur} onClick={() => layer(1)} title="In front of the next thing up">Forward one</button>
          <button type="button" className="btn ghost" disabled={!cur} onClick={() => layer(-1)} title="Behind the next thing down">Back one</button>
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
          <button type="button" className="btn ghost" aria-pressed={storyOpen} onClick={() => setStoryOpen(!storyOpen)} title="Everything written, in one piece. Readers open it as a pop-up from the zine.">Whole story…</button>
          <button type="button" className="btn ghost" aria-pressed={checking} onClick={() => setChecking(!checking)} title="Lists what is still unfinished: placeholder notes, empty pages, boxes waiting for your words">Check zine</button>
          <button type="button" className="btn" onClick={() => void save()}>Save zine</button>
          <button type="button" className="btn ghost" onClick={download}>Download file</button>
          <button type="button" className="btn ghost" onClick={undo}>Undo</button>
          <button type="button" className="btn ghost" onClick={done}>Done</button>
        </div>
        <p className="thint">Drag to move; edges snap to the page and to other items (hold Option to turn that off). Drag any corner to resize: the opposite corner stays put, and Shift squashes an image. Shift-click or drag across empty paper to select several, ⌘A for everything, ⌘Z to undo. Keys: arrows nudge, − and = shrink and grow, [ and ] rotate. Double-click a text box to type.</p>
        {checking && (() => {
          const todo = doc.pages.flatMap((pg, i) => {
            const out: string[] = [];
            if (!pg.items.length) out.push("empty page");
            for (const it of pg.items) {
              const t = `${it.title ?? ""} ${it.text ?? ""}`;
              if (it.type === "text" && /\[[^\]]{6,}\]|Rhea writes|Rhea to edit|Still to write|check me|check this|goes here/i.test(t)) out.push(`placeholder: “${(it.title || it.text || "").slice(0, 48)}”`);
              if (pic(it) && it.type === "flip" && (it.srcs?.length ?? 0) < 2) out.push("flipbook with fewer than two photos");
            }
            return out.map((o) => ({ i, o }));
          });
          return (
            <div className="zcheck">
              <span className="eyebrow">{todo.length ? `${todo.length} things left before this is finished` : "Nothing left to finish"}</span>
              <ul>{todo.map((t, k) => <li key={k}><button type="button" onClick={() => go(t.i)}>Page {t.i + 1}</button> {t.o}</li>)}</ul>
            </div>
          );
        })()}
        {storyOpen && (
          <label className="storyedit">The whole story (opens as a pop-up in the zine)
            <textarea value={doc.story?.text ?? ""} onFocus={keep} onChange={(e) => setDoc((d) => ({ ...d, story: { ...d.story, text: e.target.value } }))} />
          </label>
        )}
        <p className="tmsg" role="status">{msg}</p>
      </div>

      <div className={`zwork${lib || qbank ? " withlib" : ""}${lib && libBig ? " libwide" : ""}${todo ? " withtodo" : ""}`}>
      {todo && <Todo />}
      <div className="zcenter">
      <div className={`zspread${count > 1 ? " multi" : ""}`} style={{ ["--ratio" as string]: doc.ratio, ["--n" as string]: count }}>
        {doc.pages.slice(start, start + count).map((pg, k) => {
          const i = start + k;
          if (i !== cp) return (
            <div key={pg.id} className="zsheetwrap zother" role="button" tabIndex={0} aria-label={`Edit page ${i + 1}`} onClick={() => go(i)} onKeyDown={(e) => { if (e.key === "Enter") go(i); }}>
              <PageView page={pg} prev={doc.pages[i - 1]} ratio={doc.ratio} /><span className="zpno">Page {i + 1}</span>
            </div>
          );
          return (
            <div key={pg.id} className="zsheetwrap zactive">
              <div className="zpage zsheet" ref={sheet} style={pageBg(page)} onPointerDown={beginBox} onPointerMove={moveP} onPointerUp={endP} onPointerCancel={endP}
                onDragOver={(e) => e.preventDefault()} onDrop={(e) => {
                  e.preventDefault();
                  const qi = e.dataTransfer.getData("text/x-zine-quote");
                  if (qi && bank?.quotes[Number(qi)]) { const b = sheet.current!.getBoundingClientRect(), u = b.width / 100; addQuote(bank.quotes[Number(qi)], { x: r2((e.clientX - b.left) / u), y: r2((e.clientY - b.top) / u) }); return; }
                  const f = e.dataTransfer.getData("text/x-zine-lib");
                  if (f) { const b = sheet.current!.getBoundingClientRect(), u = b.width / 100; void addLib(f, { x: r2((e.clientX - b.left) / u), y: r2((e.clientY - b.top) / u) }); return; }
                  [...e.dataTransfer.files].filter((f) => f.type.startsWith("image/")).forEach((f) => void addImage(f)); }}>
                <div className={`zclip${clip ? " on" : ""}`}>
                  {spill(doc.pages[cp - 1]).map((it) => <div key={`s-${it.id}`} className={`zitem ${it.type} spilled`} title="This runs over from the page before. Move it there." style={itemStyle(it, doc.ratio)}><ItemBody it={it} /></div>)}
                  {page.items.map((it) => (
                    <div key={it.id} className={`zitem ${it.type}${it.lock ? " locked" : ""}${typing === it.id ? " typing" : ""}`} style={itemStyle(it, doc.ratio)}
                      onPointerDown={(e) => beginMove(e, it)} onDoubleClick={() => { if (it.type === "text" || it.type === "orbit") { keep(); setTyping(it.id); setSel([it.id]); } }}>
                      {(it.type === "text" || it.type === "orbit") && typing === it.id ? (it.win ? (
                        // a window box being typed in: its title bar is editable too
                        <div className="zwin" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setTyping(null); }}>
                          <div className="zwinbar"><input className="zwintitle" value={it.title ?? ""} placeholder="Title" aria-label="Window title" onChange={(e) => patch(it.id, { title: e.target.value })} onPointerDown={(e) => e.stopPropagation()} /><i /><i /><i /></div>
                          <textarea className="ztext" autoFocus value={it.text ?? ""} onChange={(e) => patch(it.id, { text: e.target.value })} onPointerDown={(e) => e.stopPropagation()} style={textStyle(it)} />
                        </div>
                      ) : (
                        <textarea className="ztext" autoFocus value={it.text ?? ""} onChange={(e) => patch(it.id, { text: e.target.value })} onBlur={() => setTyping(null)} onPointerDown={(e) => e.stopPropagation()} style={textStyle(it)} />
                      )) : <ItemBody it={it} />}
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
      <div className="zpagenav" role="group" aria-label="Switch page">
        <button type="button" className="btn ghost" onClick={() => go(cp - 1)} disabled={cp === 0} aria-label="Previous page">←</button>
        <span>Page {cp + 1} of {n}</span>
        <button type="button" className="btn ghost" onClick={() => go(cp + 1)} disabled={cp === n - 1} aria-label="Next page">→</button>
      </div>
      </div>
      {qbank && <Quotes bank={bank} err={bankErr} pageId={page.id} pageNo={cp + 1} onAdd={(q) => addQuote(q)} />}
      {lib && <Library onBg={(f) => void fromLib(f).then((src) => { if (src) void addBackground(src); })} onAdd={(f) => void addLib(f)} onFlip={(fs) => void flipLib(fs)} big={libBig} setBig={setLibBig}
        intoFlip={cur?.type === "flip" ? (fs) => void libSrcs(fs).then((more) => { if (more.length) edit(cur.id, { srcs: [...(cur.srcs ?? []), ...more] }); }) : undefined} />}
      </div>
    </section>
  );
}

type BankQuote = { t: string; src: string; kind: string };
type QuoteBank = { quotes: BankQuote[]; pages: Record<string, number[]> };
const KINDS: [string, string][] = [["", "All sources"], ["sticky", "Sticky notes"], ["transcript", "Granola transcripts"], ["notebook", "My notebook"], ["rhea", "My notes"], ["summary", "Domain summary sheets"], ["slide", "Slides"]];
/** Every quote that could belong on the page being edited (or anywhere, with "All pages"): click one to put it on the page, or drag it where you want it. */
function Quotes({ bank, err, pageId, pageNo, onAdd }: { bank: QuoteBank | null; err: string; pageId: string; pageNo: number; onAdd: (q: BankQuote) => void }) {
  const [all, setAll] = useState(false);
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const [more, setMore] = useState(1);
  useEffect(() => { setMore(1); }, [pageId, all, kind, q]);
  const mine = bank?.pages[pageId] ?? [];
  const pool = bank ? (all ? bank.quotes.map((_, i) => i) : mine) : [];
  const needle = q.trim().toLowerCase();
  const shown = pool.filter((i) => (!kind || bank!.quotes[i].kind === kind) && (!needle || bank!.quotes[i].t.toLowerCase().includes(needle)));
  const vis = shown.slice(0, 60 * more);
  return (
    <aside className="zlib zquotes" aria-label="Quote bank">
      <div className="zlibtop"><span className="eyebrow">Quotes for page {pageNo}</span><span className="thint">{bank ? `${shown.length} of ${pool.length}` : err ? "" : "Loading…"}</span></div>
      {err && <p className="thint">{err}</p>}
      {bank && (
        <>
          <select aria-label="Source" value={kind} onChange={(e) => setKind(e.target.value)}>{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <input type="search" placeholder="Search the words" aria-label="Search the words" value={q} onChange={(e) => setQ(e.target.value)} />
          <label className="zqall"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> All pages ({bank.quotes.length} quotes)</label>
          <p className="thint">Click a quote to put it on the page, or drag it where you want it. Nothing is reworded.{!all && mine.length === 0 ? " No list for this page yet: tick All pages." : ""}</p>
          <div className="zqlist">
            {vis.map((i) => { const x = bank.quotes[i]; return (
              <button key={i} type="button" draggable className={`zq k-${x.kind}`} onDragStart={(e) => { e.dataTransfer.setData("text/x-zine-quote", String(i)); e.dataTransfer.effectAllowed = "copy"; }} onClick={() => onAdd(x)}>
                <span>{x.t}</span><small>{x.src}</small>
              </button>
            ); })}
          </div>
          {shown.length > vis.length && <button type="button" className="btn ghost" onClick={() => setMore((m) => m + 1)}>Show more ({shown.length - vis.length} left)</button>}
        </>
      )}
    </aside>
  );
}

/** Every picture in the retreat folder as small previews: drag one onto the page, click to add it, or ⌘-click several for a flipbook. */
function Library({ onAdd, onBg, onFlip, intoFlip, big, setBig }: { onAdd: (f: string) => void; onBg: (f: string) => void; onFlip: (fs: string[]) => void; intoFlip?: (fs: string[]) => void; big?: boolean; setBig?: (b: boolean) => void }) {
  const [asBg, setAsBg] = useState(false);
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
      <div className="zlibtop"><span className="eyebrow">Photo library</span><span className="thint">{files ? `${shown.length} of ${files.length}` : err ? "" : "Loading…"}</span>{setBig && <button type="button" className="btn ghost zlibsize" aria-pressed={!!big} onClick={() => setBig(!big)}>{big ? "Smaller" : "Bigger"}</button>}</div>
      {err && <p className="thint">{err}</p>}
      {files && (
        <>
          <select aria-label="Folder" value={dir} onChange={(e) => { setDir(e.target.value); setMore(1); }}>
            <option value="">All folders</option>
            {dirs.map((d) => <option key={d} value={d}>{"\u00a0\u00a0".repeat(d.split("/").length - 1)}{d.split("/").pop()} ({counts.get(d)})</option>)}
          </select>
          <input type="search" placeholder="Search file names" aria-label="Search file names" value={q} onChange={(e) => { setQ(e.target.value); setMore(1); }} />
          <label className="zqall"><input type="checkbox" checked={asBg} onChange={(e) => setAsBg(e.target.checked)} /> Clicking a photo makes it this page’s background</label>
          <p className="thint">Drag a photo onto the page, or click to add it. ⌘-click several to make a flipbook.</p>
          {pick.length > 0 && (
            <div className="zlibpick">
              <button type="button" className="btn ghost" onClick={() => { onFlip(pick); setPick([]); }}>Flipbook of {pick.length}</button>
              {intoFlip && <button type="button" className="btn ghost" onClick={() => { intoFlip(pick); setPick([]); }}>Add to selected flipbook</button>}
              <button type="button" className="btn ghost" onClick={() => setPick([])}>Clear</button>
            </div>
          )}
          <div className={`zlibgrid${big ? " big" : ""}`}>
            {vis.map((f) => (
              <button key={f} type="button" draggable title={f} aria-pressed={pick.includes(f)}
                onDragStart={(e) => { e.dataTransfer.setData("text/x-zine-lib", f); e.dataTransfer.effectAllowed = "copy"; }}
                onClick={(e) => (e.metaKey || e.ctrlKey || e.shiftKey ? toggle(f) : asBg ? onBg(f) : onAdd(f))}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/zine/library?t=1&v=2&f=${encodeURIComponent(f)}`} alt={f.split("/").pop() ?? ""} loading="lazy" draggable={false} />
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
