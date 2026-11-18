import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Wall, type WallEmbed, type WallItem, type WallLayout } from "@/components/Wall";
import { getModel } from "@/lib/data";
import { AIFigure } from "@/components/AI";
import sizes from "@/data/sticky-images.json";
import rhea from "@/data/rhea-notes.json";

export const revalidate = 3600;
export const metadata = { title: "The wall" };

/* Default arrangement: the eight piles, two to a row, roughly as they sat on the floor. Units: the rug is 100 wide. */
const ROWS: string[][] = [["wor", "sch"], ["rel", "phy"], ["com"], ["tec", "cul"], ["pol"]];
const NOTE = 5.2;          // one sticky note is 5.2 units wide
const POLAROID = 7.5;
const LABEL = 13;

function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}

/** Scatter n notes in loose rings around a label sheet. Returns offsets in note widths and the pile's radius. */
function pile(seed: string, n: number) {
  const r = rng(seed); const pts: { x: number; y: number; rot: number; z: number }[] = [];
  let ring = 0, placed = 0, maxR = 0;
  while (placed < n) {
    const radius = 1.6 + ring * 0.82;
    const cap = Math.min(n - placed, Math.floor((2 * Math.PI * radius) / 0.92));
    const start = r() * Math.PI * 2;
    for (let i = 0; i < cap; i++) {
      const a = start + (i / cap) * Math.PI * 2 + (r() - 0.5) * 0.3;
      const rr = radius + (r() - 0.5) * 0.34;
      pts.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr * 0.9, rot: (r() - 0.5) * 46, z: Math.floor(r() * 20) + 1 });
      maxR = Math.max(maxR, rr);
    }
    placed += cap; ring++;
  }
  for (let i = pts.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pts[i], pts[j]] = [pts[j], pts[i]]; }
  return { pts, radius: maxR + 0.75 };
}

function readLayout(): WallLayout | null {
  try {
    const f = path.join(process.cwd(), "data", "wall-layout.json");
    return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as WallLayout) : null;
  } catch { return null; }
}

function readEmbed(): WallEmbed | null {
  try {
    const f = path.join(process.cwd(), "data", "wall-embedding.json");
    return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as WallEmbed) : null;
  } catch { return null; }
}

export default async function WallPage() {
  const m = await getModel();
  const dims = sizes as Record<string, number[]>;
  const items: WallItem[] = [];
  let y = 3;
  for (const ids of ROWS) {
    const piles = ids.map((id) => m.domainById[id]).filter(Boolean).map((d) => {
      const notes = [
        ...d.themes.flatMap((t) => t.stickies.map((s) => ({ s, themeId: t.id, themeLabel: t.label, status: t.status as string }))),
        ...d.building.map((s) => ({ s, themeId: "", themeLabel: "Someone is building this", status: "building" })),
        ...d.other.map((s) => ({ s, themeId: "", themeLabel: "", status: "" })),
      ].filter(({ s }) => dims[s.photo]);
      return { d, notes, ...pile(d.id, notes.length) };
    });
    const rowH = Math.max(...piles.map((p) => p.radius * 2 * NOTE * 0.92));
    piles.forEach((p, i) => {
      const cx = piles.length === 1 ? 50 : 27 + i * 46, cy = y + rowH / 2;
      items.push({ id: `label-${p.d.id}`, kind: "label", x: cx, y: cy, rot: -2, z: 30, w: LABEL, domainId: p.d.id, domainName: p.d.name, text: p.d.name.replace(" & ", " + "), count: p.notes.length });
      p.notes.forEach(({ s, themeId, themeLabel, status }, k) => {
        const pt = p.pts[k];
        items.push({
          id: s.id, kind: "note", x: cx + pt.x * NOTE, y: cy + pt.y * NOTE, rot: pt.rot, z: pt.z, w: NOTE,
          src: `/stickies/${s.photo.replace(/\.png$/i, ".webp")}`, iw: dims[s.photo][0], ih: dims[s.photo][1],
          text: s.text, uncertain: s.uncertain, themeId, themeLabel, status, domainId: p.d.id, domainName: p.d.name,
        });
      });
    });
    y += rowH + 3;
  }
  const height = Math.round(y);

  /* Polaroids: any image in public/polaroids/ is picked up and scattered on the rug. */
  let polaFiles: string[] = [];
  const SHOW_POLAROIDS = false; // set to true to scatter the Polaroids on the rug again
  if (SHOW_POLAROIDS) try { polaFiles = readdirSync(path.join(process.cwd(), "public", "polaroids")).filter((f) => /\.(webp|jpe?g|png)$/i.test(f)).sort(); } catch { /* optional folder */ }
  const pr = rng("polaroids"); const cols = 4, rowsN = Math.max(1, Math.ceil(polaFiles.length / cols));
  const slots = polaFiles.map((_, i) => i).sort(() => pr() - 0.5);
  polaFiles.forEach((f, i) => {
    const slot = slots[i], c = slot % cols, r = Math.floor(slot / cols);
    items.push({ id: `pola-${f.replace(/\.[^.]+$/, "")}`, kind: "pola", src: `/polaroids/${f}`, w: POLAROID, z: 0, rot: (pr() - 0.5) * 34,
      x: ((c + 0.5) / cols) * 100 + (pr() - 0.5) * 13, y: (((r + 0.5) / rowsN) + (pr() - 0.5) * (0.6 / rowsN)) * height });
  });

  const total = items.filter((i) => i.kind === "note").length;
  return (
    <>
      <header className="hero">
        <h1>The <em className="ul">wall<svg viewBox="0 0 300 12" preserveAspectRatio="none" aria-hidden="true"><path d="M3 8 C 60 2, 140 3, 200 6 S 280 9, 297 4" /></svg></em></h1>
        <p className="wallq">What happens when you give people a free space for play creation talk and thought</p>
        <p className="lede">All {total} sticky notes from the retreat floor, in the eight piles we made them in. Every note is anonymous. Tap one to read it and see who in the network is working on it. Then regroup them and watch where they go.</p>
      </header>
      <AIFigure caption="Pile shapes traced by code Claude wrote from photos of the notes on the floor. Each note sits in a spot of its own colour, not necessarily its exact original spot. The other groupings are worked out by code from the notes' wording, not by us."><Wall items={items} defaultHeight={height} saved={readLayout()} canSave={process.env.NODE_ENV === "development"} embed={readEmbed()} /></AIFigure>
      <section className="wallnotes" aria-label="Rhea's notes">
        <span className="eyebrow">From Rhea’s notes</span>
        {rhea.quotes.map((q, i) => <blockquote key={i} className={q.length < 60 ? "short" : ""}>{q}</blockquote>)}
      </section>
    </>
  );
}
