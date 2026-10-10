/** Parameter kueri analisis (?kelas=&skor=&transisi=) untuk /riset dan API (Zod). */
import { z } from "zod";
import { ANALYSIS_CONFIG, ScoreMethod } from "@/lib/classification";
import type { AnalysisOptions } from "./analyze";

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const Query = z.object({
  kelas: z.preprocess(first, z.string().uuid().or(z.string().regex(/^[\w-]{1,64}$/)).optional().catch(undefined)),
  skor: z.preprocess(first, ScoreMethod.optional().catch(undefined)),
  transisi: z.preprocess(first, z.enum(["per_butir", "modus"]).optional().catch(undefined)),
});

export function parseAnalysisQuery(q: Record<string, unknown>): { classId: string | null; options: AnalysisOptions } {
  const p = Query.parse(q);
  return {
    classId: p.kelas ?? null,
    options: {
      scoreMethod: p.skor ?? ANALYSIS_CONFIG.score_method,
      transitionMode: p.transisi ?? ANALYSIS_CONFIG.transition_mode,
      taxonomy: ANALYSIS_CONFIG.domain_taxonomy,
    },
  };
}
