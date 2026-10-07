/** Lima kategori konsepsi (PRD §6.2). Urutan ini dipakai untuk tampilan dan ekspor. */
export const CATEGORIES = ["SC", "M", "E", "LK", "LC"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL_ID: Record<Category, string> = {
  SC: "Konsepsi ilmiah",
  M: "Miskonsepsi",
  E: "Error",
  LK: "Kurang pengetahuan",
  LC: "Kurang yakin",
};

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

export function emptyCategoryCounts(): Record<Category, number> {
  return { SC: 0, M: 0, E: 0, LK: 0, LC: 0 };
}
