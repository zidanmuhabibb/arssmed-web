/**
 * Dari butir lengkap (dengan kunci) → butir untuk siswa (tanpa kunci, opsi teracak) dan
 * dari jawaban → klasifikasi. Murni; dipakai kedua backend (memori dan Supabase).
 */
import { classifyResponse, TestItemContent, type RuleSet } from "@/lib/classification";
import type { Answer } from "./session";
import { optionOrder } from "./shuffle";
import type { DeliveredItem } from "./types";

export interface StoredItem {
  id: string;
  order: number;
  content: unknown;
}

export function deliverItems(attemptId: string, items: readonly StoredItem[]): DeliveredItem[] {
  return [...items]
    .sort((a, b) => a.order - b.order)
    .map((it) => {
      const c = TestItemContent.parse(it.content);
      const t1 = optionOrder(c.tier1.options.map((o) => o.key), `${attemptId}:${it.id}:t1`, c.tier1.fixed_order);
      const rs = optionOrder(c.reason.options.map((o) => o.key), `${attemptId}:${it.id}:r`, c.tier1.fixed_order);
      const byKey = <T extends { key: string; text: string }>(opts: T[], keys: string[]) => keys.map((k) => {
        const o = opts.find((x) => x.key === k)!;
        return { key: o.key, text: o.text };
      });
      return {
        id: it.id,
        order: it.order,
        format: c.format,
        stem: c.stem,
        stemImage: c.stem_image,
        tier1: byKey(c.tier1.options, t1),
        reason: byKey(c.reason.options, rs),
        levels: [...c.confidence.levels],
      };
    });
}

/** Ringkasan butir untuk validasi jawaban di server. */
export function itemShape(content: unknown) {
  const c = TestItemContent.parse(content);
  return { format: c.format, tier1Keys: c.tier1.options.map((o) => o.key), reasonKeys: c.reason.options.map((o) => o.key), levels: c.confidence.levels.length };
}

export interface ClassificationRow {
  item_id: string;
  a_correct: boolean;
  r_correct: boolean;
  confident: boolean;
  confident_a: boolean | null;
  confident_r: boolean | null;
  category: string;
}

/** Klasifikasi semua butir satu percobaan dengan aturan tes (PRD §6.2; dihitung di server). */
export function classifyAttempt(items: readonly StoredItem[], answers: Readonly<Record<string, Answer>>, ruleSet: RuleSet): ClassificationRow[] {
  const rows: ClassificationRow[] = [];
  for (const it of items) {
    const a = answers[it.id];
    if (!a) continue;
    const c = classifyResponse(TestItemContent.parse(it.content), { tier1Key: a.tier1, reasonKey: a.reason, confidenceA: a.confidenceA, confidenceR: a.confidenceR }, ruleSet);
    if (c.status !== "classified") throw new Error(`Butir ${it.order} tidak bisa diklasifikasi: ${c.status === "invalid" ? c.reason : c.missing.join(",")}`);
    rows.push({ item_id: it.id, a_correct: c.aCorrect, r_correct: c.rCorrect, confident: c.confident, confident_a: c.confidentA, confident_r: c.confidentR, category: c.category });
  }
  return rows;
}
