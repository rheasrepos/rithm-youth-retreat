"""Builds data/wall-layout.json so each pile on /wall sits the way it did on the floor.
Input: data/floor-slots.json (sticky centres, colours and tilts detected in the floor photos, in note-widths from the label).
Notes are matched to detected spots by colour, nearest the label first; a note with no spot of its colour takes a spare
spot, and any still left over go in a ring just outside the pile. Run: python3 scripts/wall_layout_from_floor.py"""
import json, math, random
seed = json.load(open('data/seed.json')); dims = json.load(open('data/sticky-images.json')); slots = json.load(open('data/floor-slots.json'))
ROWS = [["wor", "sch"], ["rel", "phy"], ["com"], ["tec", "cul"], ["pol"]]; NOTE = 5.2; REACH = 4.6; FIT = 4.3
norm = lambda c: {'yellow-green': 'green', 'light blue': 'blue', 'yellow': 'green'}.get(c, c)
by = {}
for s in sorted(seed['stickies'], key=lambda s: float(s.get('sort') or 0)):
    if s['photo'] in dims and str(s.get('show', 'TRUE')).upper() != 'FALSE': by.setdefault(s['domain_id'], []).append(s)
placed = {}
for dom, notes in by.items():
    rnd = random.Random(dom)
    free = sorted([p for p in slots[dom] if math.hypot(p['x'], p['y']) <= REACH], key=lambda p: math.hypot(p['x'], p['y']))
    pos, rest = {}, []
    for n in notes:
        c = norm(n['color'].lower()); m = next((p for p in free if p['color'] == c), None)
        if m: free.remove(m); pos[n['id']] = m
        else: rest.append(n)
    rest2 = []
    for n in rest:
        if free: pos[n['id']] = free.pop(0)
        else: rest2.append(n)
    R = max([math.hypot(p['x'], p['y']) for p in pos.values()] + [2]) + 0.55; a0 = rnd.uniform(0, 6.283)
    for i, n in enumerate(rest2):
        a = a0 + i / max(1, len(rest2)) * 6.283
        pos[n['id']] = {'x': R * math.cos(a), 'y': R * math.sin(a) * .9, 'rot': rnd.uniform(-20, 20)}
    R = max(math.hypot(p['x'], p['y']) for p in pos.values()) + 0.75; k = min(1, FIT / R)
    placed[dom] = ({i: {'x': p['x'] * k, 'y': p['y'] * k, 'rot': p['rot']} for i, p in pos.items()}, R * k)
    print(dom, 'notes', len(notes), 'ring', len(rest2), 'radius', round(R, 2), 'scale', round(k, 2))
items = {}; y = 3
for ids in ROWS:
    rowH = max(placed[d][1] * 2 * NOTE for d in ids)
    for i, d in enumerate(ids):
        cx = 50 if len(ids) == 1 else 27 + i * 46; cy = y + rowH / 2; rnd = random.Random(d + 'z')
        items[f'label-{d}'] = {'x': cx, 'y': round(cy, 2), 'rot': -2, 'z': 30}
        for nid, p in placed[d][0].items(): items[nid] = {'x': round(cx + p['x'] * NOTE, 2), 'y': round(cy + p['y'] * NOTE, 2), 'rot': p['rot'], 'z': rnd.randint(1, 20)}
    y += rowH + 3
json.dump({'height': round(y), 'items': items}, open('data/wall-layout.json', 'w'), indent=1); print('height', round(y), len(items))
