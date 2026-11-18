"""Draws each of the eight sticky-note piles (its label card in the middle, its notes around it, exactly where they sit on
the wall page) as a picture with a see-through background, so the piles can be placed in the zine. Also draws all eight together.
Reads data/wall-layout.json, data/seed.json and public/stickies. Run:  python3 scripts/wall_piles_to_images.py"""
import json, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RETREAT = os.path.expanduser("~/Desktop/rithmyouthretreat")
if not os.path.isdir(RETREAT): RETREAT = os.path.expanduser("~/mnt/rithmyouthretreat")
S, NOTE, LABEL = 60, 5.2, 13          # pixels per wall unit; a note is 5.2 units wide, a label card 13
lay = json.load(open(f"{ROOT}/data/wall-layout.json"))["items"]
seed = json.load(open(f"{ROOT}/data/seed.json"))
doms = {d["id"]: d["name"] for d in seed["domains"]}
notes = [s for s in seed["stickies"] if str(s["show"]).upper() == "TRUE" and s["id"] in lay]
def font(size):
    for f in ["/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]:
        if os.path.exists(f): return ImageFont.truetype(f, size)
    return ImageFont.load_default()
def card(text):
    w, h = int(LABEL * S), int(7.5 * S); im = Image.new("RGBA", (w, h), (253, 252, 248, 255)); d = ImageDraw.Draw(im); f = font(int(1.5 * S))
    words, lines, cur = text.split(), [], ""
    for wd in words:
        if d.textlength((cur + " " + wd).strip(), font=f) > w * 0.86 and cur: lines.append(cur); cur = wd
        else: cur = (cur + " " + wd).strip()
    lines.append(cur); lh = int(1.5 * S * 1.15); y = (h - lh * len(lines)) // 2
    for ln in lines: d.text(((w - d.textlength(ln, font=f)) // 2, y), ln, font=f, fill=(27, 16, 55, 255)); y += lh
    return im
def pile(dom):
    parts = [(lay[f"label-{dom}"], card(doms[dom].replace(" & ", " + ")))]
    for s in notes:
        if s["domain_id"] != dom: continue
        f = f"{ROOT}/public/stickies/{os.path.splitext(s['photo'])[0]}.webp"
        if not os.path.exists(f): continue
        im = Image.open(f).convert("RGBA"); w = int(NOTE * S); parts.append((lay[s["id"]], im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)))
    xs = [p["x"] for p, _ in parts]; ys = [p["y"] for p, _ in parts]; pad = 8
    x0, y0 = min(xs) - pad, min(ys) - pad; W, H = int((max(xs) + pad - x0) * S), int((max(ys) + pad - y0) * S)
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for p, im in sorted(parts, key=lambda t: t[0]["z"]):
        r = im.rotate(-p["rot"], expand=True, resample=Image.BICUBIC)      # the wall turns clockwise for positive angles
        cx, cy = int((p["x"] - x0) * S), int((p["y"] - y0) * S); at = (cx - r.width // 2, cy - r.height // 2)
        sh = Image.new("RGBA", r.size, (0, 0, 0, 0)); sh.putalpha(r.getchannel("A").point(lambda a: int(a * 0.35))); sh = sh.filter(ImageFilter.GaussianBlur(S * 0.12))
        out.alpha_composite(sh, (max(0, at[0] + int(S * 0.12)), max(0, at[1] + int(S * 0.18)))) if at[0] >= 0 and at[1] >= 0 else None
        out.alpha_composite(r, (max(0, at[0]), max(0, at[1])))
    return out.crop(out.getbbox())
order = ["wor", "sch", "rel", "phy", "com", "tec", "cul", "pol"]
lib = f"{RETREAT}/stickies:8domains/wall piles"; os.makedirs(lib, exist_ok=True); os.makedirs(f"{ROOT}/public/zine", exist_ok=True)
small = {}
for k, d in enumerate(order, 1):
    im = pile(d); im.save(f"{lib}/{k} {doms[d].replace('&', 'and')}.png")
    z = im.copy(); z.thumbnail((1500, 1500), Image.LANCZOS); z.save(f"{ROOT}/public/zine/wall-{d}.png"); small[d] = z
    print(d, im.size, "->", z.size)
cw, ch = 760, 640; allw = Image.new("RGBA", (cw * 4, ch * 2), (0, 0, 0, 0))
for k, d in enumerate(order):
    z = small[d].copy(); z.thumbnail((cw - 30, ch - 30), Image.LANCZOS); allw.alpha_composite(z, ((k % 4) * cw + (cw - z.width) // 2, (k // 4) * ch + (ch - z.height) // 2))
allw.save(f"{lib}/all eight piles.png"); allw.save(f"{ROOT}/public/zine/wall-all.png"); print("all", allw.size)
json.dump({d: list(small[d].size) for d in order}, open("/tmp/wall-sizes.json", "w"))
