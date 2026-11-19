import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

/* The zine editor's checklist of what is left to decide and to do. Reads and writes data/zine-todo.json.
   Only works with `npm run dev` on your own computer; the deployed site never shows or changes it. */
export const dynamic = "force-dynamic";
const local = () => process.env.NODE_ENV === "development";
const FILE = path.join(process.cwd(), "data", "zine-todo.json");
type Item = { id: string; text: string; group: string; page?: number; done?: boolean };

export async function GET() {
  if (!local()) return NextResponse.json({ reason: "read-only" }, { status: 403 });
  try { return NextResponse.json(JSON.parse(await readFile(FILE, "utf8"))); }
  catch { return NextResponse.json({ items: [] }); }
}

export async function POST(req: Request) {
  if (!local()) return NextResponse.json({ reason: "read-only" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { items?: Item[] } | null;
  const list = body?.items;
  if (!Array.isArray(list) || !list.every((i) => typeof i?.id === "string" && typeof i?.text === "string" && typeof i?.group === "string")) return NextResponse.json({ reason: "bad list" }, { status: 400 });
  const items = list.map(({ id, text, group, page, done }) => ({ id, text: text.slice(0, 500), group: group.slice(0, 80), ...(page ? { page } : {}), ...(done ? { done: true } : {}) }));
  await writeFile(FILE, JSON.stringify({ items }, null, 1) + "\n");
  return NextResponse.json({ ok: true });
}
