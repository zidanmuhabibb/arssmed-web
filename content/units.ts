/** Daftar unit materi (PRD §4.3). Teks ada di messages/id.json → units.<key>. */
export const UNITS = [
  { slug: "u1", key: "u1", number: 1 },
  { slug: "u2", key: "u2", number: 2 },
  { slug: "u3", key: "u3", number: 3 },
  { slug: "u4", key: "u4", number: 4 },
  { slug: "u5", key: "u5", number: 5 },
  { slug: "u6", key: "u6", number: 6 },
] as const;

export type UnitSlug = (typeof UNITS)[number]["slug"];

export function findUnit(slug: string) {
  return UNITS.find((u) => u.slug === slug) ?? null;
}
