import { meanCI, type ConfidenceInterval } from "./ci";
import { mean, sd } from "./descriptive";
import { studentTTwoSidedP } from "./distributions";
import { cohenDz, hedgesGz } from "./effect-size";

export interface PairedTTestResult {
  n: number;
  df: number;
  /** d̄ = rerata (post − pre). */
  meanDiff: number;
  sdDiff: number;
  t: number;
  /** p dua sisi. */
  p: number;
  ciDiff: ConfidenceInterval;
  cohenDz: number;
  hedgesGz: number;
  /** true bila semua selisih identik (s_d = 0): t tidak terdefinisi. */
  degenerate: boolean;
}

/** Uji-t sampel berpasangan dua sisi (setara scipy.stats.ttest_rel(post, pre)). */
export function pairedTTest(pre: readonly number[], post: readonly number[], level = 0.95): PairedTTestResult {
  if (pre.length !== post.length) throw new Error("pre dan post harus sama panjang");
  if (pre.length < 2) throw new Error("Butuh minimal dua pasangan");
  const d = post.map((v, i) => v - pre[i]!);
  const n = d.length;
  const df = n - 1;
  const meanDiff = mean(d);
  const sdDiff = sd(d);
  const degenerate = sdDiff === 0;
  const t = degenerate ? (meanDiff === 0 ? NaN : Math.sign(meanDiff) * Infinity) : meanDiff / (sdDiff / Math.sqrt(n));
  return {
    n,
    df,
    meanDiff,
    sdDiff,
    t,
    p: studentTTwoSidedP(t, df),
    ciDiff: meanCI({ mean: meanDiff, sd: sdDiff, n, level }),
    cohenDz: cohenDz(meanDiff, sdDiff),
    hedgesGz: hedgesGz(meanDiff, sdDiff, n),
    degenerate,
  };
}
