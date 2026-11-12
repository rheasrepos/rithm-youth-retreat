# Rithm Youth Retreat

The site for the October 2026 Rithm Youth Retreat: the Changemaker Network map, the sticky-note wall and the zine.

## The network map

A small Next.js site that renders the Rithm Youth Retreat sticky notes (verbatim), the organizations in the Changemaker Network with linked evidence for each placement, and the problems nobody in the network is on yet. Data lives in a Google Sheet so the Rithm team can keep it current without touching code; the site rebuilds nightly and whenever a submission is approved.

**Pages:** `/` (search + domains) · `/wall` (every sticky note as a photo cutout, in the eight floor piles) · `/domain/[id]` · `/org/[id]` · `/untapped` (computed, never stored) · `/people` · `/submit` (form → review queue).

## How data flows

```
Google Sheet (10 tabs)  ──read, hourly cache──▶  Next.js pages on Vercel
        ▲                                              │
        └── /api/submit appends to "submissions" ◀── form on /submit
   Rithm team reviews a row, copies it into the real tabs, sets status=approved,
   then the nightly cron (or a manual hit of /api/revalidate) republishes.
```

If `SHEET_ID` is not set the site builds from `data/seed.json`, so it always runs.

## Setup (about 20 minutes)

### 1. Create the Google Sheet

1. In Google Drive: **New → File upload**, choose `data/seed.xlsx`.
2. Open it, then **File → Save as Google Sheets** (Drive may offer to open it directly as a Sheet; either way you want a native Google Sheet, not the .xlsx).
3. Rename it to something like *Rithm Network Map — data*. The URL contains the sheet ID: `https://docs.google.com/spreadsheets/d/`**`<SHEET_ID>`**`/edit`.
4. Leave the tab names and header rows exactly as they are. The `README` tab explains each table.

### 2. Create a service account (lets the site read the sheet and append submissions)

1. Go to [console.cloud.google.com](https://console.cloud.google.com), create a project (e.g. *rithm-youth-retreat*).
2. **APIs & Services → Enable APIs** → enable **Google Sheets API**.
3. **IAM & Admin → Service Accounts → Create**. Name it `network-map-site`. No roles needed.
4. Open it → **Keys → Add key → JSON**. A file downloads; keep it private.
5. Back in the Google Sheet, **Share** it with the service account's email (it looks like `network-map-site@…iam.gserviceaccount.com`) as **Editor**.

### 3. Deploy on Vercel

1. Push this repo to GitHub and import it in Vercel (framework: Next.js, defaults are fine).
2. **Settings → Environment Variables**, add:
   - `SHEET_ID` — from step 1.
   - `GOOGLE_SERVICE_ACCOUNT_JSON` — paste the whole contents of the key file as one line.
   - `CRON_SECRET` — any long random string (`openssl rand -hex 32`). Vercel uses it to authenticate the nightly cron, and you use it for manual refreshes.
   - `NEXT_PUBLIC_CONTACT_EMAIL` — optional; defaults to info@therithmproject.org.
3. Deploy. `vercel.json` schedules `/api/revalidate` daily at 09:00 UTC.

Local development: copy `.env.example` to `.env.local`, fill it in (or leave it empty to use the seed), then `npm install && npm run dev`.

## Reviewing submissions (the Rithm team's loop)

1. Open the sheet's `submissions` tab. New rows arrive with `status = unreviewed`.
2. Open the link. Decide whether it is specific to the note (→ `verified`) or just in the area (→ `nearby`).
3. Copy the information into the real tabs:
   - new org → `orgs` (pick a short `id`, e.g. `noso`); new person → `people`;
   - the connection → `theme_orgs` (`theme_id`, `org_id`, `verdict`);
   - the link → `evidence` (`themes` = comma-separated theme ids, `verified_on` = today).
   - For “that building note is mine”: add the person/org, and optionally put their name in the sticky's row.
4. Set the submission's `status` to `approved` (or `rejected`) and add `reviewer_notes`.
5. Either wait for the nightly rebuild or open `https://<your-site>/api/revalidate?secret=<CRON_SECRET>` to publish immediately.

Rules the site applies: a concern is **Untapped** when it has no `verified` org; **nearby-only** when it has only `nearby` ones. Both lists are recomputed on every build. An org with `status` other than `active`, or a sticky with `show = FALSE`, is hidden without being deleted.

## Keeping evidence fresh

Every `evidence` row has `verified_on`. A yearly pass of re-opening links and bumping the date is enough; rows whose link has died can be set to `status = retired` rather than deleted. Nothing on the site is hard-coded to the October 2026 retreat except the hero copy in `app/page.tsx`.

## Repo layout

```
app/            routes (App Router)
components/     ThemeRow, OrgCard, Quote, SearchBox, SubmitForm, …
lib/sheets.ts   Google Sheets read/append with a service account
lib/data.ts     sheet rows → model (themes, orgs, untapped), seed fallback
data/seed.json  initial data (same shape as the sheet)
data/seed.xlsx  the same data as a workbook, for the one-time import
scripts/        seed_to_xlsx.py regenerates the workbook from seed.json
```

## Moving to therithmproject.org later

Point a subdomain (e.g. `map.therithmproject.org`) at the Vercel project, or embed the site; nothing else changes. If Rithm later wants it inside their own CMS, `lib/data.ts` is the only file that knows about Google Sheets.

## The wall

`/wall` shows every sticky note as a photo cutout on the retreat rug, with the Polaroids among them.

**Arranging it yourself.** Run the site on your computer (`npm install`, then `npm run dev`), open `localhost:3000/wall` and press **Edit layout**. Drag notes, Polaroids and the pile labels anywhere; tilt, straighten or restack the selected one from the toolbar (arrow keys nudge, `[` and `]` tilt). **Save layout** writes `data/wall-layout.json`; commit that file and the deployed site uses it. **Reset to piles** goes back to the automatic eight piles. On the deployed site, add `?edit` to the address to try an arrangement; it can't write files there, so Save downloads `wall-layout.json` for you to put in `data/`.

**Background.** In edit mode, **Choose image…** takes a PNG, JPEG or WebP and saves it as `public/wall-background.*`; choose whether it stretches to fill the rug or tiles. **Use the rug** returns to `public/rug.jpg`, a patch cropped from the floor photo.

**Files.** Note images are in `public/stickies/` (640px WebP made from the original cutouts, with blown-out white areas recoloured, faint ink darkened and cut-off notes squared), matched to rows by the `photo` column of the `stickies` tab; sizes are in `data/sticky-images.json`. A note with `show = FALSE` is left off the wall and its image sits in `stickies-hidden/`. Any image in `public/polaroids/` appears as a Polaroid. To add a note: add its row to the sheet, drop a `.webp` with the same base name into `public/stickies/`, and add its width and height to `data/sticky-images.json`.

## The zine

`/zine` is the retreat zine as a book: the small arrow in the bottom corner turns the page with a flip (arrow keys work too; on a phone it shows one page at a time).

**Laying it out.** Run the site on your computer (`npm run dev`), open `localhost:3000/zine` and press **Edit the zine**. You work on one page at a time: add text boxes and images, paste an image straight from the clipboard, or drop one on the page. Drag to move, drag the corner dot to resize, drag the top dot to rotate; double-click a text box to type. Each text box has its own font, size, colour, bold/italic and alignment. Pages can be added, reordered, recoloured and (when empty) deleted. **Save zine** writes `data/zine.json` and puts pasted images in `public/zine/`; commit both. On the deployed site, `/zine?edit` opens the editor but can't write files, so Save downloads `zine.json` (with images embedded) to put in `data/`.

Pages are 5.5 × 8.5 (half-letter, portrait); change `ratio` in `data/zine.json` for another shape. Until that file exists the zine starts with 16 pages titled from the page plan.
