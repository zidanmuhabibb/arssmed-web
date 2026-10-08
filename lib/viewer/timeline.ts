/**
 * Garis waktu animasi berlangkah (FR-13): putar/jeda, maju/mundur langkah, kecepatan.
 * Murni: posisi dihitung dari waktu, tidak ada state tersembunyi.
 */
export interface Timeline {
  steps: number;
  /** Durasi tiap langkah pada kecepatan 1× (detik). */
  stepSeconds: number;
}

export const SPEEDS = [0.5, 1, 2] as const;
export type Speed = (typeof SPEEDS)[number];

/** Posisi (0 … steps) → indeks langkah 0-based dan kemajuan di dalam langkah (0–1). */
export function locate(tl: Timeline, position: number) {
  const p = Math.min(Math.max(position, 0), tl.steps);
  const step = Math.min(Math.floor(p), tl.steps - 1);
  return { step, within: p >= tl.steps ? 1 : p - step };
}

/** Majukan posisi sebanyak dt detik pada kecepatan tertentu; berhenti di akhir. */
export function advance(tl: Timeline, position: number, dt: number, speed: number) {
  const next = position + (dt * speed) / tl.stepSeconds;
  return { position: Math.min(next, tl.steps), ended: next >= tl.steps };
}

export function stepForward(tl: Timeline, position: number) {
  return Math.min(Math.floor(position) + 1, tl.steps - 1 + 0.999);
}

export function stepBack(tl: Timeline, position: number) {
  const s = Math.floor(position);
  return Math.max(0, position - s > 0.05 ? s : s - 1);
}
