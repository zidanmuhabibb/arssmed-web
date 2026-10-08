/** Kemajuan "Rel Orbit": objek yang sudah dilihat (FR-12, FR-22). Murni. */
export function markViewed(viewed: readonly string[], id: string): string[] {
  return viewed.includes(id) ? [...viewed] : [...viewed, id];
}

export function progressOf(viewed: readonly string[], all: readonly string[]) {
  const seen = all.filter((id) => viewed.includes(id)).length;
  return { seen, total: all.length, complete: all.length > 0 && seen === all.length };
}

export function nextUnviewed(viewed: readonly string[], all: readonly string[], current: string): string | null {
  const i = all.indexOf(current);
  const order = [...all.slice(i + 1), ...all.slice(0, Math.max(0, i))];
  return order.find((id) => !viewed.includes(id)) ?? null;
}

/** Baca/simpan aman (localStorage bisa tidak tersedia). */
export function loadViewed(key: string): string[] {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    const v = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
export function saveViewed(key: string, viewed: readonly string[]) {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(viewed));
  } catch {
    // abaikan: kemajuan hanya kenyamanan per perangkat (disimpan ke DB di M4)
  }
}
