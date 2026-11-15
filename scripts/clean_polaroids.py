"""Rebalance Polaroid scans so every card's white frame lands on a similar soft white.

Usage: python3 scripts/clean_polaroids.py <src folder> <out folder> [--site]
  --site also overwrites any byte-identical copy in public/zine (pasted into the zine editor) with the cleaned
  version, so pages that already use the photo pick it up without re-placing it. Originals stay in <src folder>.

Each scan's frame colour is measured from the bright half of its outer band, then the whole image gets one gain per
channel that carries that colour most of the way (KEEP) to TARGET. That fixes exposure and colour cast together and
leaves a little card-to-card variation, the way real prints differ.
"""
import hashlib, os, re, sys
import numpy as np
from PIL import Image, ImageOps

TARGET = np.array([243.0, 240.0, 232.0])   # warm paper white
KEEP = 0.85                                 # 1 = identical whites, 0 = untouched

def frame_colour(a):
    h, w = a.shape[:2]; b = max(6, int(min(h, w) * 0.06))
    band = np.concatenate([a[:b].reshape(-1, 3), a[-b:].reshape(-1, 3), a[:, :b].reshape(-1, 3), a[:, -b:].reshape(-1, 3)]).astype(float)
    lum = band @ [0.299, 0.587, 0.114]
    return np.median(band[lum >= np.percentile(lum, 60)], axis=0)

def clean(path):
    im = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    a = np.asarray(im).astype(float)
    f = frame_colour(a)
    goal = f + (TARGET - f) * KEEP
    out = a * (goal / f)
    # soft shoulder so bright areas inside the photo roll off instead of clipping flat
    hi = out > 235; out[hi] = 235 + (out[hi] - 235) * 20 / (out[hi] - 235 + 20)
    return Image.fromarray(np.clip(out, 0, 255).round().astype(np.uint8)), f, goal

if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]; site = "--site" in sys.argv
    os.makedirs(dst, exist_ok=True)
    md5 = lambda p: hashlib.md5(open(p, "rb").read()).hexdigest()
    zine = {md5(os.path.join("public/zine", f)): f for f in os.listdir("public/zine") if f.lower().endswith((".jpg", ".jpeg"))} if site else {}
    for f in sorted(os.listdir(src)):
        if not re.match(r"pola.*\.(jpe?g)$", f, re.I): continue
        p = os.path.join(src, f); im, was, now = clean(p)
        im.save(os.path.join(dst, os.path.splitext(f)[0] + ".jpg"), quality=90, subsampling=0)
        hit = zine.get(md5(p))
        if hit: im.save(os.path.join("public/zine", hit), quality=90, subsampling=0)
        print(f"{f:22s} frame {was.round().astype(int).tolist()} -> {now.round().astype(int).tolist()}" + (f"   site: {hit}" if hit else ""))
