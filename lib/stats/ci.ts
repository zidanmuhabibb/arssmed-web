import { studentTPpf } from "./distributions";

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  level: number;
  margin: number;
  se: number;
  tCritical: number;
  df: number;
}

/**
 * CI rerata berbasis distribusi t: mean ± t(1−α/2; n−1) × SD/√n (PRD §7.1).
 * Bisa dihitung dari ringkasan saja (mean, sd, n) — dipakai untuk fixture artikel.
 */
export function meanCI({ mean, sd, n, level = 0.95 }: { mean: number; sd: number; n: number; level?: number }): ConfidenceInterval {
  if (!Number.isInteger(n) || n < 2) throw new Error(`n harus bilangan bulat ≥ 2: ${n}`);
  if (!(sd >= 0)) throw new Error(`sd tidak valid: ${sd}`);
  if (!(level > 0 && level < 1)) throw new Error(`level harus di (0,1): ${level}`);
  const df = n - 1;
  const tCritical = studentTPpf(1 - (1 - level) / 2, df);
  const se = sd / Math.sqrt(n);
  const margin = tCritical * se;
  return { lower: mean - margin, upper: mean + margin, level, margin, se, tCritical, df };
}
