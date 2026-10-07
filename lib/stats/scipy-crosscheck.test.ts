/**
 * Verifikasi silang terhadap SciPy (PRD §7.2). Nilai rujukan dibuat oleh
 * tests/fixtures/generate_scipy_reference.py dan di-commit.
 */
import { describe, expect, it } from "vitest";
import ref from "../../tests/fixtures/scipy-reference.json";
import {
  kr20,
  normalCdf,
  normalPpf,
  pairedTTest,
  shapiroWilk,
  studentTPpf,
  studentTTwoSidedP,
  summarizeNGain,
  wilcoxonSignedRank,
} from "./index";

/** Kedekatan relatif (untuk p-value yang bisa sangat kecil) dengan batas absolut. */
function close(actual: number, expected: number, rel = 1e-6, abs = 1e-12) {
  expect(Math.abs(actual - expected), `aktual ${actual}, SciPy ${expected}`).toBeLessThanOrEqual(
    Math.max(abs, rel * Math.abs(expected)),
  );
}

describe(`SciPy ${ref.scipy_version}: distribusi`, () => {
  it.each(ref.t_ppf)("t.ppf($p, df=$df)", ({ p, df, value }) => close(studentTPpf(p, df), value, 1e-9));
  it.each(ref.t_sf2)("2·t.sf(|$t|, df=$df)", ({ t, df, value }) => close(studentTTwoSidedP(t, df), value, 1e-9));
  it.each(ref.norm_cdf)("norm.cdf($z)", ({ z, value }) => close(normalCdf(z), value, 1e-9, 1e-300));
  it.each(ref.norm_ppf)("norm.ppf($p)", ({ p, value }) => close(normalPpf(p), value, 1e-9));
});

describe.each(Object.entries(ref.datasets))(`SciPy ${ref.scipy_version}: dataset %s`, (_name, ds) => {
  it("ttest_rel(post, pre): t, p, df, CI selisih", () => {
    const r = pairedTTest(ds.pre, ds.post);
    close(r.t, ds.ttest_rel.t, 1e-10);
    close(r.p, ds.ttest_rel.p, 1e-8, 1e-300);
    expect(r.df).toBe(ds.ttest_rel.df);
    close(r.meanDiff, ds.ttest_rel.mean_diff, 1e-12);
    close(r.sdDiff, ds.ttest_rel.sd_diff, 1e-12);
    close(r.ciDiff.lower, ds.ttest_rel.ci_low, 1e-9);
    close(r.ciDiff.upper, ds.ttest_rel.ci_high, 1e-9);
  });

  it("wilcoxon(post, pre) default: W dan p", () => {
    const r = wilcoxonSignedRank(ds.pre, ds.post);
    expect(r.W).toBe(ds.wilcoxon.W);
    expect(r.nZero).toBe(ds.wilcoxon.n_zero);
    expect(r.hasTies).toBe(ds.wilcoxon.has_ties);
    close(r.p, ds.wilcoxon.p, 1e-8, 1e-300);
  });

  it("wilcoxon asimtotik: z", () => {
    const r = wilcoxonSignedRank(ds.pre, ds.post);
    close(r.z, ds.wilcoxon.z_asymptotic, 1e-10);
  });

  it("shapiro(selisih)", () => {
    if (!ds.shapiro_diff) return;
    const d = ds.post.map((v, i) => v - ds.pre[i]!);
    const r = shapiroWilk(d);
    close(r.W, ds.shapiro_diff.W, 1e-9);
    close(r.p, ds.shapiro_diff.p, 1e-6, 1e-12);
  });
});

describe(`SciPy ${ref.scipy_version}: Shapiro-Wilk berbagai n`, () => {
  it.each(Object.entries(ref.shapiro))("n = %s", (_n, s) => {
    const r = shapiroWilk(s.x);
    close(r.W, s.W, 1e-9);
    close(r.p, s.p, 1e-6, 1e-12);
  });
});

describe("KR-20 vs numpy", () => {
  const m = ref.kr20.matrix as (0 | 1)[][];
  it("varians populasi", () => close(kr20(m, "population").kr20, ref.kr20.population, 1e-12));
  it("varians sampel", () => close(kr20(m, "sample").kr20, ref.kr20.sample, 1e-12));
});

describe("N-Gain + CI vs SciPy t.interval", () => {
  const s = summarizeNGain(ref.ngain.pre, ref.ngain.post);
  it("pre = 100 dikeluarkan", () => {
    expect(s.excludedPreMax).toBe(ref.ngain.excluded);
    expect(s.n).toBe(ref.ngain.n);
  });
  it("rerata, SD, CI", () => {
    close(s.mean, ref.ngain.mean, 1e-12);
    close(s.sd, ref.ngain.sd, 1e-12);
    close(s.ci.lower, ref.ngain.ci_low, 1e-9);
    close(s.ci.upper, ref.ngain.ci_high, 1e-9);
  });
});
