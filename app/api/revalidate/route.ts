import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

/**
 * Nightly rebuild (Vercel cron, see vercel.json) and on-demand refresh after the team approves a submission:
 *   GET /api/revalidate?secret=$CRON_SECRET
 * Vercel's cron sends `Authorization: Bearer $CRON_SECRET` on its own.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  const auth = req.headers.get("authorization");
  const ok = secret && (url.searchParams.get("secret") === secret || auth === `Bearer ${secret}`);
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  revalidateTag("sheet");
  ["/", "/untapped", "/people", "/submit"].forEach((p) => revalidatePath(p));
  revalidatePath("/domain/[id]", "page");
  revalidatePath("/org/[id]", "page");
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
