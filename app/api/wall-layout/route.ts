import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

/* Saves the wall arrangement into the repo. Only works when the site runs on your own computer (`npm run dev`):
   on the deployed site the files are read-only, so the editor downloads wall-layout.json instead. */
export const dynamic = "force-dynamic";
const local = () => process.env.NODE_ENV === "development";
const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export async function POST(req: Request) {
  if (!local()) return NextResponse.json({ ok: false, reason: "read-only" }, { status: 403 });
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("multipart/form-data")) {
    const file = (await req.formData()).get("file");
    if (!(file instanceof File) || !EXT[file.type]) return NextResponse.json({ ok: false, reason: "Use a PNG, JPEG or WebP image." }, { status: 400 });
    if (file.size > 12 * 1024 * 1024) return NextResponse.json({ ok: false, reason: "Image is over 12 MB." }, { status: 400 });
    const dir = path.join(process.cwd(), "public");
    for (const f of await readdir(dir)) if (/^wall-background\.(png|jpg|webp)$/.test(f)) await unlink(path.join(dir, f));
    const name = `wall-background.${EXT[file.type]}`;
    await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ ok: true, path: `/${name}` });
  }
  const layout = await req.json();
  if (!layout || typeof layout !== "object" || typeof layout.items !== "object") return NextResponse.json({ ok: false, reason: "bad layout" }, { status: 400 });
  const dir = path.join(process.cwd(), "data");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "wall-layout.json"), JSON.stringify(layout, null, 1) + "\n");
  return NextResponse.json({ ok: true });
}
