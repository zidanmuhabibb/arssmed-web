"""
Membuat nilai rujukan SciPy untuk verifikasi silang pustaka /lib/stats (PRD §7.2).

Jalankan:  python3 tests/fixtures/generate_scipy_reference.py
Hasil:     tests/fixtures/scipy-reference.json (di-commit; dibaca oleh Vitest)

Dataset bersifat SINTETIS (seed tetap), bukan data siswa nyata.
"""
import json
import math
import pathlib

import numpy as np
import scipy
from scipy import stats

rng = np.random.default_rng(20261007)
out = {"scipy_version": scipy.__version__, "numpy_version": np.__version__, "datasets": {}}


def scores_from_items(n_students, n_items, p_pre, p_post):
    """Skor 0-100 dari butir 0/1 (kelipatan 100/n_items, banyak nilai seri)."""
    ability = rng.normal(0, 1, n_students)
    pre_m = (rng.random((n_students, n_items)) < np.clip(p_pre + 0.12 * ability[:, None], 0.02, 0.98)).astype(int)
    post_m = (rng.random((n_students, n_items)) < np.clip(p_post + 0.12 * ability[:, None], 0.02, 0.98)).astype(int)
    return pre_m, post_m


def paired_block(pre, post):
    pre = np.asarray(pre, dtype=float)
    post = np.asarray(post, dtype=float)
    d = post - pre
    tt = stats.ttest_rel(post, pre)
    ci = tt.confidence_interval(0.95)
    w = stats.wilcoxon(post, pre)
    nz = d[d != 0]
    has_ties = len(np.unique(np.abs(nz))) < len(nz)
    w_asym = stats.wilcoxon(post, pre, method="asymptotic")
    return {
        "pre": pre.tolist(),
        "post": post.tolist(),
        "ttest_rel": {
            "t": float(tt.statistic),
            "p": float(tt.pvalue),
            "df": int(tt.df),
            "ci_low": float(ci.low),
            "ci_high": float(ci.high),
            "mean_diff": float(d.mean()),
            "sd_diff": float(d.std(ddof=1)),
        },
        "wilcoxon": {
            "W": float(w.statistic),
            "p": float(w.pvalue),
            "n_zero": int((d == 0).sum()),
            "has_ties": bool(has_ties),
            "z_asymptotic": float(w_asym.zstatistic),
            "p_asymptotic": float(w_asym.pvalue),
        },
        "shapiro_diff": shapiro_block(d) if len(np.unique(d)) > 1 else None,
    }


def shapiro_block(x):
    r = stats.shapiro(x)
    return {"W": float(r.statistic), "p": float(r.pvalue)}


ds = out["datasets"]

# 1) Ukuran mirip penelitian: 36 siswa × 20 butir, skor kelipatan 5 → banyak seri → asimtotik
pre_m, post_m = scores_from_items(36, 20, 0.35, 0.65)
pre36 = pre_m.sum(1) * 5.0
post36 = post_m.sum(1) * 5.0
ds["paired_n36_items"] = paired_block(pre36, post36)

# 2) n = 10, kontinu tanpa seri → Wilcoxon eksak
pre10 = rng.normal(50, 12, 10).round(3)
post10 = (pre10 + rng.normal(6, 8, 10)).round(3)
ds["paired_n10_exact"] = paired_block(pre10, post10)

# 3) n = 12 dengan seri dan satu nol → permutasi eksak
pre12 = np.array([40, 45, 50, 55, 60, 35, 40, 50, 65, 30, 45, 55], dtype=float)
post12 = np.array([55, 50, 50, 70, 65, 50, 45, 65, 70, 45, 55, 50], dtype=float)
ds["paired_n12_ties"] = paired_block(pre12, post12)

# 4) n = 60 kontinu → asimtotik (n > 50)
pre60 = rng.normal(45, 15, 60).round(4)
post60 = (pre60 + rng.normal(4, 10, 60)).round(4)
ds["paired_n60"] = paired_block(pre60, post60)

# 5) Shapiro-Wilk berbagai n (termasuk cabang n ≤ 11 dan n = 3)
sh = {}
for n in [3, 4, 5, 6, 8, 11, 12, 20, 36, 100, 400]:
    x = rng.gamma(2.0, 3.0, n).round(5) if n % 2 else rng.normal(0, 1, n).round(5)
    sh[str(n)] = {"x": x.tolist(), **shapiro_block(x)}
out["shapiro"] = sh

# 6) Distribusi
out["t_ppf"] = [
    {"p": p, "df": df, "value": float(stats.t.ppf(p, df))}
    for df in [1, 2, 5, 10, 35, 100, 1000]
    for p in [0.6, 0.9, 0.95, 0.975, 0.995, 0.9995]
]
out["t_sf2"] = [
    {"t": t, "df": df, "value": float(2 * stats.t.sf(abs(t), df))}
    for df in [3, 10, 35, 120]
    for t in [0.1, 1.0, 2.03, 4.5, 9.0]
]
out["norm_cdf"] = [{"z": z, "value": float(stats.norm.cdf(z))} for z in [-8, -6, -3.5, -1.96, -0.5, 0, 0.3, 1.64, 3, 7]]
out["norm_ppf"] = [{"p": p, "value": float(stats.norm.ppf(p))} for p in [1e-10, 1e-4, 0.01, 0.025, 0.2, 0.5, 0.8, 0.975, 0.9999]]

# 7) KR-20 dari matriks 0/1 (rumus langsung dengan numpy; varians populasi & sampel)
mat = post_m
k = mat.shape[1]
p = mat.mean(0)
sum_pq = float((p * (1 - p)).sum())
tot = mat.sum(1)
out["kr20"] = {
    "matrix": mat.tolist(),
    "population": float(k / (k - 1) * (1 - sum_pq / tot.var(ddof=0))),
    "sample": float(k / (k - 1) * (1 - sum_pq / tot.var(ddof=1))),
}

# 8) N-Gain dengan satu siswa pre = 100 (harus dikeluarkan)
pre_ng = np.append(pre36[:-1], 100.0)
post_ng = np.append(post36[:-1], 100.0)
g = [(b - a) / (100 - a) for a, b in zip(pre_ng, post_ng) if a < 100]
g = np.array(g)
ci_ng = stats.t.interval(0.95, len(g) - 1, loc=g.mean(), scale=g.std(ddof=1) / math.sqrt(len(g)))
out["ngain"] = {
    "pre": pre_ng.tolist(),
    "post": post_ng.tolist(),
    "mean": float(g.mean()),
    "sd": float(g.std(ddof=1)),
    "n": int(len(g)),
    "excluded": 1,
    "ci_low": float(ci_ng[0]),
    "ci_high": float(ci_ng[1]),
}

path = pathlib.Path(__file__).with_name("scipy-reference.json")
path.write_text(json.dumps(out, indent=1) + "\n")
print(f"Ditulis: {path} (SciPy {scipy.__version__})")
