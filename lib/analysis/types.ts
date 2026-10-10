/**
 * Data mentah untuk dasbor, statistik, dan ekspor (M7). Dibentuk oleh backend
 * (memori atau Supabase) lalu diolah oleh fungsi murni di ./analyze dan ./export.
 * Hanya respons dari percobaan yang sudah SELESAI dan terklasifikasi yang masuk.
 */
import type { Category, ConsentStatus } from "@/lib/classification";
import type { Phase } from "@/lib/tes/types";

export interface AnalysisOption {
  key: string;
  text: string;
}

export interface AnalysisItem {
  id: string;
  order: number;
  /** Kode butir stabil (mis. B01) — dipakai sebagai `item_id` di ekspor. */
  code: string;
  conceptDomain: string;
  reportDomain: string;
  misconceptionCode: string | null;
  indicator: string | null;
  alternativeConceptions: string | null;
  scientificConcept: string | null;
  tier1Options: AnalysisOption[];
  reasonOptions: AnalysisOption[];
  confidenceLevels: string[];
}

export interface AnalysisStudent {
  id: string;
  pseudoId: string;
  code: string;
  nickname: string | null;
  classId: string;
  consent: ConsentStatus;
  preSubmitted: boolean;
  postSubmitted: boolean;
}

export interface AnalysisResponse {
  studentId: string;
  phase: Phase;
  itemId: string;
  tier1Key: string | null;
  reasonKey: string | null;
  confidenceA: number | null;
  confidenceR: number | null;
  aCorrect: boolean;
  rCorrect: boolean;
  confident: boolean;
  category: Category;
  answeredAt: string | null;
  responseTimeMs: number | null;
  answerChanges: number;
}

export interface AnalysisDataset {
  testName: string;
  testVersion: number;
  ruleSetId: string;
  /** Aturan bawaan tes; berbeda dari ruleSetId bila analisis memakai hasil reklasifikasi. */
  testRuleSetId: string;
  /** Respons percobaan selesai yang belum diklasifikasi dengan `ruleSetId` (perlu reklasifikasi). */
  unclassified: number;
  classes: { id: string; name: string }[];
  domains: { id: string; label: string }[];
  items: AnalysisItem[];
  students: AnalysisStudent[];
  responses: AnalysisResponse[];
}
