/**
 * Lapisan akses data (Data Access Layer). Semua halaman/aksi server memakai
 * antarmuka ini; implementasinya Supabase (produksi) atau memori (uji e2e).
 * Otorisasi tetap ditegakkan di basis data (RLS + fungsi) — lihat DECISIONS D-026.
 */
import type { AnalysisDataset } from "@/lib/analysis/types";
import type { DeviceKind } from "@/lib/ar/capabilities";
import type { Step } from "@/lib/learning/flow";
import type { Answer } from "@/lib/tes/session";
import type { AttemptPayload, ClassTestOverview, Phase, StudentTestStatus } from "@/lib/tes/types";

export type ViewMode = "3d" | "ar_surface" | "ar_marker";

export type ConsentStatus = "pending" | "granted" | "withdrawn";
export type ClassMode = "learn_only" | "research";

export type Viewer =
  | { kind: "anon" }
  | { kind: "staff"; id: string; email: string | null; role: "teacher" | "admin"; fullName: string | null }
  | { kind: "student"; studentId: string; studentCode: string; nickname: string | null; classId: string; className: string };

export interface ClassSummary {
  id: string;
  name: string;
  joinCode: string;
  mode: ClassMode;
  academicYear: string | null;
  studentCount: number;
  /** FR-22: mode bebas — siswa boleh lanjut dari Amati tanpa melihat semua objek. */
  freeExplore: boolean;
}

export interface StudentRow {
  id: string;
  code: string;
  nickname: string | null;
  pseudoId: string;
  consent: ConsentStatus;
}

export interface CreatedStudent {
  id: string;
  code: string;
  nickname: string | null;
  pin: string;
}

/** Galat yang aman ditampilkan; `code` dipetakan ke teks di messages/id.json. */
export type BackendErrorCode =
  | "not_configured"
  | "invalid_credentials"
  | "rate_limited"
  | "forbidden"
  | "not_found"
  | "duplicate_code"
  | "invalid_code"
  | "nickname_too_long"
  | "too_many"
  | "empty"
  | "invalid_input"
  | "locked"
  | "closed"
  | "consent"
  | "learn_only"
  | "submitted"
  | "no_test"
  | "unknown";

/** Kemajuan belajar siswa yang sedang masuk (M4). */
export interface LearningSnapshot {
  freeMode: boolean;
  steps: Record<string, Step[]>;
  predictions: Record<string, string>;
  viewed: Record<string, string[]>;
  discussed: string[];
}

export class BackendError extends Error {
  constructor(
    public code: BackendErrorCode,
    message?: string,
    public meta: Record<string, unknown> = {},
  ) {
    super(message ?? code);
  }
}

export interface Backend {
  readonly name: "supabase" | "memory";
  getViewer(): Promise<Viewer>;
  signInTeacher(email: string, password: string): Promise<void>;
  signInStudent(joinCode: string, studentCode: string, pin: string): Promise<void>;
  signOut(): Promise<void>;

  listClasses(): Promise<ClassSummary[]>;
  createClass(input: { name: string; academicYear: string | null; mode: ClassMode }): Promise<{ id: string }>;
  getClass(id: string): Promise<ClassSummary | null>;
  listStudents(classId: string): Promise<StudentRow[]>;
  createStudents(classId: string, rows: { code: string | null; nickname: string | null }[]): Promise<CreatedStudent[]>;
  resetPin(studentId: string): Promise<string>;
  setConsent(studentId: string, status: ConsentStatus): Promise<void>;
  deleteStudent(studentId: string): Promise<void>;
  setFreeExplore(classId: string, value: boolean): Promise<void>;

  // Alur belajar — hanya untuk siswa yang masuk; selain itu BackendError("forbidden").
  getLearningState(): Promise<LearningSnapshot>;
  /** Jawaban pertama berlaku; mengembalikan jawaban yang tersimpan. */
  savePrediction(key: string, option: string): Promise<string>;
  recordObjectView(unit: string, objectId: string, mode?: ViewMode, device?: DeviceKind | null): Promise<void>;
  completeStep(unit: string, step: Step): Promise<void>;
  markDiscussed(unit: string): Promise<void>;

  // Tes diagnostik (M6). Siswa:
  studentTests(): Promise<StudentTestStatus[]>;
  /** Mulai/lanjutkan; butir TANPA kunci. Galat: closed | consent | learn_only. */
  startAttempt(phase: Phase, device: DeviceKind | null): Promise<AttemptPayload>;
  saveResponse(attemptId: string, r: SaveResponseInput): Promise<"saved" | "stale">;
  /** Selesai + klasifikasi server. Butir belum lengkap dikembalikan. */
  submitAttempt(attemptId: string): Promise<{ ok: true } | { ok: false; missing: number[] }>;
  // Guru:
  classTestOverview(classId: string): Promise<ClassTestOverview[]>;
  openClassTest(classId: string, phase: Phase): Promise<void>;
  closeClassTest(classId: string, phase: Phase): Promise<void>;

  // Dasbor & statistik (M7).
  /**
   * Data mentah percobaan yang SUDAH selesai + klasifikasinya. `classId` null = semua kelas
   * (admin saja); guru hanya kelasnya sendiri. Galat: not_found | forbidden.
   */
  analysisDataset(classId: string | null, ruleSetId?: string | null): Promise<AnalysisDataset>;
  /**
   * Hitung ulang klasifikasi percobaan selesai dengan aturan lain (admin; tercatat di audit).
   * Jawaban mentah dan klasifikasi aturan lain tidak diubah.
   */
  reclassify(ruleSetId: string, classId: string | null): Promise<{ attempts: number; responses: number }>;
  /** Catat ekspor di log audit (FR-55); tanpa data pribadi. */
  logExport(classId: string | null, format: string): Promise<void>;

  // Keamanan (M8).
  /** Pembatasan laju per pengguna; galat `rate_limited` bila melewati batas (PRD §12.4). */
  rateLimit(scope: RateScope): Promise<void>;
  /** Pemetaan kode samaran → kode/nama panggilan (admin saja; tercatat di audit). */
  researchNameMap(classId: string | null): Promise<NameMapRow[]>;
}

export type RateScope = "tes_start" | "tes_save" | "tes_submit" | "riset_read" | "riset_export" | "riset_name_map";
/** Batas yang sama dengan fungsi DB consume_rate_limit (supabase/migrations/*_security.sql). */
export const RATE_LIMITS: Record<RateScope, { max: number; windowSeconds: number }> = {
  tes_start: { max: 30, windowSeconds: 60 },
  tes_save: { max: 300, windowSeconds: 60 },
  tes_submit: { max: 20, windowSeconds: 60 },
  riset_read: { max: 60, windowSeconds: 60 },
  riset_export: { max: 20, windowSeconds: 600 },
  riset_name_map: { max: 5, windowSeconds: 600 },
};

export interface NameMapRow {
  pseudoId: string;
  className: string;
  studentCode: string;
  nickname: string | null;
  consent: ConsentStatus;
}

export interface SaveResponseInput {
  itemId: string;
  answer: Answer;
  /** Cap waktu klien (ISO). */
  clientTs: string;
  responseTimeMs: number | null;
  optionOrder: { tier1: string[]; reason: string[] } | null;
}
