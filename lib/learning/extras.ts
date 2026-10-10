/**
 * Kuis latihan (FR-26) dan kartu diskusi guru (FR-25). Divalidasi saat diimpor; galat = build gagal.
 * Kuis: bank soal terpisah dari tes diagnostik, tidak disimpan, tidak masuk analisis.
 */
import { z } from "zod";
import discussionData from "@/content/discussion.json";
import practiceData from "@/content/practice.json";
import { CELESTIAL } from "@/lib/content/celestial";
import { ITEMS } from "@/lib/tes/items-sql-data";
import { LEARNING } from "./content";

const OptionKey = z.enum(["A", "B", "C", "D"]);

const PracticeQuestion = z
  .object({
    key: z.string().regex(/^u[0-9]+-q[0-9]+$/),
    stem: z.string().min(10).max(200),
    options: z.array(z.object({ key: OptionKey, text: z.string().min(1).max(120) })).min(3).max(4),
    correct: OptionKey,
    feedback: z.string().min(10).max(320),
    /** `unit/objek/judul anotasi` di content/celestial.json — fakta yang dirujuk. */
    source_ref: z.string().regex(/^u[0-9]+\/[a-z-]+\/.+$/),
  })
  .refine((q) => q.options.some((o) => o.key === q.correct), { message: "kunci tidak ada di opsi" });

const Practice = z
  .object({
    review_status: z.enum(["needs_review", "reviewed"]),
    // FR-26: 3 sampai 5 soal per unit.
    units: z.record(z.string(), z.array(PracticeQuestion).min(3).max(5)),
  })
  .superRefine((p, ctx) => {
    for (const [unit, qs] of Object.entries(p.units)) {
      for (const q of qs) {
        const [u, obj, title] = q.source_ref.split("/") as [string, string, string];
        const o = CELESTIAL.units[u]?.objects.find((x) => x.id === obj);
        if (u !== unit || !o?.annotations.some((a) => a.title === title)) ctx.addIssue({ code: "custom", message: `${q.key}: source_ref tidak ditemukan: ${q.source_ref}` });
      }
    }
  });

const Discussion = z
  .object({
    review_status: z.enum(["needs_review", "reviewed"]),
    units: z.record(
      z.string(),
      z.object({
        items: z.array(z.string().regex(/^B[0-9]{2}$/)).min(1),
        misconceptions: z.array(z.string()).min(1),
        // FR-25: 2 sampai 3 pertanyaan pemantik.
        questions: z.array(z.string().min(10).max(220)).min(2).max(3),
      }),
    ),
  })
  .superRefine((d, ctx) => {
    const codes = new Set(LEARNING.misconceptions.map((m) => m.code));
    const items = new Set(ITEMS.items.map((i) => i.item_code));
    const seen = new Set<string>();
    for (const [unit, c] of Object.entries(d.units)) {
      for (const m of c.misconceptions) if (!codes.has(m)) ctx.addIssue({ code: "custom", message: `${unit}: kode ${m} tidak terdaftar` });
      for (const i of c.items) {
        if (!items.has(i)) ctx.addIssue({ code: "custom", message: `${unit}: butir ${i} tidak ada` });
        if (seen.has(i)) ctx.addIssue({ code: "custom", message: `butir ${i} dipetakan ke lebih dari satu unit` });
        seen.add(i);
      }
    }
  });

export const PRACTICE = Practice.parse(practiceData);
export const DISCUSSION = Discussion.parse(discussionData);
export type PracticeQuestion = z.infer<typeof PracticeQuestion>;

export function practiceFor(unit: string): PracticeQuestion[] {
  return PRACTICE.units[unit] ?? [];
}

/** Kartu diskusi lengkap untuk satu unit: pertanyaan + catatan miskonsepsi + butir terkait (dengan konsepsi alternatif dari instrumen). */
export function discussionCard(unit: string) {
  const c = DISCUSSION.units[unit];
  if (!c) return null;
  return {
    unit,
    questions: c.questions,
    misconceptions: c.misconceptions.map((code) => LEARNING.misconceptions.find((m) => m.code === code)!),
    items: c.items.map((code) => {
      const it = ITEMS.items.find((i) => i.item_code === code)!;
      return { code, indicator: it.meta?.indicator ?? null, alternative: it.meta?.alternative_conceptions ?? null, scientific: it.meta?.scientific_concept ?? null };
    }),
  };
}

/** Unit kartu diskusi untuk sebuah butir tes (FR-45 → kartu terkait). */
export function unitForItem(itemCode: string): string | null {
  for (const [unit, c] of Object.entries(DISCUSSION.units)) if (c.items.includes(itemCode)) return unit;
  return null;
}
