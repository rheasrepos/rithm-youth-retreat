import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, gateToken } from "@/lib/gate";

/* The zine is public. Everything else (the network map, the wall, the sticky-note images, the team) sits behind one shared
   password. Anyone who isn't logged in lands on the zine. Set SITE_PASSWORD to turn the gate on; leave it unset and the site is open. */
export async function middleware(req: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.next();
  if (req.cookies.get(GATE_COOKIE)?.value === (await gateToken(password))) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ ok: false, reason: "locked" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/zine"; url.search = "";
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!zine|login|api/login|api/revalidate|_next/static|_next/image|favicon.ico).*)"] };
