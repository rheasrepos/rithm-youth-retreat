/**
 * Google Sheets access with a service account. Read: values.batchGet over every tab.
 * Write: values.append to the "submissions" tab. If SHEET_ID / GOOGLE_SERVICE_ACCOUNT_JSON are
 * not set, callers fall back to data/seed.json so the site always builds.
 */
import { JWT } from "google-auth-library";
import type { Seed } from "./types";

export const TABS: (keyof Seed)[] = [
  "domains", "themes", "stickies", "orgs", "people", "theme_orgs", "evidence", "links", "workshops", "submissions",
];

export function sheetsConfigured(): boolean {
  return Boolean(process.env.SHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
}

async function accessToken(scope: string): Promise<string> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON!;
  const key = JSON.parse(raw);
  const client = new JWT({ email: key.client_email, key: key.private_key, scopes: [scope] });
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Could not get a Google access token");
  return token;
}

function rowsToObjects<T>(values: string[][] | undefined): T[] {
  if (!values || values.length < 2) return [];
  const header = values[0].map((h) => String(h).trim());
  return values.slice(1)
    .filter((r) => r.some((c) => String(c ?? "").trim() !== ""))
    .map((r) => {
      const o: Record<string, string> = {};
      header.forEach((h, i) => { o[h] = String(r[i] ?? "").trim(); });
      return o as T;
    });
}

/** Reads every tab. Cached by Next's fetch cache for `revalidate` seconds; the nightly cron purges it. */
export async function readSheet(revalidate = 3600): Promise<Seed> {
  const id = process.env.SHEET_ID!;
  const token = await accessToken("https://www.googleapis.com/auth/spreadsheets.readonly");
  const ranges = TABS.map((t) => `ranges=${encodeURIComponent(t)}`).join("&");
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values:batchGet?${ranges}&majorDimension=ROWS`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, next: { revalidate, tags: ["sheet"] } });
  if (!res.ok) throw new Error(`Sheets read failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { valueRanges: { range: string; values?: string[][] }[] };
  const seed = {} as Seed;
  TABS.forEach((tab, i) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (seed as any)[tab] = rowsToObjects(json.valueRanges[i]?.values);
  });
  return seed;
}

/** Appends one row to the submissions tab, matching the header order there. */
export async function appendSubmission(row: Record<string, string>): Promise<void> {
  const id = process.env.SHEET_ID!;
  const token = await accessToken("https://www.googleapis.com/auth/spreadsheets");
  // Read the header so column order is whatever the sheet says, not what the code assumes.
  const headRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent("submissions!1:1")}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  if (!headRes.ok) throw new Error(`Could not read submissions header: ${headRes.status}`);
  const header: string[] = ((await headRes.json()).values?.[0] ?? []).map((h: string) => String(h).trim());
  const values = [header.map((h) => row[h] ?? "")];
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent("submissions!A1")}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ values }) },
  );
  if (!res.ok) throw new Error(`Sheets append failed: ${res.status} ${await res.text()}`);
}
