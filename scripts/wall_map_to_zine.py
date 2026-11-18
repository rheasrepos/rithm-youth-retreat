"""Builds the zine's map of every sticky note: one zine item readers can regroup (on the rug / no groups / by meaning / pulled by the words).
Rug places come from data/wall-layout.json, meaning from data/wall-embedding.json (made by scripts/embed-stickies.mjs).
It refreshes the zine's map item in place, or takes the place of the still picture /zine/wall-all.png the first time.
Run again after either file changes:   python3 scripts/wall_map_to_zine.py"""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NOTE = 5.2
TINT = {"rel": "#e8457a", "wor": "#f08a24", "sch": "#2f8fd8", "com": "#1aa37a", "cul": "#8b5cf6", "tec": "#111111", "pol": "#d43b3b", "phy": "#7a9a1f"}
lay = json.load(open(f"{ROOT}/data/wall-layout.json"))["items"]; seed = json.load(open(f"{ROOT}/data/seed.json")); emb = json.load(open(f"{ROOT}/data/wall-embedding.json"))
floor = json.load(open(f"{ROOT}/data/wall-floor.json"))["domains"] if os.path.exists(f"{ROOT}/data/wall-floor.json") else {}
names = {d["id"]: d["name"] for d in seed["domains"]}; doms = emb["domains"]
zf = f"{ROOT}/data/zine.json"; z = json.load(open(zf)); target = None
for pg in z["pages"]:
    for it in pg["items"]:
        if it.get("type") == "map" or it.get("src") == "/zine/wall-all.png": target = it
assert target, "no map item or wall-all.png picture in the zine to refresh"
if target.get("type") != "map": target.update(type="map", w=96, h=92, y=107.5); target.pop("src", None)
A = target["h"] / target["w"]                       # the box's height over its width
# each pile, in note widths around its card
piles = {}
for d in doms:
    c = lay[f"label-{d}"]; ns = []
    for s in seed["stickies"]:
        if s["domain_id"] != d or str(s["show"]).upper() != "TRUE" or s["id"] not in lay or s["id"] not in emb["notes"]: continue
        f = f"/zine/stickies/{os.path.splitext(s['photo'])[0]}.webp"
        if not os.path.exists(f"{ROOT}/public{f}"): continue
        p = lay[s["id"]]; ns.append((s, f, (p["x"] - c["x"]) / NOTE, (p["y"] - c["y"]) / NOTE, p["rot"], p["z"]))
    cw = floor.get(d, {}).get("card_w", 2.5); xs = [n[2] for n in ns] + [-cw / 2, cw / 2]; ys = [n[3] for n in ns] + [-1, 1]
    piles[d] = dict(notes=ns, cw=cw, x0=min(xs) - 0.75, x1=max(xs) + 0.75, y0=min(ys) - 0.75, y1=max(ys) + 0.75)
# pack the piles in rows of 3, 3, 2, biggest first in each row's middle, then scale to fit the box under the buttons
order = sorted(doms, key=lambda d: -(piles[d]["x1"] - piles[d]["x0"])); rows = [order[0:3], order[3:6], order[6:8]]
roww = [sum(piles[d]["x1"] - piles[d]["x0"] for d in r) for r in rows]; rowh = [max(piles[d]["y1"] - piles[d]["y0"] for d in r) for r in rows]
TOP = 0.07; u = min(1 / max(roww), (1 - TOP) * A / sum(rowh))      # one note width, as a share of the box's width
notes, words = [], []; y = TOP * A / u + ((1 - TOP) * A / u - sum(rowh)) / 2
for r, w, h in zip(rows, roww, rowh):
    gap = (1 / u - w) / (len(r) + 1); x = gap
    for d in r:
        P = piles[d]; cx, cy = x - P["x0"], y + (h - (P["y1"] - P["y0"])) / 2 - P["y0"]
        m = emb["words"][d]; words.append(dict(id=d, name=names[d], tint=TINT.get(d, "#2b2755"), src=f"/zine/card-{d}.jpg", x=round(cx * u, 4), y=round(cy * u / A, 4), w=round(P["cw"] * u, 4), m=[m["x"], m["y"]]))
        for s, f, nx, ny, rot, zz in P["notes"]:
            e = emb["notes"][s["id"]]; notes.append(dict(id=s["id"], src=f, x=round((cx + nx) * u, 4), y=round((cy + ny) * u / A, 4), w=round(u, 4), rot=rot, z=zz, text=s["text"], dom=d, m=[e["x"], e["y"]], sim=e["sim"]))
        x += P["x1"] - P["x0"] + gap
    y += h
words.sort(key=lambda w: doms.index(w["id"]))       # sim is in this order
target.update(title="Every note", notes=notes, words=words)
json.dump(z, open(zf, "w"), indent=1, ensure_ascii=False); print(len(notes), "notes,", len(words), "domain names; one note is", round(u * target["w"], 2), "page units wide on the rug view")
