import { z } from "zod";
import { CATEGORIES, type Category } from "./categories";
import defaultV1 from "../../data/rule-sets/default-v1.json";
import pedomanV1 from "../../data/rule-sets/pedoman-v1.json";

/**
 * Aturan klasifikasi sebagai DATA berversi (PRD §6.2). Kode tidak boleh
 * menyimpan aturan keras; selalu lewat RuleSet.
 *
 * Dua jenis:
 * - `combined` (8 baris): A, R, dan satu keyakinan gabungan C — tabel PRD §6.2.
 * - `per_tier` (16 baris): A, R, keyakinan jawaban CA, dan keyakinan alasan CR
 *   terpisah — dibutuhkan Pedoman Pengkategorian instrumen (tabel D.2), yang
 *   membedakan "keyakinan konsisten" dari "keyakinan tidak konsisten".
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

const CategoryEnum = z.enum(CATEGORIES);

const CombinedRule = z.object({ A: z.boolean(), R: z.boolean(), C: z.boolean(), category: CategoryEnum });
const PerTierRule = z.object({
  /** Nomor baris pada tabel sumber, untuk ketertelusuran. */
  no: z.number().int().min(1).optional(),
  A: z.boolean(),
  R: z.boolean(),
  CA: z.boolean(),
  CR: z.boolean(),
  category: CategoryEnum,
});
export type CombinedRule = z.infer<typeof CombinedRule>;
export type PerTierRule = z.infer<typeof PerTierRule>;
/** @deprecated nama lama; sama dengan CombinedRule. */
export type Rule = CombinedRule;

type Var = "A" | "R" | "C" | "CA" | "CR";
type Combo = Partial<Record<Var, boolean>>;

export interface RuleSetAnalysis {
  complete: boolean;
  exclusive: boolean;
  missing: Combo[];
  duplicates: (Combo & { categories: Category[] })[];
}

function combos(vars: readonly Var[]): Combo[] {
  return vars.reduce<Combo[]>(
    (acc, v) => acc.flatMap((c) => [true, false].map((b) => ({ ...c, [v]: b }))),
    [{}],
  );
}

const VARS: Record<"combined" | "per_tier", readonly Var[]> = {
  combined: ["A", "R", "C"],
  per_tier: ["A", "R", "CA", "CR"],
};

export function analyzeRules(
  rules: readonly (Combo & { category: Category })[],
  kind: keyof typeof VARS = "combined",
): RuleSetAnalysis {
  const vars = VARS[kind];
  const missing: Combo[] = [];
  const duplicates: RuleSetAnalysis["duplicates"] = [];
  for (const combo of combos(vars)) {
    const hits = rules.filter((r) => vars.every((v) => r[v] === combo[v]));
    if (hits.length === 0) missing.push(combo);
    if (hits.length > 1) duplicates.push({ ...combo, categories: hits.map((h) => h.category) });
  }
  return { complete: missing.length === 0, exclusive: duplicates.length === 0, missing, duplicates };
}

/**
 * Perlakuan respons yang tier-nya belum lengkap saat dikumpulkan:
 * null = tidak diklasifikasi (dikeluarkan); kategori = diklasifikasi sebagai kategori itu
 * (Pedoman instrumen: tier kosong → E).
 */
const IncompleteCategory = CategoryEnum.nullable().default(null);

const Base = {
  rule_set_id: z.string().regex(/^[a-z0-9-]+$/, "rule_set_id: huruf kecil, angka, tanda hubung"),
  source: z.string().min(1).optional(),
  incomplete_category: IncompleteCategory,
};

function refineComplete(kind: keyof typeof VARS) {
  return (rs: { rules: (Combo & { category: Category })[] }, ctx: z.RefinementCtx) => {
    const a = analyzeRules(rs.rules, kind);
    if (!a.complete) {
      ctx.addIssue({ code: "custom", path: ["rules"], message: `Aturan belum lengkap: ${JSON.stringify(a.missing)}` });
    }
    if (!a.exclusive) {
      ctx.addIssue({ code: "custom", path: ["rules"], message: `Aturan tumpang tindih: ${JSON.stringify(a.duplicates)}` });
    }
  };
}

export const CombinedRuleSet = z
  .object({
    ...Base,
    kind: z.literal("combined"),
    confidence_mode: ConfidenceMode,
    rules: z.array(CombinedRule).length(8),
  })
  .superRefine(refineComplete("combined"));

export const PerTierRuleSet = z
  .object({
    ...Base,
    kind: z.literal("per_tier"),
    rules: z.array(PerTierRule).length(16),
  })
  .superRefine(refineComplete("per_tier"));

export const RuleSet = z.discriminatedUnion("kind", [CombinedRuleSet, PerTierRuleSet]);
export type RuleSet = z.infer<typeof RuleSet>;
export type CombinedRuleSet = z.infer<typeof CombinedRuleSet>;
export type PerTierRuleSet = z.infer<typeof PerTierRuleSet>;

/**
 * Asumsi PRD §6.2 (8 baris). Sumber: data/rule-sets/default-v1.json.
 * Tidak dipakai untuk instrumen four-tier baku; lihat PEDOMAN_V1_RULE_SET.
 */
export const DEFAULT_RULE_SET = CombinedRuleSet.parse(defaultV1);

/**
 * Pedoman Pengkategorian Konsepsi, tabel D.2 dokumen instrumen (16 baris,
 * tier kosong → E). Sumber: data/rule-sets/pedoman-v1.json.
 */
export const PEDOMAN_V1_RULE_SET = PerTierRuleSet.parse(pedomanV1);

export const RULE_SETS: Readonly<Record<string, RuleSet>> = {
  [DEFAULT_RULE_SET.rule_set_id]: DEFAULT_RULE_SET,
  [PEDOMAN_V1_RULE_SET.rule_set_id]: PEDOMAN_V1_RULE_SET,
};

export function getRuleSet(id: string): RuleSet {
  const rs = RULE_SETS[id];
  if (!rs) throw new Error(`rule_set_id tidak dikenal: ${id}`);
  return rs;
}

/** Cari kategori. `CA`/`CR` dipakai aturan per_tier; `C` dipakai aturan combined. */
export function lookupCategory(
  ruleSet: RuleSet,
  v: { A: boolean; R: boolean; C: boolean; CA: boolean | null; CR: boolean | null },
): Category {
  const rule =
    ruleSet.kind === "combined"
      ? ruleSet.rules.find((r) => r.A === v.A && r.R === v.R && r.C === v.C)
      : ruleSet.rules.find((r) => r.A === v.A && r.R === v.R && r.CA === v.CA && r.CR === v.CR);
  // RuleSet tervalidasi lengkap, jadi ini hanya terjadi bila objek dibuat tanpa parse.
  if (!rule) throw new Error(`Aturan ${ruleSet.rule_set_id} tidak punya kombinasi ${JSON.stringify(v)}`);
  return rule.category;
}
