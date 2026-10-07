import { rankAverage } from "./descriptive";
import { normalCdf } from "./distributions";

export type WilcoxonMethod = "exact" | "permutation" | "asymptotic";

export interface WilcoxonResult {
  /** Jumlah pasangan sebelum selisih nol dibuang. */
  n: number;
  /** Pasangan dengan selisih ≠ 0 (yang diperingkat). */
  nNonZero: number;
  nZero: number;
  /** W = min(R+, R−) untuk uji dua sisi (konvensi SciPy). */
  W: number;
  rPlus: number;
  rMinus: number;
  /** z normal (tanpa koreksi kontinuitas, dengan koreksi seri); selalu ≤ 0 untuk dua sisi. */
  z: number;
  /** Ukuran efek r = |z| ÷ √nNonZero. */
  r: number;
  p: number;
  method: WilcoxonMethod;
  hasTies: boolean;
}

/**
 * Uji peringkat bertanda Wilcoxon dua sisi pada selisih post − pre.
 * Mengikuti scipy.stats.wilcoxon(post, pre) default (zero_method="wilcox",
 * correction=False, method="auto"):
 *  - n > 50 → asimtotik
 *  - tanpa seri dan tanpa nol → distribusi eksak
 *  - ada seri/nol dan n ≤ 13 → uji permutasi eksak (2ⁿ tanda)
 *  - selain itu → asimtotik dengan koreksi seri
 */
export function wilcoxonSignedRank(pre: readonly number[], post: readonly number[]): WilcoxonResult {
  if (pre.length !== post.length) throw new Error("pre dan post harus sama panjang");
  const n = pre.length;
  if (n === 0) throw new Error("Butuh minimal satu pasangan");
  const dAll = post.map((v, i) => v - pre[i]!);
  const d = dAll.filter((x) => x !== 0);
  const nZero = n - d.length;
  const count = d.length;
  if (count === 0) throw new Error("Semua selisih nol: uji Wilcoxon tidak terdefinisi");

  const ranks = rankAverage(d.map(Math.abs));
  let rPlus = 0;
  let rMinus = 0;
  d.forEach((x, i) => {
    if (x > 0) rPlus += ranks[i]!;
    else rMinus += ranks[i]!;
  });

  // Koreksi seri: Σ(t³ − t) atas kelompok |d| yang sama
  const groups = new Map<number, number>();
  for (const x of d) groups.set(Math.abs(x), (groups.get(Math.abs(x)) ?? 0) + 1);
  let tieCorrect = 0;
  for (const t of groups.values()) tieCorrect += t ** 3 - t;
  const hasTies = [...groups.values()].some((t) => t > 1);

  const mn = (count * (count + 1)) / 4;
  const seRaw = count * (count + 1) * (2 * count + 1);
  const se = Math.sqrt((seRaw - tieCorrect / 2) / 24);
  const zSigned = (rPlus - mn) / se;

  let method: WilcoxonMethod;
  if (n > 50) method = "asymptotic";
  else if (!hasTies && nZero === 0) method = "exact";
  else if (n <= 13) method = "permutation";
  else method = "asymptotic";

  let p: number;
  if (method === "asymptotic") {
    p = 2 * normalCdf(-Math.abs(zSigned));
  } else if (method === "exact") {
    const { cdf, sf } = exactSignedRankDistribution(count);
    p = Math.min(1, 2 * Math.min(sf(Math.floor(rPlus)), cdf(Math.ceil(rPlus))));
  } else {
    p = permutationP(dAll, rPlus);
  }

  return {
    n,
    nNonZero: count,
    nZero,
    W: Math.min(rPlus, rMinus),
    rPlus,
    rMinus,
    z: -Math.abs(zSigned),
    r: Math.abs(zSigned) / Math.sqrt(count),
    p: Math.min(1, Math.max(0, p)),
    method,
    hasTies,
  };
}

/** Distribusi nol eksak T+ untuk n tanpa seri: jumlah subset {1..n} per total. */
function exactSignedRankDistribution(n: number) {
  const max = (n * (n + 1)) / 2;
  let counts = new Float64Array(max + 1);
  counts[0] = 1;
  for (let k = 1; k <= n; k++) {
    const next = new Float64Array(max + 1);
    for (let s = 0; s <= max; s++) {
      if (counts[s] === 0) continue;
      next[s]! += counts[s]!;
      if (s + k <= max) next[s + k]! += counts[s]!;
    }
    counts = next;
  }
  const total = 2 ** n;
  const cum = new Float64Array(max + 1);
  let acc = 0;
  for (let s = 0; s <= max; s++) {
    acc += counts[s]!;
    cum[s] = acc;
  }
  const cdf = (k: number) => (k < 0 ? 0 : k >= max ? 1 : cum[k]! / total);
  const sf = (k: number) => 1 - cdf(k - 1); // P(T ≥ k), seperti SciPy
  return { cdf, sf };
}

/**
 * Uji permutasi eksak: semua 2ⁿ pembalikan tanda (setara
 * scipy.stats.permutation_test permutation_type="samples" untuk n ≤ 13).
 * Selisih nol tetap ikut dibalik tetapi tidak berkontribusi pada R+.
 */
function permutationP(dAll: readonly number[], observed: number): number {
  const n = dAll.length;
  const total = 2 ** n;
  const eps = 1e-14 * Math.max(1, Math.abs(observed));
  let le = 0;
  let ge = 0;
  for (let mask = 0; mask < total; mask++) {
    const d = dAll.map((x, i) => ((mask >> i) & 1 ? -x : x));
    const nz = d.filter((x) => x !== 0);
    const ranks = rankAverage(nz.map(Math.abs));
    let rp = 0;
    nz.forEach((x, i) => {
      if (x > 0) rp += ranks[i]!;
    });
    if (rp <= observed + eps) le++;
    if (rp >= observed - eps) ge++;
  }
  return Math.min(1, 2 * Math.min(le / total, ge / total));
}
