import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

/* The zine editor's quote bank: every quote that could belong on each page (data/zine-quotes.json, built by
   scripts/build_zine_quotes.py). Only served while the site runs on your own computer, so the bank itself is never public. */
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV !== "development") return NextResponse.json({ ok: false, reason: "read-only" }, { status: 403 });
  const f = path.join(process.cwd(), "data", "zine-quotes.json");
  if (!existsSync(f)) return NextResponse.json({ ok: false, reason: "No quote bank yet. Run python3 scripts/build_zine_quotes.py." }, { status: 404 });
  return new NextResponse(await readFile(f, "utf8"), { headers: { "content-type": "application/json" } });
}
