import { describe, expect, it } from "vitest";
import {
  analyzeRules,
  classifyResponse,
  DEFAULT_RULE_SET,
  enumerateItemOutcomes,
  CombinedRuleSet,
  RuleSet,
  TestItemContent,
  toStudentItem,
  type Category,
  type RawResponse,
} from "./index";
import { ITEM_MODIFIED, ITEM_STANDARD, withLevels } from "./fixtures.test-helpers";

const YAKIN = 0;
const RAGU = 1;

function resp(tier1Key: string, reasonKey: string, confidenceR: number | null, confidenceA: number | null = null): RawResponse {
  return { tier1Key, reasonKey, confidenceA, confidenceR };
}

function cat(item: TestItemContent, r: RawResponse, rs: RuleSet = DEFAULT_RULE_SET): Category {
  const c = classifyResponse(item, r, rs);
  if (c.status !== "classified") throw new Error(JSON.stringify(c));
  return c.category;
}

describe("aturan default (PRD §6.2) — 8 kombinasi, format modified_tier2", () => {
  // A benar = "B", R benar = "R2"
  it.each([
    ["B", "R2", YAKIN, "SC"],
    ["B", "R2", RAGU, "LC"],
    ["B", "R1", YAKIN, "E"],
    ["A", "R2", YAKIN, "E"],
    ["A", "R1", YAKIN, "M"],
    ["B", "R1", RAGU, "LK"],
    ["A", "R2", RAGU, "LK"],
    ["A", "R1", RAGU, "LK"],
  ] as const)("jawaban %s, alasan %s, keyakinan %i → %s", (a, r, c, expected) => {
    expect(cat(ITEM_MODIFIED, resp(a, r, c))).toBe(expected);
  });

  it("skenario penerimaan PRD §14: jawaban benar, alasan salah, Yakin → E", () => {
    const c = classifyResponse(ITEM_MODIFIED, resp("B", "R3", YAKIN), DEFAULT_RULE_SET);
    expect(c).toMatchObject({ status: "classified", aCorrect: true, rCorrect: false, confident: true, category: "E" });
  });

  it("menyimpan rule_set_id pada hasil", () => {
    expect(classifyResponse(ITEM_MODIFIED, resp("B", "R2", YAKIN), DEFAULT_RULE_SET).ruleSetId).toBe("default-v1");
  });

  it("tidak mengubah objek jawaban mentah", () => {
    const r = Object.freeze(resp("B", "R2", YAKIN));
    expect(() => classifyResponse(ITEM_MODIFIED, r, DEFAULT_RULE_SET)).not.toThrow();
  });
});

describe("variasi ambang keyakinan", () => {
  const tiga = ["Sangat yakin", "Yakin", "Ragu-ragu"];
  it("3 level, ambang 0: hanya 'Sangat yakin' dihitung yakin", () => {
    const item = withLevels(tiga, 0);
    expect(cat(item, resp("B", "R2", 0))).toBe("SC");
    expect(cat(item, resp("B", "R2", 1))).toBe("LC");
    expect(cat(item, resp("B", "R2", 2))).toBe("LC");
  });
  it("3 level, ambang 1: 'Sangat yakin' dan 'Yakin' dihitung yakin", () => {
    const item = withLevels(tiga, 1);
    expect(cat(item, resp("B", "R2", 0))).toBe("SC");
    expect(cat(item, resp("B", "R2", 1))).toBe("SC");
    expect(cat(item, resp("B", "R2", 2))).toBe("LC");
    expect(cat(item, resp("A", "R1", 1))).toBe("M");
    expect(cat(item, resp("A", "R1", 2))).toBe("LK");
  });
  it("4 level, ambang 1", () => {
    const item = withLevels(["Sangat yakin", "Yakin", "Kurang yakin", "Menebak"], 1);
    expect([0, 1, 2, 3].map((c) => cat(item, resp("A", "R1", c)))).toEqual(["M", "M", "LK", "LK"]);
  });
  it("menolak ambang yang tidak menyisakan level ragu", () => {
    expect(() => withLevels(["Yakin", "Ragu-ragu"], 1)).toThrow();
  });
});

describe("format four_tier_standard", () => {
  it("yakin hanya bila KEDUA rating ≥ ambang", () => {
    expect(cat(ITEM_STANDARD, resp("B", "R2", YAKIN, YAKIN))).toBe("SC");
    expect(cat(ITEM_STANDARD, resp("B", "R2", YAKIN, RAGU))).toBe("LC");
    expect(cat(ITEM_STANDARD, resp("B", "R2", RAGU, YAKIN))).toBe("LC");
    expect(cat(ITEM_STANDARD, resp("A", "R1", YAKIN, YAKIN))).toBe("M");
    expect(cat(ITEM_STANDARD, resp("A", "R1", RAGU, YAKIN))).toBe("LK");
  });

  it("mode answer_tier_only dan reason_tier_only", () => {
    const answerOnly = CombinedRuleSet.parse({ ...DEFAULT_RULE_SET, rule_set_id: "a-only", confidence_mode: "answer_tier_only" });
    const reasonOnly = CombinedRuleSet.parse({ ...DEFAULT_RULE_SET, rule_set_id: "r-only", confidence_mode: "reason_tier_only" });
    const r = resp("A", "R1", RAGU, YAKIN); // alasan ragu, jawaban yakin
    expect(cat(ITEM_STANDARD, r, answerOnly)).toBe("M");
    expect(cat(ITEM_STANDARD, r, reasonOnly)).toBe("LK");
  });

  it("answer_tier_only tidak berlaku untuk modified_tier2", () => {
    const answerOnly = CombinedRuleSet.parse({ ...DEFAULT_RULE_SET, rule_set_id: "a-only", confidence_mode: "answer_tier_only" });
    expect(classifyResponse(ITEM_MODIFIED, resp("B", "R2", YAKIN), answerOnly).status).toBe("invalid");
  });
});

describe("respons tidak lengkap / tidak valid", () => {
  it("melaporkan tier yang belum diisi", () => {
    const c = classifyResponse(ITEM_STANDARD, { tier1Key: "B", reasonKey: null, confidenceA: null, confidenceR: 0 }, DEFAULT_RULE_SET);
    expect(c).toEqual({ status: "incomplete", missing: ["reason", "confidenceA"], ruleSetId: "default-v1" });
  });
  it("modified_tier2 tidak mewajibkan confidenceA", () => {
    expect(classifyResponse(ITEM_MODIFIED, resp("B", "R2", YAKIN, null), DEFAULT_RULE_SET).status).toBe("classified");
  });
  it.each([
    [resp("Z", "R2", YAKIN), /tier 1/],
    [resp("B", "R9", YAKIN), /alasan/],
    [resp("B", "R2", 2), /skala/],
    [resp("B", "R2", -1), /skala/],
    [resp("B", "R2", 0.5), /skala/],
  ])("menolak %o", (r, msg) => {
    const c = classifyResponse(ITEM_MODIFIED, r, DEFAULT_RULE_SET);
    expect(c.status).toBe("invalid");
    if (c.status === "invalid") expect(c.reason).toMatch(msg);
  });
});

describe("validasi rule set", () => {
  it("aturan default lengkap dan saling lepas", () => {
    expect(analyzeRules(DEFAULT_RULE_SET.rules)).toMatchObject({ complete: true, exclusive: true });
  });
  it("menolak aturan yang kurang satu kombinasi", () => {
    const rules = [...DEFAULT_RULE_SET.rules.slice(0, 7), { ...DEFAULT_RULE_SET.rules[0]! }];
    const a = analyzeRules(rules);
    expect(a.complete).toBe(false);
    expect(a.missing).toEqual([{ A: false, R: false, C: false }]);
    expect(a.duplicates).toHaveLength(1);
    expect(() => CombinedRuleSet.parse({ ...DEFAULT_RULE_SET, rules })).toThrow(/belum lengkap/);
  });
  it("menolak jumlah aturan ≠ 8", () => {
    expect(() => CombinedRuleSet.parse({ ...DEFAULT_RULE_SET, rules: DEFAULT_RULE_SET.rules.slice(0, 7) })).toThrow();
  });
  it("aturan alternatif sebagai data mengubah hasil tanpa mengubah kode", () => {
    const alt = RuleSet.parse({
      ...DEFAULT_RULE_SET,
      rule_set_id: "alt-v1",
      rules: DEFAULT_RULE_SET.rules.map((r) => (!r.A && r.R && r.C ? { ...r, category: "M" } : r)),
    });
    expect(cat(ITEM_MODIFIED, resp("A", "R2", YAKIN))).toBe("E");
    expect(cat(ITEM_MODIFIED, resp("A", "R2", YAKIN), alt)).toBe("M");
  });
});

describe("uji aturan: semua kombinasi jawaban (FR-54)", () => {
  it("modified_tier2: 3 × 3 × 2 = 18 kombinasi", () => {
    const { rows, totals, combinations } = enumerateItemOutcomes(ITEM_MODIFIED, DEFAULT_RULE_SET);
    expect(combinations).toBe(18);
    expect(rows).toHaveLength(18);
    // 1 jawaban benar × 1 alasan benar × yakin = 1 SC
    expect(totals).toEqual({ SC: 1, LC: 1, E: 4, M: 4, LK: 8 });
    expect(Object.values(totals).reduce((a, b) => a + b, 0)).toBe(18);
  });
  it("four_tier_standard: 3 × 3 × 2 × 2 = 36 kombinasi", () => {
    const { combinations, totals } = enumerateItemOutcomes(ITEM_STANDARD, DEFAULT_RULE_SET);
    expect(combinations).toBe(36);
    expect(totals.SC).toBe(1);
    expect(totals.LC).toBe(3);
  });
});

describe("skema butir dan versi siswa", () => {
  it("menolak kunci jawaban yang tidak ada di opsi", () => {
    expect(() => TestItemContent.parse({ ...ITEM_MODIFIED, tier1: { ...ITEM_MODIFIED.tier1, correct: "D" } })).toThrow(/tier 1/);
    expect(() => TestItemContent.parse({ ...ITEM_MODIFIED, reason: { ...ITEM_MODIFIED.reason, correct: "R9" } })).toThrow(/alasan/);
  });
  it("menolak kunci opsi ganda", () => {
    const options = [ITEM_MODIFIED.tier1.options[0]!, ITEM_MODIFIED.tier1.options[0]!];
    expect(() => TestItemContent.parse({ ...ITEM_MODIFIED, tier1: { options, correct: "A" } })).toThrow(/unik/);
  });
  it("versi siswa tidak membawa kunci jawaban atau penanda miskonsepsi", () => {
    const json = JSON.stringify(toStudentItem(ITEM_MODIFIED));
    expect(json).not.toMatch(/correct|maps_to_misconception|misconception|concept_domain|report_domain/);
    expect(toStudentItem(ITEM_MODIFIED).tier1.options).toHaveLength(3);
  });
});
