import { NextResponse } from "next/server";
import { GATE_COOKIE, gateToken } from "@/lib/gate";

export const dynamic = "force-dynamic";

/** Checks the shared password and, if it's right, sets the cookie that lets this browser in for 30 days. */
export async function POST(req: Request) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.json({ ok: true });
  const body = (await req.json().catch(() => null)) as { password?: string } | null;
  await new Promise((r) => setTimeout(r, 400));   // slows down guessing
  if (!body?.password || body.password !== password) return NextResponse.json({ ok: false, reason: "That's not the password." }, { status: 401 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(GATE_COOKIE, await gateToken(password), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  // a plain marker the pages can read, only to decide which links to show; it unlocks nothing by itself
  res.cookies.set("rithm_in", "1", { sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return res;
}

/** Locks this browser again. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(GATE_COOKIE); res.cookies.delete("rithm_in");
  return res;
}
