"use client";
import { useEffect, useMemo, useState } from "react";
import { buildCloud, type CloudNote, type CloudWord } from "@/lib/words";
export type { CloudNote, CloudWord };
type Mode = "all" | "concern" | "working_on";
type ColourBy = "size" | "lean";
// colour by size: rare words darkest so small text stays readable, the most-used in yellow (sticky-note colours, deepened)
const SIZE_STEPS: [number, string][] = [[11, "#e3b21c"], [6, "#d4730f"], [4, "#4f9a2c"], [3, "#8a4fb0"], [0, "#1a7fb0"]];
const bySize = (n: number) => (n === 1 ? "#d6406e" : SIZE_STEPS.find(([lo]) => n >= lo)![1]);   // words only on your own note: sticky pink
type Spot = { x: number; y: number; s: number; on: boolean };

const W = 1000, H = 620, BASE = 100;           // the cloud is laid out in a 1000 × 620 box; text is drawn at 100px and scaled
const MIN = 12, MAX = 92;
const INK = "#1a7fb0", PINK = "#d4730f", BOTH = "#8a4fb0";   // blue = worries, orange = work under way, purple = both (deeper sticky-note colours)

const countIn = (c: CloudWord, m: Mode) => (m === "all" ? c.n : m === "concern" ? c.concern : c.working_on);
const tone = (c: CloudWord) => { const t = c.concern + c.working_on; if (!t) return "#7a7186"; const r = c.concern / t; return r >= 0.7 ? INK : r <= 0.4 ? PINK : BOTH; };

/** Spiral layout: biggest words first, each one walked out from the centre until it fits without overlapping. */
function layout(words: CloudWord[], mode: Mode, focus: string | null): Record<string, Spot> {
  const cv = document.createElement("canvas").getContext("2d")!;
  cv.font = `800 ${BASE}px Arial, Helvetica, sans-serif`;
  const nmax = Math.max(1, ...words.map((c) => countIn(c, mode)));
  const fw = focus ? words.find((c) => c.w === focus) : undefined;
  const near = new Set(fw?.co ?? []);
  const boost = (c: CloudWord) => (c.w === focus ? 1.7 : near.has(c.w) ? 1.35 : 1);
  const live = words.filter((c) => countIn(c, mode) > 0 || c.w === focus)
    .map((c) => ({ c, size: countIn(c, mode) === 1 ? 22 * boost(c) : Math.min(MAX * 1.5, (MIN + (MAX - MIN) * Math.sqrt((Math.max(1, countIn(c, mode)) - 1) / Math.max(1, nmax - 1))) * boost(c)) }))
    .sort((a, b) => (b.c.w === focus ? 1 : 0) - (a.c.w === focus ? 1 : 0) || (near.has(b.c.w) ? 1 : 0) - (near.has(a.c.w) ? 1 : 0) || b.size - a.size);
  const boxes: { x0: number; y0: number; x1: number; y1: number }[] = [];
  const out: Record<string, Spot> = {};
  for (const { c, size } of live) {
    const k = size / BASE, w = cv.measureText(c.w).width * k + 6, h = size * 0.86 + 3;
    let placed = false;
    for (let t = 0; t < 9000 && !placed; t++) {
      const a = t * 0.12, r = 0.9 * a;
      const x = W / 2 + r * Math.cos(a) * 1.55 - w / 2, y = H / 2 + r * Math.sin(a) - h / 2;
      if (x < 0 || y < 0 || x + w > W || y + h > H) continue;
      if (boxes.some((b) => x < b.x1 && x + w > b.x0 && y < b.y1 && y + h > b.y0)) continue;
      boxes.push({ x0: x, y0: y, x1: x + w, y1: y + h });
      out[c.w] = { x: x + w / 2, y: y + h / 2, s: k, on: true };
      placed = true;
    }
  }
  for (const c of words) if (!out[c.w]) out[c.w] = { x: W / 2, y: H / 2, s: 0, on: false };
  return out;
}

function Highlight({ text, word }: { text: string; word: string }) {
  const parts = word.split(" ").map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(\\b${parts.join("[^a-z]+")}\\w*)`, "gi");
  return <>{text.split(re).map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p))}</>;
}

export function WordCloud({ notes: base, domains, compact }: { notes: CloudNote[]; domains: { id: string; name: string }[]; compact?: boolean }) {   // compact: inside the zine, without the add-a-note form
  const [mine, setMine] = useState<CloudNote[]>([]);            // notes this viewer added (only in their browser until approved)
  const all = useMemo(() => [...base, ...mine], [base, mine]);
  const words = useMemo(() => buildCloud(all), [all]);
  const notes = useMemo(() => Object.fromEntries(all.map((n) => [n.id, n])), [all]);
  const domainNames = useMemo(() => Object.fromEntries(domains.map((d) => [d.id, d.name])), [domains]);
  const [mode, setMode] = useState<Mode>("all");
  const [focus, setFocus] = useState<string | null>(null);
  const [colourBy, setColourBy] = useState<ColourBy>("size");
  const [spots, setSpots] = useState<Record<string, Spot> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => { setSpots(layout(words, mode, focus)); }, [words, mode, focus]);

  // the add-a-note form
  const [text, setText] = useState(""), [kind, setKind] = useState("concern"), [dom, setDom] = useState(domains[0]?.id ?? "");
  const [share, setShare] = useState(true), [msg, setMsg] = useState("");
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    const note: CloudNote = { id: `you-${Date.now()}`, text: t, kind, domain: dom, color: kind === "working_on" ? "orange" : "blue", mine: true };
    const before = new Map(words.map((w) => [w.w, w.n]));
    const next = buildCloud([...all, note]);
    setFresh(new Set(next.filter((w) => w.ids.includes(note.id) && (before.get(w.w) ?? 0) < w.n).map((w) => w.w)));
    setMine((m) => [...m, note]); setText(""); setFocus(null);
    setTimeout(() => setFresh(new Set()), 3200);
    if (!share) { setMsg("Added to your cloud. It wasn't sent anywhere."); return; }
    try {
      const r = await fetch("/api/submit", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "sticky", message: t, theme_id: dom, org: kind, website: "" }) });
      setMsg(r.ok ? "Added to your cloud, and sent to the Rithm team. Once they approve it, it joins everyone's cloud." : "Added to your cloud. Sending it to the Rithm team didn't work; try again later.");
    } catch { setMsg("Added to your cloud. Sending it to the Rithm team didn't work; try again later."); }
  }
  const fw = useMemo(() => words.find((c) => c.w === focus), [words, focus]);
  const near = new Set(fw?.co ?? []);
  const shown = fw ? fw.ids.map((i) => notes[i]).filter((n) => n && (mode === "all" || n.kind === mode)) : [];

  return (
    <div className="wcloud">
      <div className="wcbar" role="group" aria-label="Which notes to count">
        {([["all", "All notes"], ["concern", "Worries"], ["working_on", "Working on it"]] as [Mode, string][]).map(([m, l]) => (
          <button key={m} type="button" className={mode === m ? "on" : ""} aria-pressed={mode === m} onClick={() => setMode(m)}>{l}</button>
        ))}
        <span className="wcsep" />
        {([["size", "Colour by size"], ["lean", "Colour by worry vs. doing"]] as [ColourBy, string][]).map(([c, l]) => (
          <button key={c} type="button" className={colourBy === c ? "on" : ""} aria-pressed={colourBy === c} onClick={() => setColourBy(c)}>{l}</button>
        ))}
        {colourBy === "lean"
          ? <span className="wckey"><i style={{ background: INK }} />mostly worries <i style={{ background: PINK }} />mostly work under way <i style={{ background: BOTH }} />both</span>
          : <span className="wckey">notes: <i style={{ background: "#1a7fb0" }} />2 <i style={{ background: "#8a4fb0" }} />3 <i style={{ background: "#4f9a2c" }} />4–5 <i style={{ background: "#d4730f" }} />6–10 <i style={{ background: "#e3b21c" }} />11+{mine.length > 0 && <> <i style={{ background: "#d6406e" }} />only on your note</>}</span>}
      </div>
      <svg className="wcsvg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Word cloud of the sticky notes. Bigger words appear on more notes.">
        {words.map((c, i) => {
          const p = spots?.[c.w] ?? { x: W / 2, y: H / 2, s: 0, on: false };
          const dim = focus && c.w !== focus && !near.has(c.w);
          return (
            <g key={c.w} className="wcw" style={{ transform: `translate(${p.x}px, ${p.y}px) scale(${p.s})`, transitionDelay: spots ? `${Math.min(i, 120) * 5}ms` : "0ms", opacity: p.on ? (dim ? 0.13 : 1) : 0 }}>
              <text textAnchor="middle" dominantBaseline="central" fontSize={BASE} fill={colourBy === "size" ? bySize(countIn(c, mode)) : tone(c)} className={[c.w === focus ? "focus" : near.has(c.w) ? "near" : "", fresh.has(c.w) ? "fresh" : ""].join(" ")}
                tabIndex={p.on ? 0 : -1} role="button" aria-label={`${c.w}: ${countIn(c, mode)} ${countIn(c, mode) === 1 ? "note" : "notes"}`}
                onClick={() => setFocus(focus === c.w ? null : c.w)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setFocus(focus === c.w ? null : c.w); } }}>
                {c.w}
              </text>
            </g>
          );
        })}
      </svg>
      {!compact && <form className="wcadd" onSubmit={add}>
        <label className="wcpad">
          <span className="sr-only">Your sticky note</span>
          <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={280} rows={3} placeholder="Add your own sticky note… what worries you, or what are you working on?" />
        </label>
        <div className="wcopts">
          <label>This is <select value={kind} onChange={(e) => setKind(e.target.value)}><option value="concern">a worry</option><option value="working_on">something I&apos;m working on</option></select></label>
          <label>about <select value={dom} onChange={(e) => setDom(e.target.value)}>{domains.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
          <label className="wcshare"><input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} /> Also send it (anonymously) to the Rithm team for the shared cloud</label>
          <button type="submit" disabled={!text.trim()}>Stick it on</button>
        </div>
        {msg && <p className="wcmsg" role="status">{msg}{mine.length > 0 && ` You've added ${mine.length}.`}</p>}
      </form>}
      {fw ? (
        <div className="wcnotes">
          <div className="wchead">
            <h3>“{fw.w}”</h3>
            <p>{shown.length} {shown.length === 1 ? "note" : "notes"}, across {fw.domains.map((d) => domainNames[d]).join(", ")}. Travels with: {fw.co.map((o, i) => <button key={o} type="button" className="wclink" onClick={() => setFocus(o)}>{i > 0 && ", "}{o}</button>)}</p>
            <button type="button" className="wcclose" onClick={() => setFocus(null)}>Back to all words</button>
          </div>
          <div className="wcgrid">
            {shown.map((n, i) => (
              <blockquote key={n.id} className={`wcnote c-${(n.color || "").split(/[^a-z]/)[0]}`} style={{ ["--r" as string]: `${((i * 37) % 7) - 3}deg`, animationDelay: `${i * 40}ms` }}>
                <span>“<Highlight text={n.text} word={fw.w} />”</span>
                <small>{n.mine ? "your note · " : ""}{domainNames[n.domain]}{n.kind === "working_on" ? " · working on it" : n.kind === "concern" ? " · worry" : ""}</small>
              </blockquote>
            ))}
          </div>
        </div>
      ) : <p className="wchint">Click any word to pull out every note that uses it, and the words it travels with.</p>}
    </div>
  );
}
