"""Builds the eight sticky-note piles for the zine from the wall's layout (data/wall-layout.json): each pile is one zine item
holding its real index card (public/zine/card-<domain>.jpg) and every note as its own picture, so readers can press a note.
If the zine already has pile items they are refreshed in place (same spot and size); it also writes data/zine-piles.json.
Run again after moving notes on the wall page:   python3 scripts/wall_piles_to_zine.py"""
import json, math, os
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NOTE, CARD = 5.2, 11.5
lay = json.load(open(f"{ROOT}/data/wall-layout.json"))["items"]
seed = json.load(open(f"{ROOT}/data/seed.json"))
doms = {d["id"]: d["name"] for d in seed["domains"]}
floor = json.load(open(f"{ROOT}/data/wall-floor.json"))["domains"] if os.path.exists(f"{ROOT}/data/wall-floor.json") else {}   # real card size, measured off the floor photos
piles = {}
for dom, name in doms.items():
    parts = []
    c = lay[f"label-{dom}"]; cw, ch = Image.open(f"{ROOT}/public/zine/card-{dom}.jpg").size
    cardw = NOTE * floor[dom]["card_w"] if dom in floor else CARD
    parts.append(("card", c, cardw, cardw * ch / cw, None))
    for s in seed["stickies"]:
        if s["domain_id"] != dom or str(s["show"]).upper() != "TRUE" or s["id"] not in lay: continue
        f = f"zine/stickies/{os.path.splitext(s['photo'])[0]}.webp"
        if not os.path.exists(f"{ROOT}/public/{f}"): continue
        w, h = Image.open(f"{ROOT}/public/{f}").size; parts.append(("note", lay[s["id"]], NOTE, NOTE * h / w, (s, "/" + f)))
    def half(p, w, h):          # half-extent of a rotated rectangle
        a = math.radians(p["rot"]); return (abs(w * math.cos(a)) + abs(h * math.sin(a))) / 2, (abs(w * math.sin(a)) + abs(h * math.cos(a))) / 2
    x0 = min(p["x"] - half(p, w, h)[0] for _, p, w, h, _ in parts); x1 = max(p["x"] + half(p, w, h)[0] for _, p, w, h, _ in parts)
    y0 = min(p["y"] - half(p, w, h)[1] for _, p, w, h, _ in parts); y1 = max(p["y"] + half(p, w, h)[1] for _, p, w, h, _ in parts)
    W, H = x1 - x0, y1 - y0; r = lambda v: round(v, 4)
    item = {"type": "pile", "title": name, "aspect": r(H / W), "notes": []}
    for kind, p, w, h, extra in parts:
        o = {"x": r((p["x"] - x0) / W), "y": r((p["y"] - y0) / H), "w": r(w / W), "rot": p["rot"]}
        if kind == "card": item["card"] = {"src": f"/zine/card-{dom}.jpg", **o}
        else: item["notes"].append({"id": extra[0]["id"], "src": extra[1], **o, "z": p["z"], "text": extra[0]["text"]})
    piles[dom] = item
json.dump(piles, open(f"{ROOT}/data/zine-piles.json", "w"), ensure_ascii=False)
zf = f"{ROOT}/data/zine.json"; z = json.load(open(zf)); n = 0
for pg in z["pages"]:
    for it in pg["items"]:
        if it.get("type") == "pile":
            dom = next((d for d, nm in doms.items() if nm == it.get("title")), None)
            if dom: it.update(card=piles[dom]["card"], notes=piles[dom]["notes"], h=round(it["w"] * piles[dom]["aspect"], 2)); n += 1
if n: json.dump(z, open(zf, "w"), indent=1, ensure_ascii=False)
print({d: (len(p["notes"]), p["aspect"]) for d, p in piles.items()}, "| refreshed in the zine:", n)
