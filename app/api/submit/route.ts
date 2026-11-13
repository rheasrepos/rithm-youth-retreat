import { NextResponse } from "next/server";
import { appendSubmission, sheetsConfigured } from "@/lib/sheets";

export const runtime = "nodejs";

/** Very small in-memory rate limit per IP (per serverless instance). Good enough for a form this size. */
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now(); const win = hits.get(ip)?.filter((t) => now - t < 10 * 60_000) ?? [];
  win.push(now); hits.set(ip, win);
  return win.length > 5;
}
const clean = (v: unknown, max: number) => String(v ?? "").replace(/[\r\n\t]+/g, " ").trim().slice(0, max);

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (limited(ip)) return NextResponse.json({ error: "Too many submissions from this connection. Try again in a few minutes." }, { status: 429 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  if (clean(body.website, 10)) return NextResponse.json({ ok: true }); // honeypot: pretend success

  const type = clean(body.type, 40) || "other";
  // a sticky note added on the word cloud is anonymous, like the notes at the retreat
  const anon = type === "sticky";
  const name = anon ? "anonymous (word cloud)" : clean(body.name, 120), email = anon ? "" : clean(body.email, 200), message = clean(body.message, anon ? 280 : 2000);
  if (anon && !message) return NextResponse.json({ error: "Write something on the note first." }, { status: 400 });
  if (!anon && (!name || !email || !message)) return NextResponse.json({ error: "Name, email and a short description are required." }, { status: 400 });
  if (!anon && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "That email doesn't look right." }, { status: 400 });
  const url = clean(body.url, 500);
  if (url && !/^https?:\/\//i.test(url)) return NextResponse.json({ error: "Links must start with http:// or https://" }, { status: 400 });

  const row = {
    timestamp: new Date().toISOString(),
    type,
    name, email,
    org: [clean(body.org_id, 60), clean(body.org, 200), clean(body.role, 120)].filter(Boolean).join(" · "),
    url,
    message,
    theme_id: clean(body.theme_id, 60),
    sticky_id: clean(body.sticky_id, 60),
    status: "unreviewed",
    reviewer_notes: "",
  };

  if (!sheetsConfigured()) {
    console.log("Submission (no sheet configured):", row);
    return NextResponse.json({ ok: true, note: "Sheet not configured; logged only." });
  }
  try { await appendSubmission(row); return NextResponse.json({ ok: true }); }
  catch (err) { console.error(err); return NextResponse.json({ error: "Could not save your submission. Please email the Rithm team." }, { status: 500 }); }
}
