"""Word-frequency and text analysis of the retreat sticky notes, for the zine.

Reads data/seed.json (only notes with show != FALSE, so the 5 hidden notes are never counted), and writes:
  data/sticky-analysis.json    every number the zine pages and site use
  data/sticky-analysis.md      a plain-language summary of the findings
  public/zine/analysis/*.png   print-ready chart pages (zine page shape, 7 x 8.5 in at 300 dpi)

Run from the repo root:  python3 scripts/sticky_analysis.py
"""
import json, math, re, collections, pathlib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = pathlib.Path(__file__).resolve().parent.parent
seed = json.loads((ROOT / "data/seed.json").read_text())
notes = [s for s in seed["stickies"] if str(s.get("show", "")).lower() != "false"]
domains = sorted(seed["domains"], key=lambda d: d["sort"])
dname = {d["id"]: d["name"] for d in domains}
themes = {t["id"]: t["label"] for t in seed["themes"]}

# ---------- tokenising ----------
STOP = set("""a an the and or but if so of to in on at by for from with without into onto over under about as is are was were be been being
am do does did doing have has had having i me my we us our you your he she they them their it its this that these those there here
what which who whom whose when where why how not no nor than then too very can could would should will just more most less much
many some any all each every other such own same also only even still really get got make makes making like want wants feel feels
need needs thing things way ways lot lots one two three etc vs via im dont doesnt isnt cant wont theyre youre ive id ill re s t
going go gets being because while through between up down out off again further once both few
im i'm don't didn't doesn't isn't can't won't they're you're i've it's that's think sometimes abt now done use using
working""".split())
ALIAS = {"ppl": "people", "ai's": "ai", "irl": "in-person", "tech": "technology", "kids": "kid", "youth": "young", "socials": "social"}

def clean(text: str) -> str:
    t = re.sub(r"\[(crossed out|illegible)[^\]]*\]", " ", text, flags=re.I)
    t = re.sub(r"^\s*\d+[.)]\s*", " ", t)                 # list numbers like "1."
    t = re.sub(r"\b3rd\b", "third", t, flags=re.I)
    return t

def words(text: str):
    toks = re.findall(r"[a-z][a-z'\-]*", clean(text).lower().replace("’", "'"))
    out = []
    for w in toks:
        w = w.strip("'-")
        w = ALIAS.get(w, w)
        if w.endswith("'s"): w = w[:-2]
        if len(w) < 2 or w in STOP: continue
        out.append(w)
    return out

tok = {s["id"]: words(s["text"]) for s in notes}
# fold simple plurals into the singular when both appear ("app"/"apps")
vocab = collections.Counter(w for ws in tok.values() for w in ws)
ROOTS = {w: "connection" for w in ("connect", "connects", "connected", "connecting", "connection", "connections", "connectedness", "connectivity", "disconnect", "disconnected")}
ROOTS.update({"disconnect": "disconnection", "disconnected": "disconnection", "disconnection": "disconnection"})   # forms of one root count as one word
def fold(w):
    if w in ROOTS: return ROOTS[w]
    if w.endswith("ies") and w[:-3] + "y" in vocab: return w[:-3] + "y"
    if w.endswith("s") and not w.endswith(("ss", "us", "is")) and w[:-1] in vocab: return w[:-1]
    return w
tok = {k: [fold(w) for w in ws] for k, ws in tok.items()}

# document frequency: how many notes use a word (a note repeating a word counts once)
df = collections.Counter(w for ws in tok.values() for w in set(ws))
bigr = collections.Counter()
for s in notes:
    raw = [ALIAS.get(w, w) for w in re.findall(r"[a-z][a-z'\-]*", clean(s["text"]).lower())]
    raw = [fold(w) for w in raw]
    for a, b in zip(raw, raw[1:]):
        if a not in STOP and b not in STOP: bigr[(a, b)] += 1

by_dom = collections.defaultdict(list)
for s in notes: by_dom[s["domain_id"]].append(s)

# words that show up across many parts of life
spread = {w: sorted({s["domain_id"] for s in notes if w in tok[s["id"]]}) for w in df}
cross = sorted([(w, len(d), df[w]) for w, d in spread.items() if len(d) >= 4], key=lambda x: (-x[1], -x[2]))

# distinctive words per domain: weighted log-odds with an informative Dirichlet prior (Monroe, Colaresi & Quinn 2008),
# comparing each domain's notes with all the other notes. z > 1.96 is roughly "not chance".
total = collections.Counter(w for ws in tok.values() for w in ws)
a0 = sum(total.values())
def logodds(group_ids):
    gi = collections.Counter(w for i in group_ids for w in tok[i])
    gj = total - gi
    ni, nj = sum(gi.values()), sum(gj.values())
    res = []
    for w, aw in total.items():
        yi, yj = gi[w], gj[w]
        if yi < 2: continue
        d = math.log((yi + aw) / (ni + a0 - yi - aw)) - math.log((yj + aw) / (nj + a0 - yj - aw))
        var = 1 / (yi + aw) + 1 / (yj + aw)
        res.append((w, round(d / math.sqrt(var), 2), yi))
    return sorted(res, key=lambda r: -r[1])
distinct = {d: logodds([s["id"] for s in by_dom[d]])[:6] for d in dname}

kinds = collections.Counter(s["kind"] for s in notes)
kind_dom = {d: collections.Counter(s["kind"] for s in by_dom[d]) for d in dname}
concern_ids = [s["id"] for s in notes if s["kind"] == "concern"]
work_ids = [s["id"] for s in notes if s["kind"] == "working_on"]
lens = sorted(len(clean(s["text"]).split()) for s in notes)
said_once = sorted(w for w, c in df.items() if c == 1)

result = {
    "notes": len(notes), "hidden_excluded": len(seed["stickies"]) - len(notes),
    "kinds": kinds, "by_domain": {dname[d]: len(by_dom[d]) for d in dname},
    "kind_by_domain": {dname[d]: kind_dom[d] for d in dname},
    "words_per_note": {"median": lens[len(lens) // 2], "min": lens[0], "max": lens[-1]},
    "top_words": df.most_common(30),
    "top_pairs": [(" ".join(k), v) for k, v in bigr.most_common(20) if v >= 2],
    "cross_cutting": cross[:20],
    "distinctive_by_domain": {dname[d]: distinct[d] for d in dname},
    "concern_words": logodds(concern_ids)[:12], "working_on_words": logodds(work_ids)[:12],
    "words_used_once": len(said_once), "distinct_words": len(df),
}
(ROOT / "data/sticky-analysis.json").write_text(json.dumps(result, indent=1, default=dict))

# ---------- chart pages ----------
INK, PAPER, MUTED = "#1b1037", "#f8f3ea", "#7a7186"   # ink for text
# palette: deeper versions of the sticky-note colours, so marks read on cream paper (checked for colour-blind separation)
BLUE, ORANGE, PURPLE, GREEN, YELLOW = "#1a7fb0", "#d4730f", "#8a4fb0", "#4f9a2c", "#e3b21c"
WORRY, DOING, BOTHC = BLUE, ORANGE, PURPLE
ACCENT = DOING
OUT = ROOT / "public/zine/analysis"; OUT.mkdir(parents=True, exist_ok=True)
plt.rcParams.update({"font.family": "DejaVu Sans", "text.color": INK, "axes.labelcolor": INK, "xtick.color": MUTED, "ytick.color": INK,
                     "axes.edgecolor": MUTED, "font.size": 13})
def page(title, sub):
    fig = plt.figure(figsize=(7, 8.5), dpi=300, facecolor=PAPER)
    fig.text(0.07, 0.95, title, fontsize=22, fontweight="bold", va="top")
    fig.text(0.07, 0.905, sub, fontsize=11.5, color=MUTED, va="top", wrap=True)
    return fig
def bars(ax, labels, vals, color=INK, note=None):
    y = range(len(labels))[::-1]
    ax.barh(list(y), vals, color=color, height=0.62)
    ax.set_yticks(list(y)); ax.set_yticklabels(labels)
    for yy, v in zip(y, vals): ax.text(v + max(vals) * 0.015, yy, str(v), va="center", fontsize=11, color=INK)
    for s in ("top", "right", "bottom"): ax.spines[s].set_visible(False)
    ax.set_xticks([]); ax.set_facecolor(PAPER); ax.set_xlim(0, max(vals) * 1.15)
    ax.tick_params(axis="y", length=0)
def save(fig, name):
    fig.text(0.07, 0.03, f"{len(notes)} sticky notes from the Rithm Youth Retreat, Oct 2026", fontsize=9, color=MUTED)
    fig.savefig(OUT / name, facecolor=PAPER); plt.close(fig)

# 1. how many notes per part of life, split into "worries" vs "already working on"
fig = page("Where our worries landed", "Sticky notes per part of life. Blue: a concern. Orange: something\nsomeone is already working on. Yellow: everything else.")
ax = fig.add_axes([0.42, 0.1, 0.52, 0.76])
order = sorted(dname, key=lambda d: -len(by_dom[d]))
y = list(range(len(order)))[::-1]
c = [kind_dom[d]["concern"] for d in order]; w_ = [kind_dom[d]["working_on"] for d in order]; o = [kind_dom[d]["other"] for d in order]
ax.barh(y, c, color=WORRY, height=0.62); ax.barh(y, w_, left=c, color=DOING, height=0.62, edgecolor=PAPER, linewidth=2)
ax.barh(y, o, left=[a + b for a, b in zip(c, w_)], color=YELLOW, height=0.62, edgecolor=PAPER, linewidth=2)
ax.set_yticks(y); ax.set_yticklabels([dname[d].replace(" & ", " &\n") for d in order])
for yy, d in zip(y, order): ax.text(len(by_dom[d]) + 0.5, yy, str(len(by_dom[d])), va="center", fontsize=11)
for s in ("top", "right", "bottom"): ax.spines[s].set_visible(False)
ax.set_xticks([]); ax.set_facecolor(PAPER); ax.tick_params(axis="y", length=0)
save(fig, "01-where-worries-landed.png")

# 2. most-used words
fig = page("The words we kept writing", "How many notes use each word (common words like \"the\" and\n\"want\" left out; plurals counted with the singular).")
top = df.most_common(18)
bars(fig.add_axes([0.3, 0.08, 0.62, 0.78]), [w for w, _ in top], [v for _, v in top], color=GREEN)
save(fig, "02-words-we-kept-writing.png")

# 3. words that cross the most parts of life
fig = page("Worries that cross every line", "Words that show up in the most different parts of life\n(out of 8), with how many notes use them.")
cc = cross[:14]
ax = fig.add_axes([0.4, 0.08, 0.52, 0.78])
bars(ax, [f"{w}  ({n} notes)" for w, _, n in cc], [k for _, k, _ in cc], color=PURPLE)
ax.set_xlim(0, 8.8)
save(fig, "03-across-every-line.png")

# 4. small multiples: the words that make each domain sound like itself
fig = page("What each corner sounds like", "Words used much more in one part of life than in the rest\n(weighted log-odds, Monroe et al. 2008). Bar = strength.")
for i, d in enumerate(dname):
    r, col = divmod(i, 2)
    ax = fig.add_axes([0.2 + col * 0.47, 0.67 - r * 0.195, 0.3, 0.14])
    top3 = [x for x in distinct[d] if x[1] > 0][:4]
    if top3:
        yy = list(range(len(top3)))[::-1]
        ax.barh(yy, [x[1] for x in top3], color=BLUE, height=0.6)
        ax.set_yticks(yy); ax.set_yticklabels([x[0] for x in top3], fontsize=10)
    ax.text(-0.42, 1.12, dname[d], transform=ax.transAxes, fontsize=11, fontweight="bold")
    for s in ("top", "right", "bottom"): ax.spines[s].set_visible(False)
    ax.set_xticks([]); ax.set_facecolor(PAPER); ax.tick_params(axis="y", length=0)
save(fig, "04-what-each-corner-sounds-like.png")

# 5. worries vs work
fig = page("Worrying vs. doing", "Words that lean toward notes about a concern (left) versus\nnotes about what someone is already working on (right).\nBar = number of notes. (\"working\" itself is left out everywhere:\nit just echoes the prompt.)")
ax1 = fig.add_axes([0.2, 0.08, 0.27, 0.7]); ax2 = fig.add_axes([0.68, 0.08, 0.27, 0.7])
for ax, data, col, ttl in ((ax1, result["concern_words"][:10], WORRY, "worry"), (ax2, result["working_on_words"][:10], DOING, "doing")):
    data = sorted(data, key=lambda x: -x[2])
    bars(ax, [x[0] for x in data], [x[2] for x in data], color=col); ax.set_title(ttl, fontsize=13, loc="left", fontweight="bold")
save(fig, "05-worrying-vs-doing.png")


# 6. worrying vs. doing, per part of life: concerns to the left, "already working on it" to the right
fig = page("Who's worried, who's on it", "Per part of life: notes naming a concern (left) and notes about\nsomething someone is already working on (right).")
ax = fig.add_axes([0.08, 0.1, 0.86, 0.74])
order = sorted(dname, key=lambda d: -(kind_dom[d]["concern"] + kind_dom[d]["working_on"]))
y = list(range(len(order)))[::-1]
cv = [kind_dom[d]["concern"] for d in order]; wv = [kind_dom[d]["working_on"] for d in order]
ax.barh(y, [-v for v in cv], color=WORRY, height=0.5); ax.barh(y, wv, color=DOING, height=0.5)
for yy, d, c_, w2 in zip(y, order, cv, wv):
    ax.text(0, yy + 0.36, dname[d], ha="center", fontsize=10.5, fontweight="bold")
    ax.text(-c_ - 0.4, yy - 0.05, str(c_), ha="right", va="center", fontsize=11)
    ax.text(w2 + 0.4, yy - 0.05, str(w2), ha="left", va="center", fontsize=11)
m_ = max(cv + wv) + 3
ax.set_xlim(-m_, m_); ax.set_ylim(-0.6, len(order) - 0.1); ax.axvline(0, color=MUTED, lw=1)
ax.text(-m_, len(order) - 0.05, "worried about", fontsize=12, color=WORRY, fontweight="bold")
ax.text(m_, len(order) - 0.05, "working on it", fontsize=12, color=DOING, fontweight="bold", ha="right")
ax.axis("off")
save(fig, "06-whos-worried-whos-on-it.png")

# 7. now vs. later: every concern note labelled (by Claude, for Rhea to check) for when the harm happens (data/harm-timeframe.csv)
import csv
tf_path = ROOT / "data/harm-timeframe.csv"
if tf_path.exists():
    tf = list(csv.DictReader(tf_path.open()))
    STEPS = [("L", "happening to me now"), ("N", "happening in the world now"), ("E", "starting / getting worse"), ("F", "might happen in future")]
    SHADES = [PURPLE, BLUE, GREEN, YELLOW]
    cnt = {d: collections.Counter(r["timeframe"] for r in tf if r["domain"] == d) for d in dname}
    tot = collections.Counter(r["timeframe"] for r in tf)
    fig = page("What we fear is already here", f"Each of the {sum(tot[k] for k, _ in STEPS)} notes naming a harm, sorted by when it happens.\n"
               f"({tot['X']} more notes filed as concerns are really a practice, a wish or a question.)")
    ax = fig.add_axes([0.08, 0.6, 0.86, 0.22])          # the headline: totals along the now -> later line
    vals = [tot[k] for k, _ in STEPS]
    ax.bar(range(4), vals, color=SHADES, width=0.7)
    for i, v in enumerate(vals): ax.text(i, v + 1, str(v), ha="center", fontsize=14, fontweight="bold")
    ax.set_xticks(range(4)); ax.set_xticklabels([n.replace(" in ", "\nin ").replace(" / ", " /\n").replace(" in future", "\nin future") for _, n in STEPS], fontsize=10)
    for sp in ("top", "right", "left"): ax.spines[sp].set_visible(False)
    ax.set_yticks([]); ax.set_facecolor(PAPER); ax.tick_params(axis="x", length=0); ax.set_ylim(0, max(vals) * 1.2)
    ax.annotate("", xy=(3.4, -0.33), xytext=(-0.4, -0.33), xycoords=("data", "axes fraction"), arrowprops=dict(arrowstyle="->", color=MUTED))
    ax.text(1.5, -0.42, "now  →  later", transform=ax.get_xaxis_transform(), ha="center", fontsize=10, color=MUTED)
    ax2 = fig.add_axes([0.38, 0.08, 0.56, 0.4])          # by part of life
    order = sorted(dname, key=lambda d: -sum(cnt[d][k] for k, _ in STEPS))
    y = list(range(len(order)))[::-1]
    left = [0] * len(order)
    for (k, _), col in zip(STEPS, SHADES):
        v = [cnt[d][k] for d in order]
        ax2.barh(y, v, left=left, color=col, height=0.62, edgecolor=PAPER, linewidth=1.5)
        left = [a + b for a, b in zip(left, v)]
    for yy, t in zip(y, left): ax2.text(t + 0.3, yy, str(t), va="center", fontsize=10)
    ax2.set_yticks(y); ax2.set_yticklabels([dname[d] for d in order], fontsize=10)
    for sp in ("top", "right", "bottom"): ax2.spines[sp].set_visible(False)
    ax2.set_xticks([]); ax2.set_facecolor(PAPER); ax2.tick_params(axis="y", length=0)
    save(fig, "07-already-here.png")
    result["harm_timeframe"] = {"totals": tot, "by_domain": {dname[d]: cnt[d] for d in dname}}
    (ROOT / "data/sticky-analysis.json").write_text(json.dumps(result, indent=1, default=dict))

# 8. word cloud: size = how many notes use the word; colour = whether those notes are worries or work already under way
try:
    from wordcloud import WordCloud          # pip install wordcloud
    from matplotlib import font_manager
    freq = dict(df)
    phr = {" ".join(k): v for k, v in bigr.items() if v >= 2}
    for ph, v in phr.items():                # keep repeated phrases ("human connection") whole
        freq[ph] = v
        for w in ph.split():
            if w in freq: freq[w] = max(0, freq[w] - v)
    freq = {w: v for w, v in freq.items() if v >= 2}
    low = {s["id"]: " ".join(fold(ALIAS.get(x, x)) for x in re.findall(r"[a-z][a-z'\-]*", clean(s["text"]).lower())) for s in notes}
    def lean(w):
        hits = [s for s in notes if (f" {w} " in f" {low[s['id']]} ")] if " " in w else [s for s in notes if w in tok[s["id"]]]
        c = sum(s["kind"] == "concern" for s in hits); k = sum(s["kind"] == "working_on" for s in hits)
        return c, k
    # colour follows size: rare words in the darkest colour (so small text stays readable), the most-used in yellow
    SIZE_STEPS = [(11, YELLOW), (6, ORANGE), (4, GREEN), (3, PURPLE), (0, BLUE)]
    def colour_by_size(word, **_):
        v = freq.get(word, 0)
        return next(c for lo, c in SIZE_STEPS if v >= lo)
    def colour_by_lean(word, **_):
        c, k = lean(word)
        if c + k == 0: return MUTED
        r = c / (c + k)
        return WORRY if r >= 0.7 else DOING if r <= 0.4 else BOTHC
    bold = font_manager.findfont(font_manager.FontProperties(family="DejaVu Sans", weight="bold"))
    wc = WordCloud(width=1800, height=1900, background_color=PAPER, font_path=bold, prefer_horizontal=0.85, relative_scaling=0.55,
                   min_font_size=22, max_font_size=360, margin=6, color_func=colour_by_size, random_state=7).generate_from_frequencies(freq)
    fig = page("What we wrote, all at once", "Bigger and warmer = more notes use it. Yellow: 11+ notes, orange: 6-10,\ngreen: 4-5, purple: 3, blue: 2. Repeated phrases kept whole.")
    ax = fig.add_axes([0.05, 0.06, 0.9, 0.77]); ax.imshow(wc.to_array(), interpolation="bilinear"); ax.axis("off")
    save(fig, "08-what-we-wrote.png")
    result["word_cloud"] = sorted(freq.items(), key=lambda x: -x[1])
except ImportError:
    print("word cloud image skipped: pip install wordcloud")

# data for the interactive cloud on the site (/words): each word, which notes use it, and the words it travels with
if True:
    freq = dict(df)
    phr = {" ".join(k): v for k, v in bigr.items() if v >= 2}
    for ph, v in phr.items():
        freq[ph] = v
        for w in ph.split():
            if w in freq: freq[w] = max(0, freq[w] - v)
    low = {s["id"]: " " + " ".join(fold(ALIAS.get(x, x)) for x in re.findall(r"[a-z][a-z'\-]*", clean(s["text"]).lower())) + " " for s in notes}
    solo = {}
    for s_ in notes:                       # each note's words with kept phrases taken out
        t = low[s_["id"]]
        for ph in sorted(phr, key=len, reverse=True): t = t.replace(f" {ph} ", " | ")
        solo[s_["id"]] = set(t.split())
    def hits(w):
        return [s for s in notes if f" {w} " in low[s["id"]]] if " " in w else [s for s in notes if w in solo[s["id"]]]
    words_ = [w for w, v in freq.items() if v >= 2]
    ids = {w: [s["id"] for s in hits(w)] for w in words_}
    cloud = []
    for w in words_:
        hs = hits(w)
        co = collections.Counter(o for o in words_ if o != w and o not in w.split() and w not in o.split() for s in hs if s["id"] in ids[o])
        cloud.append({"w": w, "n": len(hs), "concern": sum(s["kind"] == "concern" for s in hs), "working_on": sum(s["kind"] == "working_on" for s in hs),
                      "domains": sorted({s["domain_id"] for s in hs}), "ids": ids[w], "co": [o for o, _ in co.most_common(6)]})
    cloud.sort(key=lambda x: -x["n"])
    (ROOT / "data/word-cloud.json").write_text(json.dumps(cloud, indent=0))
    (ROOT / "data/sticky-analysis.json").write_text(json.dumps(result, indent=1, default=dict))

# ---------- summary ----------
def fmt(lst): return ", ".join(f"{w} ({n})" for w, n in lst)
md = [f"# Sticky-note analysis", "", f"{len(notes)} notes analysed ({result['hidden_excluded']} hidden notes left out). "
      f"{kinds['concern']} are concerns, {kinds['working_on']} say what someone is working on, {kinds['other']} are other.",
      f"Median note length: {result['words_per_note']['median']} words. {result['distinct_words']} different words; "
      f"{result['words_used_once']} of them appear on only one note.", "",
      "## Notes per part of life", *[f"- {k}: {v}" for k, v in sorted(result['by_domain'].items(), key=lambda x: -x[1])], "",
      "## Most-used words (number of notes)", fmt(df.most_common(20)), "",
      "## Repeated word pairs", fmt(result["top_pairs"]) or "none repeat", "",
      "## Words that cross the most parts of life (domains out of 8, notes)", ", ".join(f"{w} ({k}/8, {n})" for w, k, n in cross[:15]), "",
      "## Distinctive words per part of life (word, z-score, notes)"]
md += [f"- **{dname[d]}**: " + ", ".join(f"{w} ({z}, {n})" for w, z, n in distinct[d] if z > 0) for d in dname]
md += ["", "Method: weighted log-odds ratio with an informative Dirichlet prior (Monroe, Colaresi & Quinn 2008, *Political Analysis*). "
       "z above about 2 means the word is unlikely to be that over-represented by chance; with notes this short, treat it as a pointer, not proof."]
if tf_path.exists():
    md += ["", "## Now vs. later (labelled one by one, see data/harm-timeframe.csv)",
           ", ".join(f"{n}: {tot[k]}" for k, n in STEPS) + f"; not a harm: {tot['X']}",
           *[f"- {dname[d]}: " + ", ".join(f"{k} {cnt[d][k]}" for k, _ in STEPS) for d in dname],
           "Labels: L lived now, N happening in the world now, E starting / getting worse, F might happen in future, X not a harm. "
           "Labelled by Claude (AI) from the note text alone; check the rhea_check column before publishing."]
(ROOT / "data/sticky-analysis.md").write_text("\n".join(md) + "\n")
print("\n".join(md))
