import { mean } from "./descriptive";
import { normalCdf, normalPpf } from "./distributions";

export interface ShapiroResult {
  W: number;
  p: number;
  n: number;
}

/**
 * Uji normalitas Shapiro–Wilk (Royston 1992/1995), port dari
 * scipy.stats.shapiro (SciPy ≥ 1.13, implementasi Python `_swilk`).
 * Berlaku untuk 3 ≤ n ≤ 5000.
 */
export function shapiroWilk(xs: readonly number[]): ShapiroResult {
  const n = xs.length;
  if (n < 3) throw new Error("Shapiro-Wilk butuh minimal 3 nilai");
  if (n > 5000) throw new Error("Shapiro-Wilk tidak akurat untuk n > 5000");
  const sorted = [...xs].sort((a, b) => a - b);
  const med = sorted[Math.floor(n / 2)]!;
  const y = sorted.map((v) => v - med);
  if (y[0] === y[n - 1]) throw new Error("Semua nilai sama: Shapiro-Wilk tidak terdefinisi");

  const w = (a: readonly number[]) => {
    let num = 0;
    for (let i = 0; i < n; i++) num += a[i]! * y[i]!;
    const m = mean(y);
    let den = 0;
    for (const v of y) den += (v - m) ** 2;
    return (num * num) / den;
  };

  if (n === 3) {
    const c = Math.SQRT2 / 2;
    const W = Math.min(1, Math.max(0.75, w([-c, 0, c])));
    const p = Math.min(1, Math.max(0, 1 - (6 / Math.PI) * Math.acos(Math.sqrt(W))));
    return { W, p, n };
  }

  const m = Array.from({ length: n }, (_, i) => normalPpf((i + 1 - 3 / 8) / (n + 1 / 4)));
  const u = n ** -0.5;
  const mTm = m.reduce((s, v) => s + v * v, 0);
  const c = m.map((v) => v * mTm ** -0.5);
  const mn = m[n - 1]!;
  const mnm1 = m[n - 2]!;
  const cn = c[n - 1]!;
  const cnm1 = c[n - 2]!;
  const an = cn + 0.221157 * u - 0.147981 * u ** 2 - 2.07119 * u ** 3 + 4.434685 * u ** 4 - 2.706056 * u ** 5;
  const anm1 = cnm1 + 0.042981 * u - 0.293762 * u ** 2 - 1.752461 * u ** 3 + 5.682633 * u ** 4 - 3.582633 * u ** 5;
  const phi =
    n <= 5 ? (mTm - 2 * mn ** 2) / (1 - 2 * an ** 2) : (mTm - 2 * mn ** 2 - 2 * mnm1 ** 2) / (1 - 2 * an ** 2 - 2 * anm1 ** 2);
  const a = m.map((v) => v * phi ** -0.5);
  if (n > 5) {
    a[n - 2] = anm1;
    a[1] = -anm1;
  }
  a[n - 1] = an;
  a[0] = -an;
  const W = w(a);

  let gW: number;
  let mu: number;
  let sigma: number;
  if (n <= 11) {
    const gamma = -2.273 + 0.459 * n;
    mu = 0.544 - 0.39978 * n + 0.025054 * n ** 2 - 0.0006714 * n ** 3;
    sigma = Math.exp(1.3822 - 0.77857 * n + 0.062767 * n ** 2 - 0.0020322 * n ** 3);
    gW = -Math.log(gamma - Math.log(1 - W));
  } else {
    const ln = Math.log(n);
    mu = -1.5861 - 0.31082 * ln - 0.083751 * ln ** 2 + 0.0038915 * ln ** 3;
    sigma = Math.exp(-0.4803 - 0.082676 * ln + 0.0030302 * ln ** 2);
    gW = Math.log(1 - W);
  }
  const z = (gW - mu) / sigma;
  return { W, p: normalCdf(-z), n };
}
