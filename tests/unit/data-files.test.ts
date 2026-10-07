import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ItemsFile } from "@/lib/classification/item";
import { RuleSet } from "@/lib/classification/rules";

describe("data/items.json", () => {
  const parsed = ItemsFile.safeParse(JSON.parse(readFileSync("data/items.json", "utf8")));
  it("lolos skema ItemsFile", () => {
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
  });
  it("bila sudah diisi, berisi 20 butir berurutan 1..20 (PRD §6.1)", () => {
    const items = parsed.data?.items ?? [];
    if (items.length === 0) return; // belum diisi peneliti
    expect(items.map((i) => i.item_order).sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });
});

describe("data/rule-sets/*.json", () => {
  const files = readdirSync("data/rule-sets").filter((f) => f.endsWith(".json"));
  it.each(files)("%s lolos skema, lengkap, dan saling lepas", (f) => {
    const rs = RuleSet.parse(JSON.parse(readFileSync(`data/rule-sets/${f}`, "utf8")));
    expect(`${rs.rule_set_id}.json`).toBe(f);
  });
});
