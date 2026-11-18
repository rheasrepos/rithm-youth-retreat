"""Builds data/zine-quotes.json: for every zine page, every quote that could belong on it (overlap is fine; it is for drafting).
Sources: the sticky notes, the domain summary sheets, Rhea's retreat notebook and workbook, the slides (data/quote-sources.json),
the Granola transcript pull (quote-pull.md in the retreat folder) and Rhea's own pasted notes (data/rhea-notes.json).
Nothing is reworded. First-summit (April) lines and family/personal notebook lines are left out. Run again after pages change:
    python3 scripts/build_zine_quotes.py"""
import json, os, re, collections
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RETREAT = os.environ.get("ZINE_LIBRARY") or os.path.expanduser("~/Desktop/rithmyouthretreat")
if not os.path.isdir(RETREAT): RETREAT = os.path.expanduser("~/mnt/rithmyouthretreat")
zine = json.load(open(f"{ROOT}/data/zine.json"))

def page_key(p):
    t = sorted([i for i in p["items"] if i["type"] == "text"], key=lambda i: i["y"])
    found = []
    names = "\n".join((i.get("title") or "") + "\n" + (i.get("text") or "")[:60] for i in t)
    for key, pat in [("cover", r"OVERHEARD RITHM"), ("before", r"Before this weekend"), ("cocreation", r"co-creation"), ("room", r"Who was in the room"), ("friday", r"^\s*(Friday|Arriving)\s*$"),
                     ("gray", r"Leading in the gray"), ("ymca", r"Saturday morning at the YMCA|Youth Leadership Identity"), ("checkin", r"One word each"), ("mapping", r"Ecosystem mapping"), ("gap", r"^\s*The gap\s*$"), ("wall", r"What we love, what we fear"),
                     ("domains", r"The eight domains"), ("versus", r"Our summaries"), ("dialogue", r"Practicing dialogue"), ("workshops", r"Ways through"), ("marisol", r"Marisol"),
                     ("night", r"Saturday night|Free discussion"), ("network", r"Changemaker Network"), ("sunday", r"^\s*(Sunday|Closing)\s*$"), ("ournotes", r"^\s*Our notes\s*$"), ("ainotes", r"The AI's notes"),
                     ("feelings", r"Feelings across domains"), ("toolrep", r"Tool or replacement|only in the places it's helpful|tool to replacement"), ("love", r"code to fall in love|freshly written prompt"), ("college", r"on school and university|^\s*College\s*$"), ("zines", r"Everyone's zines"), ("back", r"Playlist")]:
        if re.search(pat, names, re.M | re.I): found.append(key)
    return found
pages = collections.defaultdict(list)   # key -> page ids (a page can carry several subjects, and two pages can share one)
for p in zine["pages"]:
    for k in page_key(p): pages[k].append(p["id"])

Q = []   # every quote once
def add(text, src, kind, keys):
    text = text.strip()
    if text: Q.append({"t": text, "src": src, "kind": kind, "keys": set(keys)})

DOM = {"com": "Community & Belonging", "cul": "Culture, Art & Storytelling", "phy": "Physical Spaces & Nature", "pol": "Policy & Institutions", "rel": "Relationships & Personal Life", "sch": "School & Learning", "tec": "Tech & Product Design", "wor": "Workplace & Careers"}
PERSONAL = {("rnb1", i) for i in [11, 14, 17, 18, 19, 20, 21, 23, 24, 25, 26, 27, 28, 29]}   # family and personal lines stay out
for x in json.load(open(f"{ROOT}/data/quote-sources.json")):
    k = x["k"]
    if k.startswith("s1") or k == "hm": continue          # April notebook: ideas only, never quoted; hub maps moved to the website
    for n, line in enumerate(x["lines"]):
        if (k, n) in PERSONAL: continue
        if k.startswith("stk_"): add(line, f"Sticky · {DOM[k[4:]]}", "sticky", ["wall", "domains", "mapping"])
        elif k == "ds": add(line, "Domain summary sheet", "summary", ["versus", "wall", "domains"])
        elif k == "rnb1": add(line, "Rhea's notebook · AI Effect game + Glenda and Chris", "notebook", ["ymca", "dialogue", "ournotes"])
        elif k == "rnb2": add(line, "Rhea's notebook · more than the machine + journal", "notebook", ["ymca", "ournotes"])
        elif k == "rnb3": add(line, "Rhea's notebook · Audrey + Leorah workshops", "notebook", ["workshops", "dialogue", "ournotes"])
        elif k == "rnb0": add(line, "Rhea's notebook · front pages", "notebook", ["before", "cocreation", "gray", "ournotes"])
        elif k == "wb": add(line, "Rhea's retreat workbook", "notebook", ["friday", "ournotes"])
        elif k == "sl": add(line, "Slide or screen", "slide", ["ymca", "friday"])
SEC = {"Friday opening": ["friday", "room"], "Saturday morning: poem, letter, card game, Glenda + Chris": ["ymca", "dialogue"], "One-word check-in": ["checkin", "ymca"],
       "The Wall: ecosystem mapping": ["mapping", "wall", "network"], "Leo's workshop": ["workshops"], "Audrey's workshop": ["workshops", "college"],
       "Leorah's workshop and Saturday close": ["workshops", "dialogue"], "Tab 10: free discussion and mafia": ["night", "dialogue"]}
sec = None
pull = f"{RETREAT}/Claude outputs/quote-pull.md"
for line in open(pull, encoding="utf8"):
    if line.startswith("## "): sec = re.sub(r" \(\d+\)\s*$", "", line[3:].strip())
    m = re.match(r'- (★ )?"(.*)" \(#\d+\)\s*$', line.strip())
    if m and sec: add(m.group(2), f"Granola transcript · {sec} (speech-to-text, check the wording)", "transcript", SEC.get(sec, ["workshops"]))
for q in json.load(open(f"{ROOT}/data/rhea-notes.json"))["quotes"]:
    add(q, "Rhea's notes", "rhea", ["cocreation", "room", "gray", "before"])

THEMES = [   # words that send a quote to more pages, whatever its source
 ("feelings", r"scared|afraid|\bfear|terrif|anxious|overwhelm|left behind|fall behind|falling behind|insecur|lonel|\balone\b|isolat|jealous|burden|\bsad\b|grief|\bhate\b|frustrat|guilty|fomo|tired|courag|friction|inconvenien|discomfort|uncomfortable|tension|texture|serendip|convenience|analog|vinyl|calligraph|detox|\bslop\b|golden age|mourning"),
 ("toolrep", r"chatbot|companion|to ai\b|asked ai|use ai\b|using ai|ai to |ai organize|ai[- ]mediated|\btools?\b|replac|therap|subjective decisions|augment|frictionless|mediat|instead of (going|human)|rant"),
 ("love", r"\blove|dating|hinge|romantic|emotions|feel good|relationship|intima|companion|loved|closer to people|reach out|initiate|friend"),
 ("college", r"college|school|universit|professor|office hours|\bclass(room)?\b|student|k-12|post-grad|learning|education|cheat|homework|higher ed|teacher|academ"),
 ("gap", r"working on|i built|i host|i am:|toolkit|fellowship|field ?building|start ?up|seeding|i'?m interested in|research on|mobiliz|what i wanna work|\bfear|scared|terrif|untapped|solution"),
 ("network", r"working on|i built|i host|toolkit|fellowship|field ?building|network|ecosystem|each of you|projects?\b|organization|community org|mobiliz"),
 ("dialogue", r"debate|dialogue|disagree|depolariz|hot-takes|conversation|listen|witness|erode|it depends|opinion|pro .{0,12}con|complain|bridge|stance|\bsides?\b|agree|understand one another|face to face"),
 ("marisol", r"local model|small ai|privacy|\bdata\b|consent|big ai|open[- ]source|download|on your computer|oligarch|billionaire|monopol|concentration of power|who is creating|companies"),
 ("ainotes", r"ai[- ]generated notes|transcri|note[- ]taking|granola|summar|ai notes"),
 ("ournotes", r"notes|notebook|writing|letter"),
 ("zines", r"zine|craft|artistic|magazine|canva|collage|\bart\b|calligraph|poem|creative|creat(e|ing) "),
 ("sunday", r"one year from|next year|take away|carry|goodbye|last\b.*chapter|mail those"),
 ("cocreation", r"human connection|generation|young people|\byouth|intergenerational|movement|reclaim|gen z|what happens when|free space"),
 ("gray", r"lead|leader|stance|gray|both|nuance|wrong question|inevitab|no choice"),
 ("room", r"young people|\byouth|leader|each of you|first time|co constructing|in this space|silos"),
 ("friday", r"house|arrive|welcome|tech down|names|weekend"),
 ("mapping", r"ecosystem|domain|sticky|experiencing|work being done|work to be done|map"),
 ("back", r"playlist|music|song|credits|thank"),
 ("cover", r"what happens when"),
]
for q in Q:
    low = q["t"].lower()
    for key, pat in THEMES:
        if re.search(pat, low): q["keys"].add(key)

out_pages = {}
for key, ids in pages.items():
    idx = [n for n, q in enumerate(Q) if key in q["keys"]]
    for pid in ids: out_pages[pid] = sorted(set(out_pages.get(pid, [])) | set(idx))
used = {n for v in out_pages.values() for n in v}
json.dump({"made": "by scripts/build_zine_quotes.py", "quotes": [{"t": q["t"], "src": q["src"], "kind": q["kind"]} for q in Q], "pages": out_pages}, open(f"{ROOT}/data/zine-quotes.json", "w"), ensure_ascii=False)
print(len(Q), "quotes;", len(used), "placed on at least one page;", len(Q) - len(used), "on none")
print(collections.Counter(q["kind"] for q in Q))
for n, p in enumerate(zine["pages"]): print(f"  page {n + 1:2d}: {len(out_pages.get(p['id'], [])):4d} quotes  {', '.join(page_key(p))}")
print("pages without a list:", [n + 1 for n, p in enumerate(zine["pages"]) if p["id"] not in out_pages])
