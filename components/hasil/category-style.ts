import type { CSSProperties } from "react";
import type { Category } from "@/lib/classification";

/**
 * Warna + pola isian per kategori (PRD §7.3: warna tidak boleh jadi satu-satunya pembeda).
 * SC polos · M garis miring · E titik · LK garis datar · LC arsir silang.
 */
const STRIPE = "rgba(255,255,255,0.55)";
const PATTERN: Record<Category, string> = {
  SC: "none",
  M: `repeating-linear-gradient(45deg, ${STRIPE} 0 3px, transparent 3px 8px)`,
  E: `radial-gradient(${STRIPE} 1.6px, transparent 1.8px)`,
  LK: `repeating-linear-gradient(0deg, ${STRIPE} 0 2px, transparent 2px 7px)`,
  LC: `repeating-linear-gradient(45deg, ${STRIPE} 0 1.5px, transparent 1.5px 7px), repeating-linear-gradient(-45deg, ${STRIPE} 0 1.5px, transparent 1.5px 7px)`,
};
const VAR: Record<Category, string> = { SC: "var(--sc)", M: "var(--m)", E: "var(--e)", LK: "var(--lk)", LC: "var(--lc)" };

export function categoryStyle(c: Category): CSSProperties {
  return { backgroundColor: VAR[c], backgroundImage: PATTERN[c], backgroundSize: c === "E" ? "7px 7px" : undefined };
}
export const categoryColor = (c: Category) => VAR[c];
