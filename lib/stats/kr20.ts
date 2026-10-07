import { variancePopulation } from "./descriptive";

export type KR20Variance = "population" | "sample";

/**
 * Reliabilitas KR-20 dari matriks respons 0/1 (baris = siswa, kolom = butir).
 * KR-20 = k/(k−1) × (1 − Σ p·q ÷ σ²_X).
 * Default σ²_X populasi (÷ N), konsisten dengan p·q yang juga populasi (DECISIONS D-019).
 */
export function kr20(matrix: readonly (readonly (0 | 1)[])[], variance: KR20Variance = "population") {
  const N = matrix.length;
  if (N < 2) throw new Error("KR-20 butuh minimal dua siswa");
  const k = matrix[0]!.length;
  if (k < 2) throw new Error("KR-20 butuh minimal dua butir");
  for (const row of matrix) {
    if (row.length !== k) throw new Error("Semua baris harus punya jumlah butir yang sama");
    for (const v of row) if (v !== 0 && v !== 1) throw new Error(`Nilai harus 0/1: ${v}`);
  }
  let sumPQ = 0;
  for (let j = 0; j < k; j++) {
    let s = 0;
    for (const row of matrix) s += row[j]!;
    const p = s / N;
    sumPQ += p * (1 - p);
  }
  const totals = matrix.map((row) => row.reduce<number>((a, b) => a + b, 0));
  let varX = variancePopulation(totals);
  if (variance === "sample") varX = (varX * N) / (N - 1);
  if (varX === 0) return { kr20: NaN, k, n: N, sumPQ, varianceTotal: 0 };
  return { kr20: (k / (k - 1)) * (1 - sumPQ / varX), k, n: N, sumPQ, varianceTotal: varX };
}
