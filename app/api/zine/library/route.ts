import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";

/* The zine editor's photo library: lists every picture in your retreat folder, serves small previews,
   and copies a picture into public/zine/ when you put it on a page (so the zine never points outside the repo).
   Only works with `npm run dev` on your own computer. Set ZINE_LIBRARY in .env.local to use another folder. */
export const dynamic = "force-dynamic";
const local = () => process.env.NODE_ENV === "development";
const ROOT = path.resolve(process.env.ZINE_LIBRARY ?? path.join(os.homedir(), "Desktop", "rithmyouthretreat"));
const IMG = /\.(jpe?g|png|webp|gif)$/i;
const SKIP = /^[._]|^node_modules$|^unused/i;   // hidden folders, scratch folders (names starting with _), and anything named "unused…"
const TYPE: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
const THUMBS = path.join(process.cwd(), ".cache", "zine-library");

type Sharp = typeof import("sharp").default;
let sharpMod: Sharp | null | undefined;
async function getSharp(): Promise<Sharp | null> {
  if (sharpMod === undefined) { try { sharpMod = (await import("sharp")).default; } catch { sharpMod = null; } }
  return sharpMod;
}
async function walk(dir: string, rel: string, out: string[]) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (SKIP.test(e.name)) continue;
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) await walk(path.join(dir, e.name), r, out);
    else if (IMG.test(e.name)) out.push(r);
  }
}
/** The file inside the library folder, or null if the path tries to leave it. */
function inside(rel: string | null): string | null {
  if (!rel) return null;
  const full = path.resolve(ROOT, rel);
  return full.startsWith(ROOT + path.sep) && IMG.test(full) ? full : null;
}
const ext = (f: string) => path.extname(f).slice(1).toLowerCase();

export async function GET(req: Request) {
  if (!local()) return NextResponse.json({ ok: false, reason: "read-only" }, { status: 403 });
  const q = new URL(req.url).searchParams;
  if (!q.get("f")) {
    if (!existsSync(ROOT)) return NextResponse.json({ ok: false, reason: `Can't find the folder ${ROOT}.` }, { status: 404 });
    const files: string[] = [];
    await walk(ROOT, "", files);
    files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return NextResponse.json({ ok: true, root: path.basename(ROOT), files });
  }
  const full = inside(q.get("f"));
  if (!full || !existsSync(full)) return new NextResponse("not found", { status: 404 });
  const headers = { "cache-control": "private, max-age=86400" };
  if (q.get("t")) {
    const s = await getSharp();
    if (s) {
      const st = await stat(full);
      const key = createHash("sha1").update(`${full}:${st.mtimeMs}`).digest("hex");
      const cached = path.join(THUMBS, `${key}.webp`);
      if (!existsSync(cached)) {
        await mkdir(THUMBS, { recursive: true });
        await writeFile(cached, await s(full).rotate().resize(360, 360, { fit: "inside" }).webp({ quality: 70 }).toBuffer());
      }
      return new NextResponse(new Uint8Array(await readFile(cached)), { headers: { ...headers, "content-type": "image/webp" } });
    }
  }
  return new NextResponse(new Uint8Array(await readFile(full)), { headers: { ...headers, "content-type": TYPE[ext(full)] } });
}

/** Copies one library picture into public/zine/, shrunk to at most 2400 px on its long side (PNG cut-outs keep their transparency). */
export async function POST(req: Request) {
  if (!local()) return NextResponse.json({ ok: false, reason: "read-only" }, { status: 403 });
  const body = await req.json().catch(() => null) as { f?: string } | null;
  const full = inside(body?.f ?? null);
  if (!full || !existsSync(full)) return NextResponse.json({ ok: false, reason: "That picture isn't in the library folder." }, { status: 400 });
  const e = ext(full) === "jpeg" ? "jpg" : ext(full);
  let buf: Buffer = await readFile(full);
  const s = await getSharp();
  if (s && e !== "gif") {
    const img = s(buf).rotate().resize(2400, 2400, { fit: "inside", withoutEnlargement: true });
    buf = await (e === "png" ? img.png() : e === "webp" ? img.webp({ quality: 85 }) : img.jpeg({ quality: 85 })).toBuffer();
  }
  const dir = path.join(process.cwd(), "public", "zine");
  await mkdir(dir, { recursive: true });
  const name = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}.${e}`;
  await writeFile(path.join(dir, name), buf);
  return NextResponse.json({ ok: true, path: `/zine/${name}` });
}
