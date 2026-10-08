import { z } from "zod";
import data from "@/content/learning.json";
import { CELESTIAL } from "@/lib/content/celestial";

/** Konten alur belajar (PRD §4.2–4.3). Divalidasi saat diimpor; galat = build gagal. */
const Key = z.string().regex(/^[a-z0-9-]+$/);
const OptionKey = z.enum(["A", "B", "C"]);

const Prediction = z
  .object({
    key: Key,
    stem: z.string().min(10).max(220),
    // PRD §4.2: pilihan ganda 2 sampai 3 opsi, salah satunya memuat miskonsepsi umum.
    options: z.array(z.object({ key: OptionKey, text: z.string().min(1).max(120) })).min(2).max(3),
    correct: OptionKey,
    misconception_option: OptionKey,
    misconception_code: z.string().regex(/^MK-U[0-9]+-[A-Z]$/),
    observe: z.string().min(1).max(200),
    reveal: z.string().min(1).max(260),
  })
  .superRefine((p, ctx) => {
    const keys = p.options.map((o) => o.key);
    if (new Set(keys).size !== keys.length) ctx.addIssue({ code: "custom", message: `${p.key}: kunci opsi ganda` });
    if (!keys.includes(p.correct)) ctx.addIssue({ code: "custom", message: `${p.key}: kunci ilmiah tidak ada di opsi` });
    if (!keys.includes(p.misconception_option) || p.misconception_option === p.correct)
      ctx.addIssue({ code: "custom", message: `${p.key}: opsi miskonsepsi harus ada dan berbeda dari jawaban ilmiah` });
  });

const Unit = z.object({
  objectives: z.array(z.string().min(1).max(160)).min(1).max(4),
  // FR-21: satu atau dua pertanyaan prediksi per unit.
  predictions: z.array(Prediction).min(1).max(2),
  explanation: z.object({ text: z.string().min(1).max(420), sources: z.array(z.string()).min(1) }),
  reflection: z.string().min(1).max(220),
});

const Learning = z
  .object({
    review_status: z.enum(["needs_review", "reviewed"]),
    curriculum: z.object({
      phase: z.string(),
      subject: z.string(),
      element: z.string(),
      cp_text: z.string().min(1),
      cp_source: z.string().min(1),
      how_to_learn: z.array(z.string().min(1)).min(1),
    }),
    misconceptions: z.array(
      z.object({ code: z.string().regex(/^MK-U[0-9]+-[A-Z]$/), unit: z.string(), statement: z.string().min(1), scientific: z.string().min(1) }),
    ),
    units: z.record(z.string(), Unit),
  })
  .superRefine((l, ctx) => {
    const codes = new Set(l.misconceptions.map((m) => m.code));
    const keys = new Set<string>();
    for (const [slug, u] of Object.entries(l.units)) {
      for (const s of u.explanation.sources)
        if (!(s in CELESTIAL.sources)) ctx.addIssue({ code: "custom", message: `${slug}: sumber '${s}' tidak terdaftar` });
      for (const p of u.predictions) {
        if (keys.has(p.key)) ctx.addIssue({ code: "custom", message: `kunci prediksi ganda: ${p.key}` });
        keys.add(p.key);
        if (!codes.has(p.misconception_code)) ctx.addIssue({ code: "custom", message: `${p.key}: kode ${p.misconception_code} tidak terdaftar` });
      }
    }
  });

export const LEARNING = Learning.parse(data);
export type Prediction = z.infer<typeof Prediction>;
export type UnitLearning = z.infer<typeof Unit>;

export function unitLearning(slug: string): UnitLearning | null {
  return LEARNING.units[slug] ?? null;
}
export function findPrediction(key: string): { unit: string; prediction: Prediction } | null {
  for (const [unit, u] of Object.entries(LEARNING.units)) {
    const prediction = u.predictions.find((p) => p.key === key);
    if (prediction) return { unit, prediction };
  }
  return null;
}
