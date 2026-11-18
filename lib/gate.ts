/* The shared-password gate. The password itself lives only in the SITE_PASSWORD environment variable
   (.env.local on your computer, Project Settings → Environment Variables on Vercel). If it isn't set, the site is open. */
export const GATE_COOKIE = "rithm_gate";

/** What the cookie holds once someone has typed the right password: a fingerprint of the password, never the password. */
export async function gateToken(password: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`rithm-changemaker:${password}`));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
