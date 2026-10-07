import { z } from "zod";
import type { Category } from "./categories";

/** Pilihan skor untuk N-Gain dan uji-t (PRD §6.3). Dicatat di setiap ekspor. */
export const ScoreMethod = z.enum(["score_sc", "score_tier1"]);
export type ScoreMethod = z.infer<typeof ScoreMethod>;
export const DEFAULT_SCORE_METHOD: ScoreMethod = "score_sc";

export interface ScoredItem {
  category: Category;
  aCorrect: boolean;
}

/**
 * Skor 0–100 seorang siswa pada satu fase.
 * `totalItems` adalah jumlah butir tes (bukan jumlah yang dijawab): butir yang
 * tidak terklasifikasi dihitung bukan-SC / bukan-benar.
 */
export function computeScore(items: readonly ScoredItem[], totalItems: number, method: ScoreMethod): number {
  if (!Number.isInteger(totalItems) || totalItems <= 0) {
    throw new Error(`totalItems harus bilangan bulat positif: ${totalItems}`);
  }
  if (items.length > totalItems) {
    throw new Error(`Jumlah respons (${items.length}) melebihi jumlah butir (${totalItems})`);
  }
  const hits = items.filter((i) => (method === "score_sc" ? i.category === "SC" : i.aCorrect)).length;
  return (hits / totalItems) * 100;
}
