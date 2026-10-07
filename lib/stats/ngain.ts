import { meanCI, type ConfidenceInterval } from "./ci";
import { mean, sd } from "./descriptive";

export const NGAIN_THRESHOLDS = { high: 0.7, medium: 0.3 } as const;
export type NGainCategory = "tinggi" | "sedang" | "rendah";

/**
 * N-Gain individual (Hake, 1998): g = (post − pre) ÷ (maks − pre).
 * Skor dalam skala 0..maks (default 100). Bila pre = maks, g tidak terdefinisi → null.
 */
export function individualNGain(pre: number, post: number, max = 100): number | null {
  for (const [name, v] of [["pre", pre], ["post", post]] as const) {
    if (!Number.isFinite(v) || v < 0 || v > max) throw new Error(`${name} di luar 0..${max}: ${v}`);
  }
  if (pre === max) return null;
  return (post - pre) / (max - pre);
}

/**
 * Kategori Hake dengan batas eksplisit (PRD §7.1):
 * tinggi: g ≥ 0,70 · sedang: 0,30 ≤ g < 0,70 · rendah: g < 0,30 (termasuk g negatif).
 */
export function nGainCategory(g: number): NGainCategory {
  if (g >= NGAIN_THRESHOLDS.high) return "tinggi";
  if (g >= NGAIN_THRESHOLDS.medium) return "sedang";
  return "rendah";
}

export interface NGainSummary {
  /** Rerata N-Gain individual (skala 0–1). */
  mean: number;
  sd: number;
  ci: ConfidenceInterval;
  n: number;
  /** Siswa dengan pre = maks (g tidak terdefinisi), dikeluarkan dari rerata. */
  excludedPreMax: number;
  category: NGainCategory;
  individual: { index: number; g: number | null; category: NGainCategory | null }[];
}

/** Ringkasan N-Gain kelas dari pasangan skor pre/post (urutan sama). */
export function summarizeNGain(pre: readonly number[], post: readonly number[], max = 100, level = 0.95): NGainSummary {
  if (pre.length !== post.length) throw new Error("pre dan post harus sama panjang");
  const individual = pre.map((p, i) => {
    const g = individualNGain(p, post[i]!, max);
    return { index: i, g, category: g === null ? null : nGainCategory(g) };
  });
  const gs = individual.map((x) => x.g).filter((g): g is number => g !== null);
  if (gs.length < 2) throw new Error("Butuh minimal dua siswa dengan N-Gain terdefinisi");
  const m = mean(gs);
  const s = sd(gs);
  return {
    mean: m,
    sd: s,
    ci: meanCI({ mean: m, sd: s, n: gs.length, level }),
    n: gs.length,
    excludedPreMax: individual.length - gs.length,
    category: nGainCategory(m),
    individual,
  };
}
