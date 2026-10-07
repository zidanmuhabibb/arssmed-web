import { z } from "zod";
import { BackendError } from "./types";

/**
 * Alur masuk siswa (DECISIONS D-027), terpisah dari Supabase agar bisa diuji:
 *   1. verifikasi kode kelas + kode siswa + PIN di basis data (dengan pembatasan laju)
 *   2. pastikan siswa punya akun Auth (dibuat sekali, tanpa kata sandi)
 *   3. terbitkan sesi untuk akun itu
 */
export const StudentLoginInput = z.object({
  joinCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,8}$/),
  studentCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{1,12}$/),
  pin: z.string().trim().regex(/^[0-9]{4}$/),
});
export type StudentLoginInput = z.infer<typeof StudentLoginInput>;

export interface LoginRpcResult {
  status: "ok" | "invalid" | "rate_limited";
  student_id: string | null;
  auth_user_id: string | null;
  retry_after_seconds: number | null;
}

export interface StudentLoginDeps {
  verify(input: StudentLoginInput): Promise<LoginRpcResult>;
  createAuthUser(email: string, studentId: string): Promise<string>;
  linkAuthUser(studentId: string, userId: string): Promise<void>;
  getLinkedAuthUser(studentId: string): Promise<string | null>;
  issueSession(email: string): Promise<void>;
}

/** Email sintetis untuk akun Auth siswa. TLD .invalid menjamin tidak ada surel terkirim. */
export function studentAuthEmail(studentId: string) {
  return `${studentId}@siswa.arssmed.invalid`;
}

export async function loginStudent(deps: StudentLoginDeps, raw: unknown): Promise<{ studentId: string }> {
  const parsed = StudentLoginInput.safeParse(raw);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))];
    throw new BackendError("invalid_input", "Isian belum lengkap atau formatnya salah.", { fields });
  }
  const r = await deps.verify(parsed.data);
  if (r.status === "rate_limited") {
    throw new BackendError("rate_limited", "Terlalu banyak percobaan.", { retryAfterSeconds: r.retry_after_seconds ?? 600 });
  }
  if (r.status !== "ok" || !r.student_id) throw new BackendError("invalid_credentials");

  const studentId = r.student_id;
  const email = studentAuthEmail(studentId);
  if (!r.auth_user_id) {
    try {
      const userId = await deps.createAuthUser(email, studentId);
      await deps.linkAuthUser(studentId, userId);
    } catch (e) {
      // Permintaan bersamaan (dua tab) bisa sudah membuat akun; pakai yang sudah tertaut.
      const linked = await deps.getLinkedAuthUser(studentId);
      if (!linked) throw e;
    }
  }
  await deps.issueSession(email);
  return { studentId };
}
