/**
 * Cohen's d_z untuk selisih berpasangan: d̄ ÷ s_d.
 * Hedges' g_z: d_z × J, J = 1 − 3 ÷ (4·df − 1), df = n − 1.
 */
export function cohenDz(meanDiff: number, sdDiff: number): number {
  if (sdDiff === 0) return meanDiff === 0 ? 0 : Math.sign(meanDiff) * Infinity;
  return meanDiff / sdDiff;
}

export function hedgesCorrection(df: number): number {
  return 1 - 3 / (4 * df - 1);
}

export function hedgesGz(meanDiff: number, sdDiff: number, n: number): number {
  return cohenDz(meanDiff, sdDiff) * hedgesCorrection(n - 1);
}
