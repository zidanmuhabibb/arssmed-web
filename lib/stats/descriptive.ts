/** Statistik deskriptif dasar (SD memakai penyebut n − 1). */

function assertFinite(xs: readonly number[]) {
  for (const x of xs) if (!Number.isFinite(x)) throw new Error(`Nilai tidak valid: ${x}`);
}

export function mean(xs: readonly number[]): number {
  if (xs.length === 0) throw new Error("mean butuh minimal satu nilai");
  assertFinite(xs);
  // Penjumlahan Kahan agar stabil
  let sum = 0;
  let c = 0;
  for (const x of xs) {
    const y = x - c;
    const t = sum + y;
    c = t - sum - y;
    sum = t;
  }
  return sum / xs.length;
}

/** Simpangan baku sampel (n − 1). */
export function sd(xs: readonly number[]): number {
  if (xs.length < 2) throw new Error("sd butuh minimal dua nilai");
  const m = mean(xs);
  let ss = 0;
  for (const x of xs) ss += (x - m) ** 2;
  return Math.sqrt(ss / (xs.length - 1));
}

/** Varians populasi (n). */
export function variancePopulation(xs: readonly number[]): number {
  const m = mean(xs);
  let ss = 0;
  for (const x of xs) ss += (x - m) ** 2;
  return ss / xs.length;
}

export function se(xs: readonly number[]): number {
  return sd(xs) / Math.sqrt(xs.length);
}

/** Peringkat rata-rata untuk nilai seri (setara scipy.stats.rankdata 'average'). */
export function rankAverage(xs: readonly number[]): number[] {
  const idx = xs.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const ranks = new Array<number>(xs.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1]![0] === idx[i]![0]) j++;
    const r = (i + j + 2) / 2;
    for (let k = i; k <= j; k++) ranks[idx[k]![1]] = r;
    i = j + 1;
  }
  return ranks;
}
