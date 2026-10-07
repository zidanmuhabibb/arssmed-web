import { describe, expect, it } from "vitest";
import { CATEGORIES, type Category } from "../classification/categories";
import { computeTransitions, dominantCategory, PATTERN_MAP, transitionPattern, type PhaseResponse } from "./index";

describe("transitionPattern (PRD §6.5)", () => {
  it.each([
    ["SC", "SC", "retention"],
    ["M", "SC", "revision"],
    ["E", "SC", "revision"],
    ["M", "LC", "revision"],
    ["M", "E", "revision"],
    ["LK", "SC", "construction"],
    ["M", "M", "static"],
    ["E", "E", "static"],
    ["SC", "E", "static"],
  ] as const)("%s → %s = %s", (pre, post, p) => {
    expect(transitionPattern(pre, post)).toBe(p);
  });

  it.each([
    ["SC", "M"],
    ["LK", "M"],
    ["SC", "LK"],
    ["LK", "LK"],
    ["LC", "SC"],
  ] as const)("%s → %s tidak tercantum → Lainnya", (pre, post) => {
    expect(transitionPattern(pre, post)).toBe("other");
  });

  it("setiap dari 25 kombinasi punya tepat satu pola", () => {
    let mapped = 0;
    for (const a of CATEGORIES) for (const b of CATEGORIES) if (transitionPattern(a, b) !== "other") mapped += 1;
    expect(mapped).toBe(Object.keys(PATTERN_MAP).length);
  });
});

describe("dominantCategory", () => {
  it("memilih modus", () => {
    expect(dominantCategory(["SC", "SC", "M"])).toBe("SC");
  });
  it.each([
    [["SC", "M"], "M"],
    [["SC", "E"], "E"],
    [["E", "LK"], "E"],
    [["LK", "LC"], "LK"],
    [["LC", "SC"], "LC"],
    [["SC", "SC", "M", "M", "LK"], "M"],
  ] as [Category[], Category][])("seri %o dipecah konservatif → %s", (cats, expected) => {
    expect(dominantCategory(cats)).toBe(expected);
  });
  it("menolak daftar kosong", () => {
    expect(() => dominantCategory([])).toThrow();
  });
});

function rows(spec: Record<string, { pre: Category[]; post: Category[] }>, domain = "planet"): PhaseResponse[] {
  return Object.entries(spec).flatMap(([studentId, { pre, post }]) => [
    ...pre.map((category, i) => ({ studentId, itemId: `i${i + 1}`, domain, phase: "pre" as const, category })),
    ...post.map((category, i) => ({ studentId, itemId: `i${i + 1}`, domain, phase: "post" as const, category })),
  ]);
}

describe("computeTransitions", () => {
  const data = rows({
    s1: { pre: ["M", "M", "SC"], post: ["SC", "SC", "SC"] }, // M → SC revisi
    s2: { pre: ["SC", "SC", "SC"], post: ["SC", "SC", "M"] }, // SC → SC retensi
    s3: { pre: ["LK", "LK", "M"], post: ["SC", "SC", "LK"] }, // LK → SC konstruksi
    s4: { pre: ["SC", "SC", "E"], post: ["M", "M", "SC"] }, // SC → M lainnya
    s5: { pre: ["M", "M", "M"], post: ["M", "E", "M"] }, // M → M statis
  });
  const paired = ["s1", "s2", "s3", "s4", "s5"];

  it("mode modus: jumlah pola = jumlah siswa (invarian)", () => {
    const [d] = computeTransitions(data, "modus", paired);
    expect(d!.nUnits).toBe(5);
    expect(d!.patternCounts).toEqual({ retention: 1, revision: 1, construction: 1, static: 1, other: 1 });
    expect(Object.values(d!.patternCounts).reduce((a, b) => a + b, 0)).toBe(5);
    expect(d!.invariantOk).toBe(true);
    expect(d!.matrix.SC.M).toEqual(["s4"]);
  });

  it("mode per_butir: satu pasangan per siswa × butir", () => {
    const [d] = computeTransitions(data, "per_butir", paired);
    expect(d!.nUnits).toBe(15);
    expect(Object.values(d!.patternCounts).reduce((a, b) => a + b, 0)).toBe(15);
    expect(d!.units.find((u) => u.unitId === "s4::i1")).toMatchObject({ pre: "SC", post: "M", pattern: "other" });
  });

  it("mengabaikan siswa yang tidak lolos analisis berpasangan", () => {
    const [d] = computeTransitions(data, "modus", ["s1", "s2"]);
    expect(d!.nUnits).toBe(2);
  });

  it("melaporkan unit tanpa posttest alih-alih membuangnya diam-diam", () => {
    const partial = [...data, { studentId: "s6", itemId: "i1", domain: "planet", phase: "pre" as const, category: "M" as const }];
    const [d] = computeTransitions(partial, "modus", [...paired, "s6"]);
    expect(d!.excluded).toEqual([{ unitId: "s6", reason: "missing_post" }]);
    expect(d!.nUnits).toBe(5);
  });

  it("menolak respons ganda", () => {
    expect(() => computeTransitions([...data, data[0]!], "modus", paired)).toThrow(/ganda/);
  });

  it("memisah per domain", () => {
    const multi = [...data, ...rows({ s1: { pre: ["E"], post: ["SC"] } }, "meteor")];
    const out = computeTransitions(multi, "modus", paired);
    expect(out.map((d) => d.domain)).toEqual(["meteor", "planet"]);
    expect(out[0]!.patternCounts.revision).toBe(1);
  });
});
