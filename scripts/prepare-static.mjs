// Prepares a throwaway checkout for a static export (GitHub Pages). Run only in CI: it deletes server-only parts of the app.
// - API routes, the password middleware and the login page need a server, so they go.
// - /submit becomes a page that points to the Rithm team's form or email.
// - `export const revalidate` lines are dropped (a static export is rebuilt on every push instead).
import { rmSync, readdirSync, readFileSync, writeFileSync, copyFileSync, statSync } from "node:fs";
import path from "node:path";
if (!process.env.CI) { console.error("prepare-static deletes files; it only runs in CI."); process.exit(1); }
for (const p of ["app/api", "middleware.ts", "app/login"]) rmSync(p, { recursive: true, force: true });
copyFileSync("scripts/static/submit-page.tsx", "app/submit/page.tsx");
const walk = (d) => readdirSync(d).flatMap((f) => { const p = path.join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
for (const f of walk("app").filter((f) => f.endsWith(".tsx"))) {
  const s = readFileSync(f, "utf8"), t = s.replace(/^export const revalidate = .*\n/m, "");
  if (t !== s) writeFileSync(f, t);
}
console.log("ready for a static export");
