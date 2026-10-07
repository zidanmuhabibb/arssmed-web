import type { Category } from "./categories";
import { requiredConfidenceTiers, type TestItemContent } from "./item";
import { lookupCategory, type RuleSet } from "./rules";

/** Jawaban mentah satu butir (kolom `item_responses`). Indeks keyakinan 0 = paling yakin. */
export interface RawResponse {
  tier1Key: string | null;
  reasonKey: string | null;
  /** Keyakinan atas jawaban (tier 2 baku). null untuk format modified_tier2. */
  confidenceA: number | null;
  /** Keyakinan atas alasan (tier 4 baku / bagian dari tier 2 modifikasi). */
  confidenceR: number | null;
}

export type Classification =
  | {
      status: "classified";
      aCorrect: boolean;
      rCorrect: boolean;
      confident: boolean;
      category: Category;
      ruleSetId: string;
    }
  | {
      status: "incomplete";
      missing: ("tier1" | "reason" | "confidenceA" | "confidenceR")[];
      ruleSetId: string;
    }
  | {
      status: "invalid";
      reason: string;
      ruleSetId: string;
    };

function isConfident(index: number, thresholdIndex: number) {
  return index <= thresholdIndex;
}

/**
 * Klasifikasi satu respons (fungsi murni). Jawaban mentah tidak diubah;
 * hasilnya adalah data turunan yang membawa `ruleSetId` (PRD §9.2 prinsip 2).
 */
export function classifyResponse(item: TestItemContent, response: RawResponse, ruleSet: RuleSet): Classification {
  const ruleSetId = ruleSet.rule_set_id;
  const required = requiredConfidenceTiers(item.format);
  const needA = required.includes("answer");
  const needR = required.includes("reason");

  const missing: ("tier1" | "reason" | "confidenceA" | "confidenceR")[] = [];
  if (response.tier1Key == null) missing.push("tier1");
  if (response.reasonKey == null) missing.push("reason");
  if (needA && response.confidenceA == null) missing.push("confidenceA");
  if (needR && response.confidenceR == null) missing.push("confidenceR");
  if (missing.length > 0) return { status: "incomplete", missing, ruleSetId };

  if (!item.tier1.options.some((o) => o.key === response.tier1Key)) {
    return { status: "invalid", reason: `Opsi tier 1 tidak dikenal: ${response.tier1Key}`, ruleSetId };
  }
  if (!item.reason.options.some((o) => o.key === response.reasonKey)) {
    return { status: "invalid", reason: `Opsi alasan tidak dikenal: ${response.reasonKey}`, ruleSetId };
  }
  const nLevels = item.confidence.levels.length;
  for (const [name, value] of [
    ["confidenceA", needA ? response.confidenceA : null],
    ["confidenceR", needR ? response.confidenceR : null],
  ] as const) {
    if (value != null && (!Number.isInteger(value) || value < 0 || value >= nLevels)) {
      return { status: "invalid", reason: `${name} di luar skala 0..${nLevels - 1}: ${value}`, ruleSetId };
    }
  }

  const t = item.confidence.threshold_index;
  const confA = needA ? isConfident(response.confidenceA!, t) : null;
  const confR = needR ? isConfident(response.confidenceR!, t) : null;

  let confident: boolean;
  switch (ruleSet.confidence_mode) {
    case "all_tiers_at_or_above_threshold":
      confident = [confA, confR].filter((c): c is boolean => c !== null).every(Boolean);
      break;
    case "answer_tier_only":
      if (confA === null) {
        return { status: "invalid", reason: "Mode answer_tier_only butuh format four_tier_standard", ruleSetId };
      }
      confident = confA;
      break;
    case "reason_tier_only":
      confident = confR!;
      break;
  }

  const aCorrect = response.tier1Key === item.tier1.correct;
  const rCorrect = response.reasonKey === item.reason.correct;
  return {
    status: "classified",
    aCorrect,
    rCorrect,
    confident,
    category: lookupCategory(ruleSet, aCorrect, rCorrect, confident),
    ruleSetId,
  };
}

export interface OutcomeRow {
  tier1Key: string;
  reasonKey: string;
  confidenceA: number | null;
  confidenceR: number | null;
  category: Category;
}

/**
 * "Uji aturan" (FR-54): jalankan SEMUA kombinasi jawaban untuk satu butir dan
 * laporkan kategori tiap kombinasi beserta rekapnya.
 */
export function enumerateItemOutcomes(item: TestItemContent, ruleSet: RuleSet) {
  const required = requiredConfidenceTiers(item.format);
  const levels = item.confidence.levels.map((_, i) => i);
  const aLevels: (number | null)[] = required.includes("answer") ? levels : [null];
  const rLevels: (number | null)[] = required.includes("reason") ? levels : [null];

  const rows: OutcomeRow[] = [];
  for (const o1 of item.tier1.options)
    for (const or of item.reason.options)
      for (const ca of aLevels)
        for (const cr of rLevels) {
          const c = classifyResponse(
            item,
            { tier1Key: o1.key, reasonKey: or.key, confidenceA: ca, confidenceR: cr },
            ruleSet,
          );
          if (c.status !== "classified") throw new Error(`Kombinasi tidak terklasifikasi: ${JSON.stringify(c)}`);
          rows.push({ tier1Key: o1.key, reasonKey: or.key, confidenceA: ca, confidenceR: cr, category: c.category });
        }

  const totals = { SC: 0, M: 0, E: 0, LK: 0, LC: 0 } as Record<Category, number>;
  for (const r of rows) totals[r.category] += 1;
  return { rows, totals, combinations: rows.length };
}
