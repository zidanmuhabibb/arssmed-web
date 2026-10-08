/**
 * Lapisan akses data (Data Access Layer). Semua halaman/aksi server memakai
 * antarmuka ini; implementasinya Supabase (produksi) atau memori (uji e2e).
 * Otorisasi tetap ditegakkan di basis data (RLS + fungsi) — lihat DECISIONS D-026.
 */
import type { DeviceKind } from "@/lib/ar/capabilities";
import type { Step } from "@/lib/learning/flow";

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
}
