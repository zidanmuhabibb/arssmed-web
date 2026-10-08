/**
 * Alur belajar per unit (FR-20…24): Tebak → Amati → Bandingkan → Jelaskan. Murni dan teruji.
 * Urutan dijaga agar siswa menebak SEBELUM mengamati (syarat konflik kognitif, PRD §4.2).
 */
export const STEPS = ["tebak", "amati", "bandingkan", "jelaskan"] as const;
export type Step = (typeof STEPS)[number];
export type StepStatus = "done" | "current" | "locked";
export type UnitStatus = "notStarted" | "inProgress" | "done";

export function isStep(x: unknown): x is Step {
  return typeof x === "string" && (STEPS as readonly string[]).includes(x);
}

/** Langkah terbuka bila semua langkah sebelumnya selesai. */
export function stepStatus(done: readonly Step[], step: Step): StepStatus {
  if (done.includes(step)) return "done";
  const i = STEPS.indexOf(step);
  return STEPS.slice(0, i).every((s) => done.includes(s)) ? "current" : "locked";
}

export function canOpen(done: readonly Step[], step: Step) {
  return stepStatus(done, step) !== "locked";
}

export function nextStep(done: readonly Step[]): Step | null {
  return STEPS.find((s) => !done.includes(s)) ?? null;
}

export function unitStatus(done: readonly Step[]): UnitStatus {
  if (STEPS.every((s) => done.includes(s))) return "done";
  return done.length > 0 ? "inProgress" : "notStarted";
}

/** Langkah sebelumnya yang wajib selesai sebelum membuka `step` (null bila sudah boleh). */
export function blockingStep(done: readonly Step[], step: Step): Step | null {
  const i = STEPS.indexOf(step);
  return STEPS.slice(0, i).find((s) => !done.includes(s)) ?? null;
}

/**
 * FR-22: tombol lanjut dari Amati aktif bila semua objek wajib sudah dibuka
 * minimal sekali, atau guru mengaktifkan mode bebas.
 */
export function canFinishObserve(viewed: readonly string[], required: readonly string[], freeMode: boolean) {
  return freeMode || required.every((id) => viewed.includes(id));
}

/** Tebak selesai bila semua pertanyaan prediksi unit sudah dijawab. */
export function predictionsComplete(answers: Readonly<Record<string, string>>, keys: readonly string[]) {
  return keys.length > 0 && keys.every((k) => typeof answers[k] === "string");
}

/** Bandingkan: kalimat netral, tanpa kata "salah"/"benar" (PRD §8.6). */
export function compareTone(selected: string | undefined, scientific: string): "same" | "different" | "missing" {
  if (!selected) return "missing";
  return selected === scientific ? "same" : "different";
}

// ---------------------------------------------------------------- status gabungan (perangkat + server)

export interface LearningState {
  steps: Record<string, Step[]>;
  predictions: Record<string, string>;
  viewed: Record<string, string[]>;
  discussed: string[];
}

export const EMPTY_STATE: LearningState = { steps: {}, predictions: {}, viewed: {}, discussed: [] };

const union = <T,>(a: readonly T[] = [], b: readonly T[] = []) => [...new Set([...a, ...b])];

/**
 * Gabungkan status. Jawaban prediksi TIDAK pernah ditimpa: jawaban pertama yang tersimpan
 * yang berlaku (server didahulukan), agar tebakan awal tetap utuh untuk penelitian.
 */
export function mergeStates(primary: LearningState, secondary: LearningState): LearningState {
  const units = union(Object.keys(primary.steps), Object.keys(secondary.steps));
  const vUnits = union(Object.keys(primary.viewed), Object.keys(secondary.viewed));
  return {
    steps: Object.fromEntries(units.map((u) => [u, STEPS.filter((s) => union(primary.steps[u], secondary.steps[u]).includes(s))])),
    predictions: { ...secondary.predictions, ...primary.predictions },
    viewed: Object.fromEntries(vUnits.map((u) => [u, union(primary.viewed[u], secondary.viewed[u])])),
    discussed: union(primary.discussed, secondary.discussed),
  };
}

/** Item yang ada di `local` tetapi belum di `server` — dikirim ulang setelah koneksi pulih. */
export function pendingSync(local: LearningState, server: LearningState) {
  const steps: { unit: string; step: Step }[] = [];
  for (const [u, ss] of Object.entries(local.steps)) for (const s of ss) if (!server.steps[u]?.includes(s)) steps.push({ unit: u, step: s });
  const predictions = Object.entries(local.predictions)
    .filter(([k]) => !(k in server.predictions))
    .map(([key, option]) => ({ key, option }));
  const views: { unit: string; object: string }[] = [];
  for (const [u, ids] of Object.entries(local.viewed)) for (const id of ids) if (!server.viewed[u]?.includes(id)) views.push({ unit: u, object: id });
  const discussed = local.discussed.filter((u) => !server.discussed.includes(u));
  return { steps, predictions, views, discussed, empty: steps.length + predictions.length + views.length + discussed.length === 0 };
}
