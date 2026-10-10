/** Parameter kueri analisis (?kelas=&skor=&transisi=) untuk /riset dan API (Zod). */
import { z } from "zod";
import { ANALYSIS_CONFIG, RULE_SETS, ScoreMethod } from "@/lib/classification";
import type { AnalysisOptions } from "./analyze";

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const Query = z.object({
  kelas: z.preprocess(first, z.string().uuid().or(z.string().regex(/^[\w-]{1,64}$/)).optional().catch(undefined)),
  skor: z.preprocess(first, ScoreMethod.optional().catch(undefined)),
  transisi: z.preprocess(first, z.enum(["per_butir", "modus"]).optional().catch(undefined)),
  aturan: z.preprocess(first, z.string().refine((x) => x in RULE_SETS).optional().catch(undefined)),
});

/** `ruleSetId` null = aturan milik tes. */
export function parseAnalysisQuery(q: Record<string, unknown>): { classId: string | null; ruleSetId: string | null; options: AnalysisOptions } {
  const p = Query.parse(q);
  return {
    classId: p.kelas ?? null,
    ruleSetId: p.aturan ?? null,
    options: {
      scoreMethod: p.skor ?? ANALYSIS_CONFIG.score_method,
      transitionMode: p.transisi ?? ANALYSIS_CONFIG.transition_mode,
      taxonomy: ANALYSIS_CONFIG.domain_taxonomy,
    },
  };
}

/** Kalimat yang harus diketik ulang peneliti sebelum mengunduh pemetaan nama (konfirmasi tambahan PRD §7.4). */
export const NAME_MAP_CONFIRMATION = "SAYA MENJAGA KERAHASIAAN DATA";
