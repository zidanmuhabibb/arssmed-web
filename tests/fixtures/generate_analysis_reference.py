"""
Dataset SINTETIS + hasil hitung rujukan untuk kriteria selesai M7 (PRD §15):
"Hasil aplikasi = hasil hitung referensi pada dataset sintetis".

Jalankan:  python3 tests/fixtures/generate_analysis_reference.py
Hasil:     tests/fixtures/analysis-synthetic.json  (jawaban mentah, tanpa kategori)
           tests/fixtures/analysis-reference.json  (hasil hitung pandas/NumPy/SciPy)

Perhitungan di sini SENGAJA ditulis ulang dari PRD (§6.2–§6.5, §7.1, §7.4) dan berkas data
(data/items.json, data/rule-sets/pedoman-v1.json), tanpa memakai kode TypeScript aplikasi,
agar menjadi pembanding yang independen. Bukan data siswa nyata.
"""
import json
import math
import pathlib

import numpy as np
import pandas as pd
import scipy
from scipy import stats

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "tests" / "fixtures"
ITEMS = json.loads((ROOT / "data" / "items.json").read_text())
RULES = json.loads((ROOT / "data" / "rule-sets" / "pedoman-v1.json").read_text())
CATS = ["SC", "M", "E", "LK", "LC"]
rng = np.random.default_rng(20261008)

# ---------------------------------------------------------------------------
# 1. Dataset sintetis
# ---------------------------------------------------------------------------
CLASSES = [{"id": "syn-class-a", "name": "6A (sintetis)"}, {"id": "syn-class-b", "name": "6B (sintetis)"}]
ALPH = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def pseudo():
    return "P-" + "".join(rng.choice(list(ALPH), 8))


students = []
for cls, n in (("syn-class-a", 20), ("syn-class-b", 12)):
    for k in range(1, n + 1):
        students.append({
            "id": f"{cls}-s{k:02d}",
            "pseudo_id": pseudo(),
            "code": f"S{k:02d}",
            "nickname": None,
            "class_id": cls,
            "consent": "granted",
            "pre_submitted": True,
            "post_submitted": True,
        })
by_id = {s["id"]: s for s in students}
# Kasus tepi (kelas A)
CEILING = "syn-class-a-s05"           # semua SC di pretest → N-Gain tak terdefinisi
by_id["syn-class-a-s18"]["post_submitted"] = False   # posttest belum selesai
by_id["syn-class-a-s19"].update(consent="pending", pre_submitted=False, post_submitted=False)
by_id["syn-class-a-s20"]["consent"] = "withdrawn"    # punya data, wajib dikeluarkan
by_id["syn-class-b-s12"]["post_submitted"] = False

items = ITEMS["items"]
# Distraktor "populer" per butir agar peta butir bermakna
popular = {it["item_order"]: (
    rng.choice([o["key"] for o in it["content"]["tier1"]["options"] if o["key"] != it["content"]["tier1"]["correct"]]),
    rng.choice([o["key"] for o in it["content"]["reason"]["options"] if o["key"] != it["content"]["reason"]["correct"]]),
) for it in items}
difficulty = {it["item_order"]: rng.normal(0, 0.8) for it in items}


def wrong(options, correct, pop):
    others = [o["key"] for o in options if o["key"] != correct]
    return pop if rng.random() < 0.6 else rng.choice(others)


responses = []
day = {"pre": "2026-08-03", "post": "2026-09-14"}
for s in students:
    theta = rng.normal(0, 1)
    for phase in ("pre", "post"):
        if not s[f"{phase}_submitted"]:
            continue
        shift = -0.3 if phase == "pre" else 1.7
        for it in items:
            c = it["content"]
            o = it["item_order"]
            if s["id"] == CEILING and phase == "pre":
                a_ok, r_ok, ca, cr = True, True, 0, 0
            else:
                p = 1 / (1 + math.exp(-(theta + shift - difficulty[o])))
                a_ok = rng.random() < p
                r_ok = rng.random() < (p + 0.15 if a_ok else p - 0.2)
                ca = 0 if rng.random() < (0.88 if a_ok else 0.55) else 1
                cr = 0 if rng.random() < (0.85 if r_ok else 0.5) else 1
            t1 = c["tier1"]["correct"] if a_ok else wrong(c["tier1"]["options"], c["tier1"]["correct"], popular[o][0])
            rs = c["reason"]["correct"] if r_ok else wrong(c["reason"]["options"], c["reason"]["correct"], popular[o][1])
            minute = 10 + o
            responses.append({
                "student_id": s["id"], "phase": phase, "item_order": o,
                "tier1": str(t1), "reason": str(rs), "conf_a": int(ca), "conf_r": int(cr),
                "answered_at": f"{day[phase]}T08:{minute:02d}:{int(rng.integers(0, 60)):02d}Z",
                "response_time_ms": int(rng.integers(8000, 90000)),
                "answer_changes": int(rng.choice([0, 0, 0, 1, 2])),
            })

dataset = {
    "description": "Dataset sintetis (bukan data siswa nyata) untuk uji M7. Dibuat oleh generate_analysis_reference.py.",
    "seed": 20261008,
    "test_name": ITEMS["test_name"],
    "test_version": ITEMS["test_version"],
    "rule_set_id": RULES["rule_set_id"],
    "classes": CLASSES,
    "students": students,
    "responses": responses,
}

# ---------------------------------------------------------------------------
# 2. Hitung rujukan (independen)
# ---------------------------------------------------------------------------
item_df = pd.DataFrame([{
    "item_order": it["item_order"],
    "item_code": it.get("item_code") or f"B{it['item_order']:02d}",
    "concept_domain": it["content"]["concept_domain"],
    "report_domain": it["content"]["report_domain"],
    "a_key": it["content"]["tier1"]["correct"],
    "r_key": it["content"]["reason"]["correct"],
    "threshold": it["content"]["confidence"]["threshold_index"],
} for it in items])
rule_table = {(r["A"], r["CA"], r["R"], r["CR"]): r["category"] for r in RULES["rules"]}

df = pd.DataFrame(responses).merge(item_df, on="item_order")
df["a_correct"] = df["tier1"] == df["a_key"]
df["r_correct"] = df["reason"] == df["r_key"]
df["ca"] = df["conf_a"] <= df["threshold"]
df["cr"] = df["conf_r"] <= df["threshold"]
df["confident"] = df["ca"] & df["cr"]
df["category"] = [rule_table[(a, ca, r, cr)] for a, ca, r, cr in zip(df.a_correct, df.ca, df.r_correct, df.cr)]
stu = pd.DataFrame(students)
df = df.merge(stu[["id", "pseudo_id", "class_id", "consent"]], left_on="student_id", right_on="id")
N_ITEMS = len(items)

PATTERN = {("SC", "SC"): "retention", ("M", "SC"): "revision", ("E", "SC"): "revision", ("M", "LC"): "revision",
           ("M", "E"): "revision", ("LK", "SC"): "construction", ("M", "M"): "static", ("E", "E"): "static",
           ("SC", "E"): "static"}
PRIORITY = ["M", "E", "LK", "LC", "SC"]


def pattern(a, b):
    return PATTERN.get((a, b), "other")


def dominant(cats):
    counts = pd.Series(cats).value_counts()
    top = counts.max()
    return next(c for c in PRIORITY if counts.get(c, 0) == top)


def clean(x):
    if isinstance(x, float) and not math.isfinite(x):
        return None
    return x


def scope_reference(scope_students):
    s = stu[stu.id.isin(scope_students)]
    granted = s[s.consent == "granted"]
    excluded = {"consent_withdrawn": int((s.consent == "withdrawn").sum()), "consent_pending": int((s.consent == "pending").sum()),
                "pre_incomplete": int(((s.consent == "granted") & ~s.pre_submitted).sum()),
                "post_incomplete": int(((s.consent == "granted") & s.pre_submitted & ~s.post_submitted).sum())}
    paired = sorted(granted[granted.pre_submitted & granted.post_submitted].id)
    d = df[df.student_id.isin(paired)]

    # §6.4 distribusi per domain
    dist = {}
    for phase in ("pre", "post"):
        rows = []
        for dom, g in d[d.phase == phase].groupby("concept_domain"):
            counts = g.category.value_counts()
            n = len(g)
            rows.append({"domain": dom, "n_responses": n, "n_students": g.student_id.nunique(), "n_items": g.item_order.nunique(),
                         "counts": {c: int(counts.get(c, 0)) for c in CATS},
                         "percent": {c: float(counts.get(c, 0) / n * 100) for c in CATS}})
        dist[phase] = sorted(rows, key=lambda r: r["domain"])

    # FR-43 peta butir
    item_map = {}
    for phase in ("pre", "post"):
        rows = []
        for o, g in d[d.phase == phase].groupby("item_order"):
            def most(col):
                vc = g[col].value_counts()
                top = vc.max()
                key = sorted(k for k, v in vc.items() if v == top)[0]
                return {"key": key, "count": int(top)}
            cnt = g.category.value_counts()
            rows.append({"item_order": int(o), "n": len(g), "m_count": int(cnt.get("M", 0)),
                         "counts": {c: int(cnt.get(c, 0)) for c in CATS},
                         "top_tier1": most("tier1"), "top_reason": most("reason")})
        rows.sort(key=lambda r: (-r["m_count"], r["item_order"]))
        item_map[phase] = rows

    # Skor (§6.3) per siswa berpasangan
    def scores(method):
        hit = d.category.eq("SC") if method == "score_sc" else d.a_correct
        t = d.assign(hit=hit).groupby(["student_id", "phase"]).hit.sum().unstack() / N_ITEMS * 100
        return t.loc[paired]

    out_stats = {}
    for method in ("score_sc", "score_tier1"):
        sc = scores(method)
        pre, post = sc["pre"].to_numpy(float), sc["post"].to_numpy(float)
        with np.errstate(divide="ignore", invalid="ignore"):
            g = np.where(pre == 100, np.nan, (post - pre) / (100 - pre))
        gd = g[~np.isnan(g)]
        gm, gs = gd.mean(), gd.std(ddof=1)
        tcrit = stats.t.ppf(0.975, len(gd) - 1)
        cat = lambda v: "tinggi" if v >= 0.7 else ("sedang" if v >= 0.3 else "rendah")
        diff = post - pre
        tt = stats.ttest_rel(post, pre)
        ci = tt.confidence_interval(0.95)
        dz = diff.mean() / diff.std(ddof=1)
        dfree = len(diff) - 1
        w = stats.wilcoxon(post, pre)
        wa = stats.wilcoxon(post, pre, method="asymptotic")
        sh = stats.shapiro(diff)

        def kr20(phase):
            hit = d.category.eq("SC") if method == "score_sc" else d.a_correct
            m = d.assign(hit=hit.astype(int))[d.phase == phase].pivot(index="student_id", columns="item_order", values="hit").loc[paired].to_numpy()
            k = m.shape[1]
            p = m.mean(axis=0)
            var = m.sum(axis=1).var(ddof=0)
            return {"kr20": float(k / (k - 1) * (1 - (p * (1 - p)).sum() / var)), "k": int(k), "n": int(m.shape[0])}

        out_stats[method] = {
            "students": [{"id": sid, "pre": float(a), "post": float(b), "n_gain": clean(float(x))} for sid, a, b, x in zip(paired, pre, post, g)],
            "pre_mean": float(pre.mean()), "pre_sd": float(pre.std(ddof=1)),
            "post_mean": float(post.mean()), "post_sd": float(post.std(ddof=1)),
            "ngain": {"mean": float(gm), "sd": float(gs), "n": int(len(gd)), "excluded_pre_max": int(np.isnan(g).sum()),
                      "ci_low": float(gm - tcrit * gs / math.sqrt(len(gd))), "ci_high": float(gm + tcrit * gs / math.sqrt(len(gd))),
                      "category": cat(gm), "categories": {c: int(sum(1 for v in gd if cat(v) == c)) for c in ("tinggi", "sedang", "rendah")}},
            "ttest": {"t": float(tt.statistic), "p": float(tt.pvalue), "df": int(tt.df), "ci_low": float(ci.low), "ci_high": float(ci.high),
                      "mean_diff": float(diff.mean()), "sd_diff": float(diff.std(ddof=1)), "cohen_dz": float(dz),
                      "hedges_gz": float(dz * (1 - 3 / (4 * dfree - 1)))},
            "wilcoxon": {"W": float(w.statistic), "p": float(w.pvalue), "z": float(wa.zstatistic), "n_zero": int((diff == 0).sum())},
            "shapiro": {"W": float(sh.statistic), "p": float(sh.pvalue)},
            "kr20_pre": kr20("pre"), "kr20_post": kr20("post"),
        }

    # §6.5 transisi
    trans = {}
    for mode in ("per_butir", "modus"):
        res = []
        for dom, g in d.groupby("concept_domain"):
            if mode == "per_butir":
                piv = g.pivot_table(index=["student_id", "item_order"], columns="phase", values="category", aggfunc="first")
                pairs = list(zip(piv["pre"], piv["post"]))
            else:
                pairs = [(dominant(gg[gg.phase == "pre"].category), dominant(gg[gg.phase == "post"].category)) for _, gg in g.groupby("student_id")]
            counts = {p: 0 for p in ("retention", "revision", "construction", "static", "other")}
            matrix = {a: {b: 0 for b in CATS} for a in CATS}
            for a, b in pairs:
                counts[pattern(a, b)] += 1
                matrix[a][b] += 1
            res.append({"domain": dom, "n_units": len(pairs), "pattern_counts": counts, "matrix": matrix})
        trans[mode] = res

    # §7.4 ekspor
    long_rows = df[df.student_id.isin(granted[granted.pre_submitted | granted.post_submitted].id) & (df.consent == "granted")]
    long_rows = long_rows.sort_values(["pseudo_id", "phase", "item_order"], key=lambda c: c.map({"pre": 0, "post": 1}) if c.name == "phase" else c)
    wide = []
    sc_all = (df[df.consent == "granted"].assign(hit=df.category.eq("SC")).groupby(["student_id", "phase"]).hit.sum().unstack() / N_ITEMS * 100)
    for _, st in granted.sort_values("pseudo_id").iterrows():
        if not (st.pre_submitted or st.post_submitted):
            continue
        pre = sc_all.loc[st.id, "pre"] if st.pre_submitted else None
        post = sc_all.loc[st.id, "post"] if st.post_submitted else None
        row = {"student_pseudo_id": st.pseudo_id, "score_pre": None if pre is None else float(pre), "score_post": None if post is None else float(post)}
        row["delta"] = None if pre is None or post is None else float(post - pre)
        ng = None if row["delta"] is None or pre == 100 else float((post - pre) / (100 - pre))
        row["n_gain"] = ng
        row["n_gain_category"] = None if ng is None else ("tinggi" if ng >= 0.7 else "sedang" if ng >= 0.3 else "rendah")
        mine = df[df.student_id == st.id]
        for dom in sorted(item_df.concept_domain.unique()):
            if pre is None or post is None:
                row[f"transition_{dom}"] = None
            else:
                a = dominant(mine[(mine.phase == "pre") & (mine.concept_domain == dom)].category)
                b = dominant(mine[(mine.phase == "post") & (mine.concept_domain == dom)].category)
                row[f"transition_{dom}"] = pattern(a, b)
        wide.append(row)

    return {
        "n_scope": int(len(s)),
        "paired": paired,
        "excluded_by_reason": excluded,
        "distribution": dist,
        "item_map": item_map,
        "stats": out_stats,
        "transitions": trans,
        "export": {
            "long_count": int(len(long_rows)),
            "long_keys": [f"{r.pseudo_id}|{r.phase}|{r.item_code}|{r.category}|{str(r.a_correct).lower()}|{str(r.r_correct).lower()}|{str(r.confident).lower()}" for r in long_rows.itertuples()],
            "wide": wide,
        },
    }


reference = {
    "generated_with": {"python": "3", "pandas": pd.__version__, "numpy": np.__version__, "scipy": scipy.__version__},
    "rule_set_id": RULES["rule_set_id"],
    "scopes": {
        "all": scope_reference([s["id"] for s in students]),
        "syn-class-a": scope_reference([s["id"] for s in students if s["class_id"] == "syn-class-a"]),
    },
}

(OUT / "analysis-synthetic.json").write_text(json.dumps(dataset, ensure_ascii=False, separators=(",", ":")) + "\n")
(OUT / "analysis-reference.json").write_text(json.dumps(reference, ensure_ascii=False, indent=1) + "\n")
print("OK", len(students), "siswa,", len(responses), "respons")
