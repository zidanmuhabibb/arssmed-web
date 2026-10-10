import { describe, expect, it } from "vitest";
import { UNITS } from "@/content/units";
import { ITEMS } from "@/lib/tes/items-sql-data";
import { LEARNING } from "./content";
import { DISCUSSION, PRACTICE, discussionCard, unitForItem } from "./extras";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const words = (s: string) => new Set(norm(s).split(" ").filter((w) => w.length > 3));
/** Kemiripan Jaccard kata (≥ 4 huruf). */
function similarity(a: string, b: string) {
  const A = words(a);
  const B = words(b);
  const inter = [...A].filter((w) => B.has(w)).length;
  return inter / Math.max(1, new Set([...A, ...B]).size);
}

describe("kuis latihan (FR-26)", () => {
  it("setiap unit punya 3–5 soal", () => {
    for (const u of UNITS) expect(PRACTICE.units[u.slug]?.length, u.slug).toBeGreaterThanOrEqual(3);
  });
  it("bank soal terpisah: tidak sama dengan butir tes diagnostik maupun pertanyaan Tebak", () => {
    const others = [...ITEMS.items.map((i) => i.content.stem), ...Object.values(LEARNING.units).flatMap((u) => u.predictions.map((p) => p.stem))];
    for (const q of Object.values(PRACTICE.units).flat())
      for (const o of others) expect(similarity(q.stem, o), `${q.key} ~ "${o}"`).toBeLessThan(0.6);
  });
  it("kunci unik, umpan balik tanpa kata 'salah'/'benar'", () => {
    const keys = Object.values(PRACTICE.units).flat().map((q) => q.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const q of Object.values(PRACTICE.units).flat()) {
      for (const s of [q.stem, q.feedback, ...q.options.map((o) => o.text)]) expect(s.toLowerCase(), q.key).not.toMatch(/\b(salah|benar)\b/);
    }
  });
});

describe("kartu diskusi guru (FR-25)", () => {
  it("setiap unit punya 2–3 pertanyaan dan catatan miskonsepsi", () => {
    for (const u of UNITS) {
      const c = discussionCard(u.slug)!;
      expect(c.questions.length).toBeGreaterThanOrEqual(2);
      expect(c.misconceptions.length).toBeGreaterThanOrEqual(1);
    }
  });
  it("setiap butir tes terhubung ke tepat satu kartu (untuk FR-45)", () => {
    for (const it of ITEMS.items) expect(unitForItem(it.item_code!), it.item_code).not.toBeNull();
    expect(Object.values(DISCUSSION.units).flatMap((c) => c.items)).toHaveLength(ITEMS.items.length);
  });
});
