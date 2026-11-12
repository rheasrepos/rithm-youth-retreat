import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

/* Saves the zine into the repo: pages to data/zine.json, pasted images to public/zine/.
   Only works when the site runs on your own computer (`npm run dev`); the deployed site is read-only. */
export const dynamic = "force-dynamic";
const local = () => process.env.NODE_ENV === "development";
const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };

export async function POST(req: Request) {
  if (!local()) return NextResponse.json({ ok: false, reason: "read-only" }, { status: 403 });
  if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const file = (await req.formData()).get("file");
    if (!(file instanceof File) || !EXT[file.type]) return NextResponse.json({ ok: false, reason: "Use a PNG, JPEG, WebP or GIF image." }, { status: 400 });
    if (file.size > 15 * 1024 * 1024) return NextResponse.json({ ok: false, reason: "Image is over 15 MB." }, { status: 400 });
    const dir = path.join(process.cwd(), "public", "zine");
    await mkdir(dir, { recursive: true });
    const name = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}.${EXT[file.type]}`;
    await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ ok: true, path: `/zine/${name}` });
  }
  const doc = await req.json();
  if (!doc || !Array.isArray(doc.pages)) return NextResponse.json({ ok: false, reason: "bad zine" }, { status: 400 });
  await mkdir(path.join(process.cwd(), "data"), { recursive: true });
  await writeFile(path.join(process.cwd(), "data", "zine.json"), JSON.stringify(doc, null, 1) + "\n");
  return NextResponse.json({ ok: true });
}
