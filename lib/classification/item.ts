import { z } from "zod";

/**
 * Skema butir tes four-tier (PRD §6.1). Disimpan di `test_items.content`.
 *
 * Konvensi keyakinan: `levels` diurutkan dari PALING yakin (indeks 0) ke paling
 * ragu. Jawaban dianggap "yakin" bila indeks yang dipilih ≤ `threshold_index`.
 * Contoh default: ["Yakin", "Ragu-ragu"], threshold_index 0 → hanya "Yakin" = yakin.
 * (DECISIONS.md D-017)
 */

const OptionKey = z.string().min(1).max(8);

const Tier1Option = z.object({ key: OptionKey, text: z.string().min(1) });
const ReasonOption = z.object({
  key: OptionKey,
  text: z.string().min(1),
  maps_to_misconception: z.string().min(1).nullable().default(null),
});

export const ItemFormat = z.enum(["four_tier_standard", "modified_tier2"]);
export type ItemFormat = z.infer<typeof ItemFormat>;

export const ConfidenceConfig = z
  .object({
    levels: z.array(z.string().min(1)).min(2).max(4),
    threshold_index: z.number().int().min(0),
  })
  .refine((c) => c.threshold_index < c.levels.length - 1, {
    message: "threshold_index harus menyisakan minimal satu level 'ragu'",
    path: ["threshold_index"],
  });
export type ConfidenceConfig = z.infer<typeof ConfidenceConfig>;

function uniqueKeys(options: { key: string }[]) {
  return new Set(options.map((o) => o.key)).size === options.length;
}

export const TestItemContent = z
  .object({
    stem: z.string().min(1),
    stem_image: z.string().min(1).nullable().default(null),
    format: ItemFormat,
    tier1: z.object({
      options: z.array(Tier1Option).min(2),
      correct: OptionKey,
      fixed_order: z.boolean().default(false),
    }),
    reason: z.object({
      options: z.array(ReasonOption).min(2),
      correct: OptionKey,
    }),
    confidence: ConfidenceConfig,
    concept_domain: z.string().min(1),
    report_domain: z.string().min(1),
    misconception_target: z.string().min(1).nullable().default(null),
  })
  .superRefine((item, ctx) => {
    if (!uniqueKeys(item.tier1.options)) {
      ctx.addIssue({ code: "custom", path: ["tier1", "options"], message: "Kunci opsi tier 1 harus unik" });
    }
    if (!item.tier1.options.some((o) => o.key === item.tier1.correct)) {
      ctx.addIssue({ code: "custom", path: ["tier1", "correct"], message: "Kunci jawaban tier 1 tidak ada di opsi" });
    }
    if (!uniqueKeys(item.reason.options)) {
      ctx.addIssue({ code: "custom", path: ["reason", "options"], message: "Kunci opsi alasan harus unik" });
    }
    if (!item.reason.options.some((o) => o.key === item.reason.correct)) {
      ctx.addIssue({ code: "custom", path: ["reason", "correct"], message: "Kunci alasan tidak ada di opsi" });
    }
  });
export type TestItemContent = z.infer<typeof TestItemContent>;

/** Berkas data/items.json yang diisi peneliti (dibaca skrip seed di M6). */
export const ItemsFile = z.object({
  test_name: z.string().min(1),
  test_version: z.number().int().min(1),
  items: z
    .array(z.object({ item_order: z.number().int().min(1), content: TestItemContent }))
    .refine((items) => new Set(items.map((i) => i.item_order)).size === items.length, {
      message: "item_order harus unik",
    }),
});
export type ItemsFile = z.infer<typeof ItemsFile>;

/** Versi butir untuk klien siswa: TANPA kunci jawaban (PRD §9.2 prinsip 4). */
export interface StudentItem {
  stem: string;
  stem_image: string | null;
  format: ItemFormat;
  tier1: { options: { key: string; text: string }[] };
  reason: { options: { key: string; text: string }[] };
  confidence: { levels: string[] };
}

export function toStudentItem(item: TestItemContent): StudentItem {
  return {
    stem: item.stem,
    stem_image: item.stem_image,
    format: item.format,
    tier1: { options: item.tier1.options.map(({ key, text }) => ({ key, text })) },
    // maps_to_misconception juga disembunyikan: ia membocorkan opsi mana yang keliru.
    reason: { options: item.reason.options.map(({ key, text }) => ({ key, text })) },
    confidence: { levels: [...item.confidence.levels] },
  };
}

/** Tier keyakinan yang wajib diisi untuk tiap format. */
export function requiredConfidenceTiers(format: ItemFormat): readonly ("answer" | "reason")[] {
  return format === "four_tier_standard" ? ["answer", "reason"] : ["reason"];
}
