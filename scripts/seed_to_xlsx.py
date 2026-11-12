"""Writes data/seed.json as a multi-tab workbook (data/seed.xlsx).
Upload it to Google Drive and let Drive convert it: you get the Google Sheet the site reads, one tab per table.
Usage: python3 scripts/seed_to_xlsx.py
"""
import json, os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
seed = json.load(open(os.path.join(ROOT, "data", "seed.json"), encoding="utf-8"))
COLS = {
    "domains": ["id", "name", "description", "sort"],
    "themes": ["id", "domain_id", "label", "sort"],
    "stickies": ["id", "domain_id", "theme_id", "kind", "text", "color", "uncertain", "show", "photo", "sort"],
    "orgs": ["id", "name", "url", "blurb", "domains", "funder", "retreat_note", "status"],
    "people": ["name", "org_id", "org_name", "note", "status"],
    "theme_orgs": ["theme_id", "org_id", "verdict", "note"],
    "evidence": ["id", "org_id", "title", "what", "url", "year", "themes", "verified_on", "submitted_by", "status"],
    "links": ["a_theme", "b_theme", "label", "note"],
    "workshops": ["who", "what", "target_id", "note"],
    "submissions": ["timestamp", "type", "name", "email", "org", "url", "message", "theme_id", "sticky_id", "status", "reviewer_notes"],
}
WIDTH = {"text": 70, "blurb": 60, "what": 70, "title": 45, "url": 40, "description": 60, "label": 40, "note": 50, "message": 60, "name": 32, "retreat_note": 50}
wb = Workbook(); wb.remove(wb.active)
head_font = Font(bold=True); head_fill = PatternFill("solid", fgColor="FFE3EA")
for tab, cols in COLS.items():
    ws = wb.create_sheet(tab)
    ws.append(cols)
    for c in ws[1]:
        c.font = head_font; c.fill = head_fill
    for row in seed.get(tab, []):
        ws.append([str(row.get(c, "")) for c in cols])
    for i, c in enumerate(cols, 1):
        ws.column_dimensions[get_column_letter(i)].width = WIDTH.get(c, 16)
    ws.freeze_panes = "A2"
    for r in ws.iter_rows(min_row=2):
        for cell in r:
            cell.alignment = Alignment(wrap_text=True, vertical="top")
# README tab
ws = wb.create_sheet("README", 0)
notes = [
    ["Rithm Changemaker Network Map — data"],
    [""],
    ["This workbook is the source of truth for the map site. Each tab is a table; the first row is the column names the site reads. Add rows, don't rename columns."],
    ["Tab", "What goes here"],
    ["domains", "The eight domains. id is used in URLs (/domain/rel)."],
    ["themes", "Clusters of sticky notes inside a domain. id must be unique; domain_id must match a domain."],
    ["stickies", "Every sticky note, verbatim. theme_id ties a concern to a cluster; leave it blank for working_on / other notes. show=FALSE hides a note from the site (used for the personal ones)."],
    ["orgs", "Organizations. domains is a comma-separated list of domain ids. status=active shows; anything else hides."],
    ["people", "Network members. org_id links to orgs; leave it blank and fill org_name for people without a mapped org."],
    ["theme_orgs", "Which org sits next to which cluster, and whether the link is verified (has linked evidence) or nearby (works in the area only). The Untapped list is computed from this tab."],
    ["evidence", "Named projects/reports/laws with a URL. themes = comma-separated theme ids the item is evidence for. verified_on = date someone last checked the link."],
    ["links", "Cross-domain connections between two themes, shown as notes on both."],
    ["workshops", "Retreat workshop mentions. target_id is a theme id or a sticky id."],
    ["submissions", "Written by the website's form. status starts as unreviewed. To approve: copy the information into orgs / people / evidence / theme_orgs, set status=approved, then rebuild the site (nightly, or hit the revalidate URL)."],
]
for n in notes: ws.append(n)
ws["A1"].font = Font(bold=True, size=14); ws["A4"].font = head_font; ws["B4"].font = head_font
ws.column_dimensions["A"].width = 18; ws.column_dimensions["B"].width = 120
for r in ws.iter_rows(min_row=3):
    for cell in r: cell.alignment = Alignment(wrap_text=True, vertical="top")
out = os.path.join(ROOT, "data", "seed.xlsx")
wb.save(out); print("wrote", out, os.path.getsize(out), "bytes")
