/**
 * Pedoman Pengkategorian Konsepsi (instrumen, bagian D) — aturan per_tier 16 baris.
 */
import { describe, expect, it } from "vitest";
import examples from "../../tests/fixtures/pedoman-examples.json";
import items from "../../data/items.json";
import { classifyResponse, DEFAULT_RULE_SET, PEDOMAN_V1_RULE_SET, TestItemContent, analyzeRules, type Category } from "./index";
import { ITEM_MODIFIED } from "./fixtures.test-helpers";

const ITEM7 = TestItemContent.parse(items.items.find((i) => i.item_order === 7)!.content);
const Y = 0;
const TY = 1;
const conf = (v: string) => (v === "Y" ? Y : TY);

function classify(t1: string | null, ca: number | null, t3: string | null, cr: number | null) {
  return classifyResponse(ITEM7, { tier1Key: t1, confidenceA: ca, reasonKey: t3, confidenceR: cr }, PEDOMAN_V1_RULE_SET);
}

describe("pedoman-v1: tabel keputusan D.2 (16 baris)", () => {
  it("lengkap dan saling lepas atas A × CA × R × CR", () => {
    expect(analyzeRules(PEDOMAN_V1_RULE_SET.rules, "per_tier")).toMatchObject({ complete: true, exclusive: true });
  });

  // Butir 7: kunci tier 1 = B, tier 3 = C. Benar = B/C; salah = A/A.
  // [no, T1, T2, T3, T4, kategori] persis seperti tabel D.2
  const D2: [number, "B" | "S", "Y" | "TY", "B" | "S", "Y" | "TY", Category][] = [
    [1, "B", "Y", "B", "Y", "SC"],
    [2, "B", "Y", "B", "TY", "LC"],
    [3, "B", "TY", "B", "Y", "LC"],
    [4, "B", "TY", "B", "TY", "LC"],
    [5, "B", "Y", "S", "Y", "M"],
    [6, "S", "Y", "B", "Y", "M"],
    [7, "S", "Y", "S", "Y", "M"],
    [8, "B", "TY", "S", "TY", "LK"],
    [9, "S", "TY", "B", "TY", "LK"],
    [10, "S", "TY", "S", "TY", "LK"],
    [11, "B", "Y", "S", "TY", "E"],
    [12, "B", "TY", "S", "Y", "E"],
    [13, "S", "Y", "B", "TY", "E"],
    [14, "S", "TY", "B", "Y", "E"],
    [15, "S", "Y", "S", "TY", "E"],
    [16, "S", "TY", "S", "Y", "E"],
  ];
  it.each(D2)("baris %i: T1=%s T2=%s T3=%s T4=%s → %s", (_no, a, ca, r, cr, expected) => {
    const c = classify(a === "B" ? "B" : "A", conf(ca), r === "B" ? "C" : "A", conf(cr));
    expect(c.status).toBe("classified");
    if (c.status === "classified") expect(c.category).toBe(expected);
  });
});

describe("pedoman-v1: contoh penerapan D.3 (butir 7)", () => {
  it.each(examples.examples)("$tier1, $confidenceA, $reason, $confidenceR → $category", (ex) => {
    const c = classify(ex.tier1, conf(ex.confidenceA), ex.reason, conf(ex.confidenceR));
    expect(c.status === "classified" && c.category).toBe(ex.category);
  });
});

describe("pedoman-v1: tier kosong → E", () => {
  it.each([
    [null, Y, "C", Y, ["tier1"]],
    ["B", null, "C", Y, ["confidenceA"]],
    ["B", Y, null, Y, ["reason"]],
    ["B", Y, "C", null, ["confidenceR"]],
    [null, null, null, null, ["tier1", "reason", "confidenceA", "confidenceR"]],
  ] as const)("%s, %s, %s, %s → E", (t1, ca, t3, cr, missing) => {
    const c = classify(t1, ca, t3, cr);
    expect(c).toMatchObject({ status: "classified", category: "E", missing });
  });

  it("aturan default-v1 tetap mengeluarkan respons tidak lengkap (tidak dipaksa E)", () => {
    const c = classifyResponse(ITEM7, { tier1Key: "B", confidenceA: Y, reasonKey: null, confidenceR: Y }, DEFAULT_RULE_SET);
    expect(c.status).toBe("incomplete");
  });
});

describe("perbedaan pedoman-v1 vs asumsi PRD default-v1", () => {
  it("jawaban benar + alasan salah + yakin keduanya: pedoman = M, PRD = E", () => {
    const r = { tier1Key: "B", confidenceA: Y, reasonKey: "A", confidenceR: Y };
    expect(classifyResponse(ITEM7, r, PEDOMAN_V1_RULE_SET)).toMatchObject({ category: "M" });
    expect(classifyResponse(ITEM7, r, DEFAULT_RULE_SET)).toMatchObject({ category: "E" });
  });
  it("salah + salah, keyakinan tidak konsisten: pedoman = E, PRD = LK", () => {
    const r = { tier1Key: "A", confidenceA: Y, reasonKey: "A", confidenceR: TY };
    expect(classifyResponse(ITEM7, r, PEDOMAN_V1_RULE_SET)).toMatchObject({ category: "E" });
    expect(classifyResponse(ITEM7, r, DEFAULT_RULE_SET)).toMatchObject({ category: "LK" });
  });
  it("pedoman-v1 menolak butir modified_tier2", () => {
    expect(
      classifyResponse(ITEM_MODIFIED, { tier1Key: "B", reasonKey: "R2", confidenceA: null, confidenceR: 0 }, PEDOMAN_V1_RULE_SET).status,
    ).toBe("invalid");
  });
  it("menyimpan keyakinan per tier pada hasil", () => {
    expect(classify("B", Y, "C", TY)).toMatchObject({ confidentA: true, confidentR: false, confident: false });
  });
});
