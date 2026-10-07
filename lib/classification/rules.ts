import { z } from "zod";
import { CATEGORIES, type Category } from "./categories";
import defaultV1 from "../../data/rule-sets/default-v1.json";

/**
 * Aturan klasifikasi sebagai DATA berversi (PRD §6.2). Kode tidak boleh
 * menyimpan aturan keras; selalu lewat RuleSet.
 */
export const ConfidenceMode = z.enum([
  /** C = semua rating keyakinan yang wajib ≥ ambang (default PRD). */
  "all_tiers_at_or_above_threshold",
  /** C = hanya rating keyakinan atas jawaban (tier 2 baku). */
  "answer_tier_only",
  /** C = hanya rating keyakinan atas alasan (tier 4 baku / tier 2 modifikasi). */
  "reason_tier_only",
]);
export type ConfidenceMode = z.infer<typeof ConfidenceMode>;

const Rule = z.object({
  A: z.boolean(),
  R: z.boolean(),
  C: z.boolean(),
  category: z.enum(CATEGORIES),
});
export type Rule = z.infer<typeof Rule>;

export interface RuleSetAnalysis {
  complete: boolean;
  exclusive: boolean;
  missing: { A: boolean; R: boolean; C: boolean }[];
  duplicates: { A: boolean; R: boolean; C: boolean; categories: Category[] }[];
}

const COMBOS = [true, false].flatMap((A) =>
  [true, false].flatMap((R) => [true, false].map((C) => ({ A, R, C }))),
);

export function analyzeRules(rules: readonly Rule[]): RuleSetAnalysis {
  const missing: RuleSetAnalysis["missing"] = [];
  const duplicates: RuleSetAnalysis["duplicates"] = [];
  for (const combo of COMBOS) {
    const hits = rules.filter((r) => r.A === combo.A && r.R === combo.R && r.C === combo.C);
    if (hits.length === 0) missing.push(combo);
    if (hits.length > 1) duplicates.push({ ...combo, categories: hits.map((h) => h.category) });
  }
  return { complete: missing.length === 0, exclusive: duplicates.length === 0, missing, duplicates };
}

export const RuleSet = z
  .object({
    rule_set_id: z.string().min(1),
    confidence_mode: ConfidenceMode,
    rules: z.array(Rule).length(8),
  })
  .superRefine((rs, ctx) => {
    const a = analyzeRules(rs.rules);
    if (!a.complete) {
      ctx.addIssue({ code: "custom", path: ["rules"], message: `Aturan belum lengkap: ${JSON.stringify(a.missing)}` });
    }
    if (!a.exclusive) {
      ctx.addIssue({ code: "custom", path: ["rules"], message: `Aturan tumpang tindih: ${JSON.stringify(a.duplicates)}` });
    }
  });
export type RuleSet = z.infer<typeof RuleSet>;

/**
 * Asumsi default PRD §6.2. WAJIB dicocokkan peneliti dengan Pedoman Klasifikasi
 * (Lampiran 4 proposal) sebelum data nyata dikumpulkan — PRD §16.1 #3.
 * Sumber: data/rule-sets/default-v1.json.
 */
export const DEFAULT_RULE_SET: RuleSet = RuleSet.parse(defaultV1);

export function lookupCategory(ruleSet: RuleSet, A: boolean, R: boolean, C: boolean): Category {
  const rule = ruleSet.rules.find((r) => r.A === A && r.R === R && r.C === C);
  // RuleSet tervalidasi lengkap, jadi ini hanya terjadi bila objek dibuat tanpa parse.
  if (!rule) throw new Error(`Aturan ${ruleSet.rule_set_id} tidak punya kombinasi A=${A} R=${R} C=${C}`);
  return rule.category;
}
