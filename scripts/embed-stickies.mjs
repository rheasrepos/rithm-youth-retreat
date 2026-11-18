// Turns every sticky note (and the eight domain names) into a "meaning vector" with a small open sentence model
// that runs on this computer, then lays the notes out so that notes that mean similar things sit near each other
// (t-SNE). Writes data/wall-embedding.json, which the wall page reads for its "By meaning" and "Pulled by the words" views.
//
// Run from the repo folder:   npm i -D @huggingface/transformers   then   node scripts/embed-stickies.mjs
// The model (about 25 MB) downloads once. Nothing about the notes leaves this computer.
import { readFileSync, writeFileSync } from "node:fs";

const MODEL = "Xenova/all-MiniLM-L6-v2";
const seed = JSON.parse(readFileSync(new URL("../data/seed.json", import.meta.url), "utf8"));
const yes = (v) => /^(true|yes|1|y)$/i.test(String(v ?? "").trim());
const clean = (t) => String(t).replace(/\[[^\]]*\]/g, " ").replace(/^\s*[0-9①-⑳]+[.)]?\s+/, "").replace(/\s+/g, " ").trim();
const notes = seed.stickies.filter((s) => yes(s.show)).map((s) => ({ id: s.id, domain: s.domain_id, text: clean(s.text) })).filter((s) => s.text);
const domains = seed.domains.slice().sort((a, b) => Number(a.sort) - Number(b.sort)).map((d) => ({ id: d.id, name: d.name }));

async function embed(texts) {
  if (process.env.MOCK) {   // for testing the layout maths without the model
    let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    return texts.map((_, i) => { const v = Array.from({ length: 16 }, (_, k) => (k === i % 4 ? 3 : 0) + r()); const n = Math.hypot(...v); return v.map((x) => x / n); });
  }
  const { pipeline } = await import("@huggingface/transformers");
  const model = await pipeline("feature-extraction", MODEL);
  const out = [];
  for (let i = 0; i < texts.length; i += 16) {
    const t = await model(texts.slice(i, i + 16), { pooling: "mean", normalize: true });
    out.push(...t.tolist());
  }
  return out;
}

/* Plain t-SNE (exact, fine for a couple of hundred points). Seeded, so the same notes always give the same picture. */
function tsne(X, { perplexity = 18, iters = 1200, seed: sd = 11 } = {}) {
  const n = X.length; let s = sd;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());
  const D = X.map((a) => X.map((b) => { let d = 0; for (let k = 0; k < a.length; k++) d += (a[k] - b[k]) ** 2; return d; }));
  const P = D.map((row, i) => {   // each note's neighbour probabilities, tuned so every note has about `perplexity` effective neighbours
    let lo = 0, hi = Infinity, beta = 1, p = [];
    for (let it = 0; it < 60; it++) {
      let sum = 0; p = row.map((d, j) => (j === i ? 0 : Math.exp(-d * beta))); for (const v of p) sum += v;
      let H = 0; p = p.map((v) => v / (sum || 1e-12)); for (const v of p) if (v > 1e-12) H -= v * Math.log(v);
      const diff = H - Math.log(perplexity); if (Math.abs(diff) < 1e-5) break;
      if (diff > 0) { lo = beta; beta = hi === Infinity ? beta * 2 : (beta + hi) / 2; } else { hi = beta; beta = (beta + lo) / 2; }
    }
    return p;
  });
  const Pj = P.map((r, i) => r.map((v, j) => Math.max((v + P[j][i]) / (2 * n), 1e-12)));
  let Y = X.map(() => [gauss() * 1e-2, gauss() * 1e-2]), V = Y.map(() => [0, 0]);
  for (let it = 0; it < iters; it++) {
    const ex = it < 250 ? 4 : 1, mom = it < 250 ? 0.5 : 0.8;
    const num = Y.map((a, i) => Y.map((b, j) => (i === j ? 0 : 1 / (1 + (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2))));
    let Z = 0; for (const r of num) for (const v of r) Z += v;
    for (let i = 0; i < n; i++) {
      let gx = 0, gy = 0;
      for (let j = 0; j < n; j++) { const m = (ex * Pj[i][j] - num[i][j] / Z) * num[i][j]; gx += m * (Y[i][0] - Y[j][0]); gy += m * (Y[i][1] - Y[j][1]); }
      V[i][0] = mom * V[i][0] - 100 * 4 * gx; V[i][1] = mom * V[i][1] - 100 * 4 * gy;
    }
    Y = Y.map((y, i) => [y[0] + V[i][0], y[1] + V[i][1]]);
    const mx = Y.reduce((a, y) => a + y[0], 0) / n, my = Y.reduce((a, y) => a + y[1], 0) / n; Y = Y.map((y) => [y[0] - mx, y[1] - my]);
  }
  return Y;
}

const dot = (a, b) => a.reduce((s, v, k) => s + v * b[k], 0);
const r3 = (v) => Math.round(v * 1000) / 1000;

const vecs = await embed([...notes.map((n) => n.text), ...domains.map((d) => d.name)]);
const nv = vecs.slice(0, notes.length), dv = vecs.slice(notes.length);
const Y = tsne(nv);
const xs = Y.map((y) => y[0]), ys = Y.map((y) => y[1]);
const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
const unit = Y.map((y) => [r3((y[0] - x0) / (x1 - x0)), r3((y[1] - y0) / (y1 - y0))]);   // 0..1 in both directions

const sim = nv.map((v) => dv.map((d) => r3(dot(v, d))));   // how close each note is to each domain name
const nearest = sim.map((row) => row.indexOf(Math.max(...row)));
const agree = notes.filter((n, i) => domains[nearest[i]].id === n.domain).length;
// where each domain name "lives" on the map: in the middle of the eight notes closest to it in meaning
const K = 8;
const words = Object.fromEntries(domains.map((d, k) => {
  const top = sim.map((row, i) => [row[k], i]).sort((a, b) => b[0] - a[0]).slice(0, K).map(([, i]) => i);
  return [d.id, { x: r3(top.reduce((s, i) => s + unit[i][0], 0) / K), y: r3(top.reduce((s, i) => s + unit[i][1], 0) / K), nearest: top.map((i) => notes[i].id), ownPile: top.filter((i) => notes[i].domain === d.id).length }];
}));
// do notes from the same pile sit together on the map? share of each note's 5 nearest map-neighbours that came from its own pile
let same = 0;
unit.forEach((p, i) => { const nb = unit.map((q, j) => [(p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2, j]).filter(([, j]) => j !== i).sort((a, b) => a[0] - b[0]).slice(0, 5); same += nb.filter(([, j]) => notes[j].domain === notes[i].domain).length / 5; });
const perDomain = Object.fromEntries(domains.map((d) => { const idx = notes.map((n, i) => (n.domain === d.id ? i : -1)).filter((i) => i >= 0); return [d.id, { notes: idx.length, closestToOwnWord: idx.filter((i) => domains[nearest[i]].id === d.id).length }]; }));

const out = {
  model: MODEL, made: new Date().toISOString().slice(0, 10), count: notes.length,
  domains: domains.map((d) => d.id),
  stats: { closestToOwnWord: agree, chance: r3(notes.length / domains.length), neighboursFromSamePile: r3(same / notes.length), perDomain },
  words,
  notes: Object.fromEntries(notes.map((n, i) => [n.id, { x: unit[i][0], y: unit[i][1], sim: sim[i] }])),
};
writeFileSync(new URL("../data/wall-embedding.json", import.meta.url), JSON.stringify(out) + "\n");
console.log(`Wrote data/wall-embedding.json: ${notes.length} notes.`);
console.log(`${agree} of ${notes.length} notes are closest in meaning to the name of the pile we put them in (chance would be about ${Math.round(notes.length / domains.length)}).`);
console.log(`On the map, ${Math.round((same / notes.length) * 100)}% of a note's nearest neighbours come from its own pile.`);
