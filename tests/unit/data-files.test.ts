import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ItemsFile } from "@/lib/classification/item";
import { RULE_SETS, RuleSet } from "@/lib/classification/rules";
import { enumerateItemOutcomes } from "@/lib/classification/classify";

const raw = JSON.parse(readFileSync("data/items.json", "utf8"));
const parsed = ItemsFile.safeParse(raw);

describe("data/items.json (instrumen peneliti)", () => {
  it("lolos skema ItemsFile", () => {
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
  });

  const file = parsed.data!;
  const items = [...file.items].sort((a, b) => a.item_order - b.item_order);

  it("berisi 20 butir berurutan 1..20 (PRD §6.1)", () => {
    expect(items.map((i) => i.item_order)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it("kunci sama dengan Ringkasan Kunci dokumen instrumen", () => {
    // Disalin tangan dari tabel "Ringkasan Kunci" sebagai pemeriksaan independen.
    expect(items.map((i) => i.content.tier1.correct).join("")).toBe("CBCBADBCBDCADABCDCAC");
    expect(items.map((i) => i.content.reason.correct).join("")).toBe("BCDACBCBDDBCACABABCB");
  });

  it("semua butir four-tier baku, opsi A–D, keyakinan Yakin/Tidak yakin", () => {
    for (const it of items) {
      const c = it.content;
      expect(c.format).toBe("four_tier_standard");
      expect(c.tier1.options.map((o) => o.key)).toEqual(["A", "B", "C", "D"]);
      expect(c.reason.options.map((o) => o.key)).toEqual(["A", "B", "C", "D"]);
      expect(c.confidence).toEqual({ levels: ["Yakin", "Tidak yakin"], threshold_index: 0 });
    }
  });

  it("4 domain × 5 butir, konsisten dengan concept_domain", () => {
    expect(file.domains?.map((d) => [d.id, d.item_orders.length])).toEqual([
      ["benda_langit", 5],
      ["planet", 5],
      ["rotasi_revolusi", 5],
      ["gerhana", 5],
    ]);
  });

  it("default_rule_set_id terdaftar", () => {
    expect(RULE_SETS[file.default_rule_set_id!]).toBeDefined();
  });

  it("status instrumen tercatat (draf belum divalidasi)", () => {
    expect(file.source?.status).toBe("draft_needs_validation");
  });

  it("teks bersih: tanpa sisa markdown/escape", () => {
    const text = JSON.stringify(items.map((i) => i.content));
    expect(text).not.toMatch(/\\\\|\*\*|\\t|  /);
  });

  it("uji aturan pedoman-v1 pada setiap butir: 4×4×2×2 = 64 kombinasi, tepat 1 SC", () => {
    for (const it of items) {
      const { combinations, totals } = enumerateItemOutcomes(it.content, RULE_SETS["pedoman-v1"]!);
      expect(combinations).toBe(64);
      expect(totals.SC).toBe(1);
      expect(Object.values(totals).reduce((a, b) => a + b, 0)).toBe(64);
    }
  });
});

describe("data/rule-sets/*.json", () => {
  const files = readdirSync("data/rule-sets").filter((f) => f.endsWith(".json"));
  it.each(files)("%s lolos skema, lengkap, dan saling lepas", (f) => {
    const rs = RuleSet.parse(JSON.parse(readFileSync(`data/rule-sets/${f}`, "utf8")));
    expect(`${rs.rule_set_id}.json`).toBe(f);
  });
});

describe("data/analysis.json", () => {
  it("merujuk rule set yang terdaftar dan sesuai pedoman instrumen", async () => {
    const { ANALYSIS_CONFIG } = await import("@/lib/classification/analysis-config");
    expect(RULE_SETS[ANALYSIS_CONFIG.rule_set_id]).toBeDefined();
    expect(ANALYSIS_CONFIG).toMatchObject({ rule_set_id: "pedoman-v1", score_method: "score_sc", transition_mode: "per_butir" });
  });
});
