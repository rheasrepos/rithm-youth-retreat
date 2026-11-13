/* Word counting for the word cloud. Runs on the server (from the live notes) and in the browser (when a viewer adds a
   note), so a new note reshapes the cloud instantly. Same rules as scripts/sticky_analysis.py, which makes the print page:
   common words and "working" (it echoes the prompt) are skipped, plurals fold into the singular, every form of
   "connect" counts as "connection", and two-word phrases used on 2+ notes ("human connection") are kept whole. */

export interface CloudNote { id: string; text: string; kind: string; color: string; domain: string; mine?: boolean }
export interface CloudWord { w: string; n: number; concern: number; working_on: number; domains: string[]; ids: string[]; co: string[] }

const STOP = new Set(`a an the and or but if so of to in on at by for from with without into onto over under about as is are was were be been being
am do does did doing have has had having i me my we us our you your he she they them their it its this that these those there here
what which who whom whose when where why how not no nor than then too very can could would should will just more most less much
many some any all each every other such own same also only even still really get got make makes making like want wants feel feels
need needs thing things way ways lot lots one two three etc vs via im dont doesnt isnt cant wont theyre youre ive id ill re s t
going go gets being because while through between up down out off again further once both few
im i'm don't didn't doesn't isn't can't won't they're you're i've it's that's think sometimes abt now done use using
working`.split(/\s+/));
const ALIAS: Record<string, string> = { ppl: "people", "ai's": "ai", irl: "in-person", tech: "technology", kids: "kid", youth: "young", socials: "social" };
const ROOTS: Record<string, string> = Object.fromEntries(["connect", "connects", "connected", "connecting", "connection", "connections", "connectedness", "connectivity"].map((w) => [w, "connection"]));
ROOTS.disconnect = ROOTS.disconnected = ROOTS.disconnection = "disconnection";

const clean = (t: string) => t.replace(/\[(crossed out|illegible)[^\]]*\]/gi, " ").replace(/^\s*\d+[.)]\s*/, " ").replace(/\b3rd\b/gi, "third");
const raw = (t: string) => clean(t).toLowerCase().replace(/’/g, "'").match(/[a-z][a-z'\-]*/g) ?? [];

function tokens(t: string) {
  const out: string[] = [];
  for (let w of raw(t)) {
    w = w.replace(/^['-]+|['-]+$/g, "");
    w = ALIAS[w] ?? w;
    if (w.endsWith("'s")) w = w.slice(0, -2);
    if (w.length < 2 || STOP.has(w)) continue;
    out.push(w);
  }
  return out;
}

export function buildCloud(notes: CloudNote[]): CloudWord[] {
  const tok: Record<string, string[]> = {};
  for (const n of notes) tok[n.id] = tokens(n.text);
  const vocab = new Set(Object.values(tok).flat());
  const fold = (w: string) => {
    if (ROOTS[w]) return ROOTS[w];
    if (w.endsWith("ies") && vocab.has(w.slice(0, -3) + "y")) return w.slice(0, -3) + "y";
    if (w.endsWith("s") && !/(ss|us|is)$/.test(w) && vocab.has(w.slice(0, -1))) return w.slice(0, -1);
    return w;
  };
  for (const id in tok) tok[id] = tok[id].map(fold);
  const df = new Map<string, number>();
  for (const id in tok) for (const w of new Set(tok[id])) df.set(w, (df.get(w) ?? 0) + 1);

  // phrases: the same two words side by side on 2+ notes
  const low: Record<string, string> = {}, pairs = new Map<string, number>();
  for (const n of notes) {
    const r = raw(n.text).map((x) => fold(ALIAS[x] ?? x));
    low[n.id] = ` ${r.join(" ")} `;
    for (let i = 0; i + 1 < r.length; i++) if (!STOP.has(r[i]) && !STOP.has(r[i + 1])) { const k = `${r[i]} ${r[i + 1]}`; pairs.set(k, (pairs.get(k) ?? 0) + 1); }
  }
  const phrases = [...pairs].filter(([, v]) => v >= 2).map(([k]) => k).sort((a, b) => b.length - a.length);
  // a single word only counts on notes where it appears outside a kept phrase
  const solo: Record<string, Set<string>> = {};
  for (const n of notes) { let t = low[n.id]; for (const p of phrases) t = t.split(` ${p} `).join(" | "); solo[n.id] = new Set(t.split(" ")); }
  const hits = (w: string) => notes.filter((n) => (w.includes(" ") ? low[n.id].includes(` ${w} `) : solo[n.id].has(w) && tok[n.id].includes(w)));

  const cand = [...new Set([...df.keys(), ...phrases])];
  const ids = new Map(cand.map((w) => [w, hits(w)]));
  const words = cand.filter((w) => (ids.get(w)?.length ?? 0) >= 2 || (ids.get(w) ?? []).some((n) => n.mine));
  const idset = new Map(words.map((w) => [w, new Set(ids.get(w)!.map((n) => n.id))]));
  return words.map((w) => {
    const hs = ids.get(w)!;
    const co = new Map<string, number>();
    for (const o of words) {
      if (o === w || o.split(" ").includes(w) || w.split(" ").includes(o)) continue;
      const k = hs.filter((n) => idset.get(o)!.has(n.id)).length;
      if (k) co.set(o, k);
    }
    return {
      w, n: hs.length, concern: hs.filter((n) => n.kind === "concern").length, working_on: hs.filter((n) => n.kind === "working_on").length,
      domains: [...new Set(hs.map((n) => n.domain))].sort(), ids: hs.map((n) => n.id),
      co: [...co].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([o]) => o),
    };
  }).sort((a, b) => b.n - a.n);
}
