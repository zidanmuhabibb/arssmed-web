/** Bentuk data API tes (PRD §11). Butir dikirim TANPA kunci jawaban. */
import type { ItemFormat } from "@/lib/classification";
import type { Answer } from "./session";

export type Phase = "pre" | "post";
export const PHASES: readonly Phase[] = ["pre", "post"];
export const isPhase = (x: string): x is Phase => x === "pre" || x === "post";

export type ClassTestStatus = "draft" | "open" | "closed";

export interface DeliveredItem {
  id: string;
  order: number;
  format: ItemFormat;
  stem: string;
  stemImage: string | null;
  /** Opsi dalam urutan yang dilihat siswa ini. */
  tier1: { key: string; text: string }[];
  reason: { key: string; text: string }[];
  levels: string[];
}

export interface AttemptPayload {
  attemptId: string;
  phase: Phase;
  submitted: boolean;
  items: DeliveredItem[];
  answers: Record<string, Answer>;
}

/** Status tes untuk siswa di halaman /tes. */
export interface StudentTestStatus {
  phase: Phase;
  status: ClassTestStatus;
  /** Alasan tidak bisa mengerjakan meski tes dibuka. */
  blocked: null | "consent_pending" | "consent_withdrawn" | "learn_only";
  attempt: null | { answered: number; total: number; submitted: boolean };
}

/** Kemajuan kelas untuk guru (FR-41). */
export interface ClassTestOverview {
  phase: Phase;
  status: ClassTestStatus;
  openedAt: string | null;
  closedAt: string | null;
  total: number;
  students: { id: string; code: string; nickname: string | null; consent: "pending" | "granted" | "withdrawn"; answered: number; submitted: boolean; started: boolean }[];
}
