import { describe, expect, it } from "vitest";
import { computeScore, domainDistribution, selectPairedStudents, type CategorizedResponse } from "./index";

describe("computeScore (PRD §6.3)", () => {
  const items = [
    { category: "SC" as const, aCorrect: true },
    { category: "E" as const, aCorrect: true },
    { category: "M" as const, aCorrect: false },
    { category: "LC" as const, aCorrect: true },
  ];
  it("score_sc = SC ÷ jumlah butir × 100", () => {
    expect(computeScore(items, 4, "score_sc")).toBe(25);
  });
  it("score_tier1 = tier 1 benar ÷ jumlah butir × 100", () => {
    expect(computeScore(items, 4, "score_tier1")).toBe(75);
  });
  it("butir tidak dijawab dihitung bukan-SC", () => {
    expect(computeScore(items, 20, "score_sc")).toBe(5);
  });
  it("menolak masukan tidak masuk akal", () => {
    expect(() => computeScore(items, 0, "score_sc")).toThrow();
    expect(() => computeScore(items, 3, "score_sc")).toThrow();
  });
});

describe("domainDistribution (PRD §6.4)", () => {
  // 2 siswa × domain "planet" (3 butir) + domain "meteor" (2 butir)
  const rows: CategorizedResponse[] = [
    ...["s1", "s2"].flatMap((s) =>
      ["p1", "p2", "p3"].map((i, k) => ({ studentId: s, itemId: i, domain: "planet", category: (k === 0 ? "SC" : "M") as "SC" | "M" })),
    ),
    ...["s1", "s2"].flatMap((s) =>
      ["m1", "m2"].map((i) => ({ studentId: s, itemId: i, domain: "meteor", category: (s === "s1" ? "LK" : "E") as "LK" | "E" })),
    ),
  ];

  it("penyebut = siswa × butir domain, persentase berjumlah 100", () => {
    const [meteor, planet] = domainDistribution(rows);
    expect(planet!.nResponses).toBe(6);
    expect(planet!.counts).toEqual({ SC: 2, M: 4, E: 0, LK: 0, LC: 0 });
    expect(planet!.percent.SC).toBeCloseTo(33.333, 2);
    expect(planet!.denominatorConsistent).toBe(true);
    expect(meteor!.nResponses).toBe(4);
    expect(meteor!.percent).toEqual({ SC: 0, M: 0, E: 50, LK: 50, LC: 0 });
    for (const d of [meteor!, planet!]) {
      const sum = Object.values(d.percent).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(100, 10);
      expect(Object.values(d.counts).reduce((a, b) => a + b, 0)).toBe(d.nResponses);
    }
  });

  it("menandai penyebut tidak konsisten bila ada respons hilang", () => {
    const d = domainDistribution(rows.filter((r) => !(r.studentId === "s2" && r.itemId === "p3")));
    expect(d.find((x) => x.domain === "planet")!.denominatorConsistent).toBe(false);
  });

  it("menolak respons ganda siswa × butir", () => {
    expect(() => domainDistribution([...rows, rows[0]!])).toThrow(/ganda/);
  });
});

describe("selectPairedStudents", () => {
  it("hanya granted + pre + post, sisanya dilaporkan dengan alasan", () => {
    const r = selectPairedStudents([
      { studentId: "a", consent: "granted", preComplete: true, postComplete: true },
      { studentId: "b", consent: "granted", preComplete: true, postComplete: false },
      { studentId: "c", consent: "granted", preComplete: false, postComplete: true },
      { studentId: "d", consent: "withdrawn", preComplete: true, postComplete: true },
      { studentId: "e", consent: "pending", preComplete: true, postComplete: true },
    ]);
    expect(r.included).toEqual(["a"]);
    expect(r.excludedByReason).toEqual({ consent_withdrawn: 1, consent_pending: 1, pre_incomplete: 1, post_incomplete: 1 });
  });
});
