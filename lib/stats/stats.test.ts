import { describe, expect, it } from "vitest";
import {
  cohenDz,
  hedgesGz,
  individualNGain,
  kr20,
  mean,
  meanCI,
  nGainCategory,
  pairedTTest,
  rankAverage,
  sd,
  shapiroWilk,
  studentTPpf,
  summarizeNGain,
  wilcoxonSignedRank,
} from "./index";

describe("fixture artikel (PRD §7.2): n = 36, rerata N-Gain 54,71%, SD 21,80", () => {
  const ci = meanCI({ mean: 54.71, sd: 21.8, n: 36 });
  it("t(0,975; 35) ≈ 2,030", () => {
    expect(ci.tCritical).toBeCloseTo(2.0301, 3);
  });
  it("SE = 21,80/√36 = 3,633", () => {
    expect(ci.se).toBeCloseTo(3.6333, 3);
  });
  it("margin ≈ 7,38", () => {
    expect(ci.margin).toBeCloseTo(7.38, 2);
  });
  it("CI 95% = [47,34; 62,09] dalam toleransi ±0,05 poin persentase", () => {
    expect(Math.abs(ci.lower - 47.34)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(ci.upper - 62.09)).toBeLessThanOrEqual(0.05);
  });
  it("rerata 0,5471 berkategori sedang (0,30–0,70)", () => {
    expect(nGainCategory(0.5471)).toBe("sedang");
  });
});

describe("N-Gain individual", () => {
  it("rumus Hake", () => {
    expect(individualNGain(40, 70)).toBeCloseTo(0.5, 12);
    expect(individualNGain(0, 100)).toBe(1);
    expect(individualNGain(60, 50)).toBeCloseTo(-0.25, 12);
  });
  it("pre = 100 → tidak terdefinisi (null)", () => {
    expect(individualNGain(100, 100)).toBeNull();
  });
  it("menolak skor di luar 0..100", () => {
    expect(() => individualNGain(-5, 50)).toThrow();
    expect(() => individualNGain(50, 101)).toThrow();
  });
  it("batas kategori eksplisit: 0,70 tinggi, 0,30 sedang, < 0,30 rendah", () => {
    expect(nGainCategory(0.7)).toBe("tinggi");
    expect(nGainCategory(0.6999999)).toBe("sedang");
    expect(nGainCategory(0.3)).toBe("sedang");
    expect(nGainCategory(0.2999999)).toBe("rendah");
    expect(nGainCategory(-0.4)).toBe("rendah");
  });
  it("skenario penerimaan PRD §14: siswa pre = 100 dikeluarkan dari rerata dan dihitung", () => {
    const s = summarizeNGain([40, 50, 100, 20], [70, 75, 100, 60]);
    expect(s.n).toBe(3);
    expect(s.excludedPreMax).toBe(1);
    expect(s.mean).toBeCloseTo((0.5 + 0.5 + 0.5) / 3, 12);
    expect(s.individual[2]).toEqual({ index: 2, g: null, category: null });
  });
});

describe("deskriptif", () => {
  it("mean, sd (n−1)", () => {
    expect(mean([2, 4, 4, 4, 5, 5, 7, 9])).toBe(5);
    expect(sd([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.13809, 5);
  });
  it("rankAverage = scipy rankdata 'average'", () => {
    expect(rankAverage([10, 20, 20, 5, 30])).toEqual([2, 3.5, 3.5, 1, 5]);
  });
});

describe("uji-t berpasangan dan ukuran efek", () => {
  it("contoh hitung tangan", () => {
    const r = pairedTTest([10, 20, 30, 40], [12, 25, 33, 48]);
    // d = 2,5,3,8 → d̄ = 4,5; s_d = 2,6458
    expect(r.meanDiff).toBeCloseTo(4.5, 12);
    expect(r.sdDiff).toBeCloseTo(2.645751, 5);
    expect(r.t).toBeCloseTo(4.5 / (2.645751 / 2), 4);
    expect(r.df).toBe(3);
    expect(r.cohenDz).toBeCloseTo(4.5 / 2.645751, 5);
    expect(r.hedgesGz).toBeCloseTo((4.5 / 2.645751) * (1 - 3 / (4 * 3 - 1)), 5);
  });
  it("selisih identik ditandai degenerate", () => {
    const r = pairedTTest([1, 2, 3], [2, 3, 4]);
    expect(r.degenerate).toBe(true);
    expect(r.t).toBe(Infinity);
    expect(r.p).toBe(0);
  });
  it("cohenDz/hedgesGz konsisten", () => {
    expect(cohenDz(5, 10)).toBe(0.5);
    expect(hedgesGz(5, 10, 36)).toBeCloseTo(0.5 * (1 - 3 / 139), 12);
  });
});

describe("Wilcoxon dan Shapiro: kasus tepi", () => {
  it("semua selisih nol → galat jelas", () => {
    expect(() => wilcoxonSignedRank([1, 2], [1, 2])).toThrow(/nol/);
  });
  it("Shapiro menolak n < 3 dan data konstan", () => {
    expect(() => shapiroWilk([1, 2])).toThrow();
    expect(() => shapiroWilk([3, 3, 3, 3])).toThrow();
  });
});

describe("KR-20", () => {
  it("contoh kecil hitung tangan", () => {
    // 4 siswa × 3 butir
    const m: (0 | 1)[][] = [
      [1, 1, 1],
      [1, 1, 0],
      [1, 0, 0],
      [0, 0, 0],
    ];
    // p = .75,.5,.25 → Σpq = .1875+.25+.1875 = .625; total = 3,2,1,0 → var pop = 1,25
    const r = kr20(m);
    expect(r.sumPQ).toBeCloseTo(0.625, 12);
    expect(r.varianceTotal).toBeCloseTo(1.25, 12);
    expect(r.kr20).toBeCloseTo(1.5 * (1 - 0.625 / 1.25), 12);
  });
  it("menolak nilai selain 0/1 dan baris tak sejajar", () => {
    expect(() => kr20([[1, 2 as 1], [0, 1]])).toThrow();
    expect(() => kr20([[1, 0], [0]])).toThrow();
  });
});

describe("studentTPpf", () => {
  it("simetris dan df besar mendekati normal", () => {
    expect(studentTPpf(0.025, 10)).toBeCloseTo(-studentTPpf(0.975, 10), 12);
    expect(studentTPpf(0.975, 1e6)).toBeCloseTo(1.959966, 5);
  });
});
