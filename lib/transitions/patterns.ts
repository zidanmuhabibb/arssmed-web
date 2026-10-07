import { CATEGORIES, type Category } from "../classification/categories";

/** Pola transisi (PRD §6.5, Lampiran 4 sempro). `other` = "Lainnya". */
export const PATTERNS = ["retention", "revision", "construction", "static", "other"] as const;
export type Pattern = (typeof PATTERNS)[number];

export const PATTERN_LABEL_ID: Record<Pattern, string> = {
  retention: "Retensi",
  revision: "Revisi",
  construction: "Konstruksi",
  static: "Statis",
  other: "Lainnya",
};

/**
 * Tabel pemetaan sebagai data. Kombinasi yang tidak tercantum TIDAK diabaikan:
 * otomatis menjadi `other` (PRD §6.5).
 */
export const PATTERN_MAP: Readonly<Record<string, Exclude<Pattern, "other">>> = {
  "SC>SC": "retention",
  "M>SC": "revision",
  "E>SC": "revision",
  "M>LC": "revision",
  "M>E": "revision",
  "LK>SC": "construction",
  "M>M": "static",
  "E>E": "static",
  "SC>E": "static",
};

export function transitionPattern(pre: Category, post: Category): Pattern {
  return PATTERN_MAP[`${pre}>${post}`] ?? "other";
}

/** Prioritas pemecah seri untuk kategori dominan: M > E > LK > LC > SC (konservatif). */
export const TIE_PRIORITY: readonly Category[] = ["M", "E", "LK", "LC", "SC"];

/**
 * Kategori dominan (modus) dari kategori-kategori satu siswa pada satu domain.
 * Seri dipecah dengan TIE_PRIORITY.
 */
export function dominantCategory(categories: readonly Category[]): Category {
  if (categories.length === 0) throw new Error("dominantCategory butuh minimal satu kategori");
  const counts = new Map<Category, number>();
  for (const c of categories) counts.set(c, (counts.get(c) ?? 0) + 1);
  let best: Category = TIE_PRIORITY[0]!;
  let bestCount = -1;
  for (const c of TIE_PRIORITY) {
    const n = counts.get(c) ?? 0;
    if (n > bestCount) {
      best = c;
      bestCount = n;
    }
  }
  return best;
}

export function emptyMatrix(): Record<Category, Record<Category, string[]>> {
  const m = {} as Record<Category, Record<Category, string[]>>;
  for (const a of CATEGORIES) {
    m[a] = {} as Record<Category, string[]>;
    for (const b of CATEGORIES) m[a][b] = [];
  }
  return m;
}
