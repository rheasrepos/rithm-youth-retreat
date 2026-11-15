import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Zine, type ZineDoc } from "@/components/Zine";

export const revalidate = 3600;
export const metadata = { title: "The zine" };

/* Until data/zine.json exists, start from the 16 pages in the zine page plan, each with just its working title. */
const PLAN = ["OVERHEARD RITHM", "A ZINE", "What this is", "DAY 1", "DAY 1", "Hub map: the room", "Hub map: the AI", "DAY 2", "DAY 2", "Human notes", "AI notes", "DAY 3", "DAY 3", "Everyone's zines", "Everyone's zines", "Playlist + credits"];
const starter = (): ZineDoc => ({
  ratio: 4.25 / 2.75,   // page height ÷ width: one panel of a folded letter-sheet mini zine, as scanned
  pages: PLAN.map((t, i) => ({
    id: `p${i + 1}`, bg: "#f8f3ea",
    items: [{ id: `p${i + 1}-t`, type: "text" as const, x: 50, y: 14, w: 80, h: 12, rot: 0, z: 1, text: t, font: "Arial", size: i === 0 ? 9 : 6, color: "#1b1037", bold: true, italic: false, align: "center" as const }],
  })),
});

export default function ZinePage() {
  let doc: ZineDoc = starter();
  try {
    const f = path.join(process.cwd(), "data", "zine.json");
    if (existsSync(f)) doc = JSON.parse(readFileSync(f, "utf8")) as ZineDoc;
  } catch { /* fall back to the starter */ }
  return <Zine initial={doc} canSave={process.env.NODE_ENV === "development"} />;
}
