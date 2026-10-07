import { z } from "zod";
import config from "../../data/analysis.json";
import { ScoreMethod } from "./scoring";

/**
 * Pengaturan analisis yang dicantumkan di setiap ekspor dan laporan (PRD §6.3,
 * reproducibility). Sumber: data/analysis.json.
 */
export const AnalysisConfig = z.object({
  rule_set_id: z.string().min(1),
  score_method: ScoreMethod,
  /** D.6 instrumen: perpindahan "setiap siswa pada butir yang sama" → per_butir. */
  transition_mode: z.enum(["modus", "per_butir"]),
  domain_taxonomy: z.enum(["concept_domain", "report_domain"]),
  source: z.string().min(1),
});
export type AnalysisConfig = z.infer<typeof AnalysisConfig>;

export const ANALYSIS_CONFIG: AnalysisConfig = AnalysisConfig.parse(config);
