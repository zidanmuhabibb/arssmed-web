/**
 * Aturan sesi tes untuk satu butir (FR-31…FR-33). Murni; dipakai di klien (UI) dan server (validasi).
 */
import type { ItemFormat } from "@/lib/classification";

export type TierField = "tier1" | "confidenceA" | "reason" | "confidenceR";

export interface Answer {
  tier1: string | null;
  confidenceA: number | null;
  reason: string | null;
  confidenceR: number | null;
}

export const EMPTY_ANSWER: Answer = { tier1: null, confidenceA: null, reason: null, confidenceR: null };

/** Urutan tier yang ditampilkan bertahap (FR-32). Format modifikasi tidak punya keyakinan jawaban. */
export function tierOrder(format: ItemFormat): TierField[] {
  return format === "four_tier_standard" ? ["tier1", "confidenceA", "reason", "confidenceR"] : ["tier1", "reason", "confidenceR"];
}

/** Tier yang terlihat: semua yang sudah dijawab + tier pertama yang belum (siswa tidak bisa melewati tier). */
export function visibleTiers(format: ItemFormat, a: Answer): TierField[] {
  const order = tierOrder(format);
  const out: TierField[] = [];
  for (const f of order) {
    out.push(f);
    if (a[f] === null) break;
  }
  return out;
}

export function isComplete(format: ItemFormat, a: Answer | undefined) {
  return !!a && tierOrder(format).every((f) => a[f] !== null);
}

/** Jumlah butir terjawab lengkap. */
export function countComplete(items: readonly { id: string; format: ItemFormat }[], answers: Readonly<Record<string, Answer>>) {
  return items.filter((i) => isComplete(i.format, answers[i.id])).length;
}

/** Butir pertama yang belum lengkap (untuk melanjutkan tes), atau null. */
export function firstIncomplete(items: readonly { id: string; format: ItemFormat }[], answers: Readonly<Record<string, Answer>>) {
  const i = items.findIndex((x) => !isComplete(x.format, answers[x.id]));
  return i < 0 ? null : i;
}

/**
 * Validasi jawaban terhadap butir (server): kunci harus ada, keyakinan dalam skala, dan tidak ada
 * tier yang diisi sebelum tier sebelumnya (urutan bertahap).
 */
export function validateAnswer(
  item: { format: ItemFormat; tier1Keys: readonly string[]; reasonKeys: readonly string[]; levels: number },
  a: Answer,
): string | null {
  if (a.tier1 !== null && !item.tier1Keys.includes(a.tier1)) return "tier1";
  if (a.reason !== null && !item.reasonKeys.includes(a.reason)) return "reason";
  for (const f of ["confidenceA", "confidenceR"] as const) {
    const v = a[f];
    if (v !== null && (!Number.isInteger(v) || v < 0 || v >= item.levels)) return f;
  }
  if (item.format === "modified_tier2" && a.confidenceA !== null) return "confidenceA";
  const order = tierOrder(item.format);
  let gap = false;
  for (const f of order) {
    if (a[f] === null) gap = true;
    else if (gap) return "order";
  }
  return null;
}
