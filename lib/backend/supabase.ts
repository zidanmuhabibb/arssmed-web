import "server-only";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { loginStudent, type LoginRpcResult } from "./student-login";
import {
  BackendError,
  type Backend,
  type BackendErrorCode,
  type ClassSummary,
  type ConsentStatus,
  type CreatedStudent,
  type StudentRow,
  type Viewer,
} from "./types";

const DB_DETAIL_CODES: Record<string, BackendErrorCode> = {
  forbidden: "forbidden",
  not_found: "not_found",
  duplicate_code: "duplicate_code",
  invalid_code: "invalid_code",
  nickname_too_long: "nickname_too_long",
  too_many: "too_many",
  empty: "empty",
};

/** Petakan galat Postgres/PostgREST ke kode aman; pesan Indonesia dari fungsi DB dipertahankan. */
function fromDb(error: PostgrestError): BackendError {
  const code = (error.details && DB_DETAIL_CODES[error.details]) || (error.code === "42501" ? "forbidden" : "unknown");
  return new BackendError(code, code === "unknown" ? "Terjadi galat pada server." : error.message);
}

async function server(): Promise<SupabaseClient> {
  const c = await createSupabaseServerClient();
  if (!c) throw new BackendError("not_configured");
  return c;
}

function admin(): SupabaseClient {
  const c = createSupabaseAdminClient();
  if (!c) throw new BackendError("not_configured");
  return c;
}

type ClassRow = { id: string; name: string; join_code: string; mode: ClassSummary["mode"]; academic_year: string | null; students: { count: number }[] };

function toSummary(r: ClassRow): ClassSummary {
  return {
    id: r.id,
    name: r.name,
    joinCode: r.join_code,
    mode: r.mode,
    academicYear: r.academic_year,
    studentCount: r.students?.[0]?.count ?? 0,
  };
}

export const supabaseBackend: Backend = {
  name: "supabase",

  async getViewer(): Promise<Viewer> {
    const c = await createSupabaseServerClient();
    if (!c) return { kind: "anon" };
    // getUser() memvalidasi token ke server Auth (bukan hanya membaca cookie).
    const { data } = await c.auth.getUser();
    const user = data.user;
    if (!user) return { kind: "anon" };

    if (user.app_metadata?.kind === "student") {
      const { data: s } = await c
        .from("students")
        .select("id, student_code, nickname, class_id, classes(name)")
        .maybeSingle<{ id: string; student_code: string; nickname: string | null; class_id: string; classes: { name: string } | null }>();
      if (!s) return { kind: "anon" };
      return { kind: "student", studentId: s.id, studentCode: s.student_code, nickname: s.nickname, classId: s.class_id, className: s.classes?.name ?? "" };
    }

    const { data: p } = await c.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle<{ role: "teacher" | "admin"; full_name: string | null }>();
    if (!p) return { kind: "anon" };
    return { kind: "staff", id: user.id, email: user.email ?? null, role: p.role, fullName: p.full_name };
  },

  async signInTeacher(email, password) {
    const c = await server();
    const { data, error } = await c.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.user) throw new BackendError("invalid_credentials");
    if (data.user.app_metadata?.kind === "student") {
      await c.auth.signOut();
      throw new BackendError("invalid_credentials");
    }
  },

  async signInStudent(joinCode, studentCode, pin) {
    const a = admin();
    const c = await server();
    await loginStudent(
      {
        async verify(input) {
          const { data, error } = await a.rpc("student_login", {
            p_join_code: input.joinCode,
            p_student_code: input.studentCode,
            p_pin: input.pin,
          });
          if (error) throw fromDb(error);
          return (data as LoginRpcResult[])[0]!;
        },
        async createAuthUser(email, studentId) {
          const { data, error } = await a.auth.admin.createUser({
            email,
            email_confirm: true,
            app_metadata: { kind: "student", student_id: studentId },
          });
          if (error || !data.user) throw error ?? new Error("createUser gagal");
          return data.user.id;
        },
        async linkAuthUser(studentId, userId) {
          const { error } = await a.rpc("link_student_auth_user", { p_student_id: studentId, p_auth_user_id: userId });
          if (error) throw fromDb(error);
        },
        async getLinkedAuthUser(studentId) {
          const { data } = await a.from("students").select("auth_user_id").eq("id", studentId).maybeSingle<{ auth_user_id: string | null }>();
          return data?.auth_user_id ?? null;
        },
        async issueSession(email) {
          // Token sekali pakai dari admin API, ditukar menjadi sesi ber-cookie (tanpa surel terkirim).
          const { data, error } = await a.auth.admin.generateLink({ type: "magiclink", email });
          if (error || !data.properties?.hashed_token) throw error ?? new Error("generateLink gagal");
          const { error: vErr } = await c.auth.verifyOtp({ type: "magiclink", token_hash: data.properties.hashed_token });
          if (vErr) throw vErr;
        },
      },
      { joinCode, studentCode, pin },
    );
  },

  async signOut() {
    const c = await createSupabaseServerClient();
    await c?.auth.signOut();
  },

  async listClasses() {
    const c = await server();
    const { data, error } = await c
      .from("classes")
      .select("id, name, join_code, mode, academic_year, students(count)")
      .order("created_at", { ascending: true });
    if (error) throw fromDb(error);
    return (data as unknown as ClassRow[]).map(toSummary);
  },

  async createClass(input) {
    const c = await server();
    const { data: u } = await c.auth.getUser();
    if (!u.user) throw new BackendError("forbidden");
    const { data, error } = await c
      .from("classes")
      .insert({ name: input.name, academic_year: input.academicYear, mode: input.mode, teacher_id: u.user.id })
      .select("id")
      .single<{ id: string }>();
    if (error) throw fromDb(error);
    return data;
  },

  async getClass(id) {
    const c = await server();
    const { data, error } = await c
      .from("classes")
      .select("id, name, join_code, mode, academic_year, students(count)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw fromDb(error);
    return data ? toSummary(data as unknown as ClassRow) : null;
  },

  async listStudents(classId) {
    const c = await server();
    const { data, error } = await c
      .from("students")
      .select("id, student_code, nickname, pseudo_id, consent_status")
      .eq("class_id", classId)
      .order("student_code");
    if (error) throw fromDb(error);
    return (data as { id: string; student_code: string; nickname: string | null; pseudo_id: string; consent_status: ConsentStatus }[]).map(
      (r): StudentRow => ({ id: r.id, code: r.student_code, nickname: r.nickname, pseudoId: r.pseudo_id, consent: r.consent_status }),
    );
  },

  async createStudents(classId, rows) {
    const c = await server();
    const { data, error } = await c.rpc("create_students", { p_class_id: classId, p_rows: rows });
    if (error) throw fromDb(error);
    return (data as { student_id: string; student_code: string; nickname: string | null; pin: string }[]).map(
      (r): CreatedStudent => ({ id: r.student_id, code: r.student_code, nickname: r.nickname, pin: r.pin }),
    );
  },

  async resetPin(studentId) {
    const c = await server();
    const { data, error } = await c.rpc("reset_student_pin", { p_student_id: studentId });
    if (error) throw fromDb(error);
    return data as string;
  },

  async setConsent(studentId, status) {
    const c = await server();
    const { error } = await c.rpc("set_consent", { p_student_id: studentId, p_status: status });
    if (error) throw fromDb(error);
  },

  async deleteStudent(studentId) {
    const c = await server();
    const { error, count } = await c.from("students").delete({ count: "exact" }).eq("id", studentId);
    if (error) throw fromDb(error);
    if (!count) throw new BackendError("not_found");
  },
};
