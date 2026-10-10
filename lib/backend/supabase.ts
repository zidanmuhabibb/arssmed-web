import "server-only";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { RuleSet } from "@/lib/classification";
import { datasetFromRpc, type DatasetRpcRow } from "@/lib/analysis";
import { ITEMS } from "@/lib/tes/items-sql-data";
import { classifyAttempt, deliverItems, type StoredItem } from "@/lib/tes/deliver";
import type { Answer } from "@/lib/tes/session";
import type { ClassTestOverview, StudentTestStatus } from "@/lib/tes/types";
import { loginStudent, type LoginRpcResult } from "./student-login";
import {
  BackendError,
  type Backend,
  type BackendErrorCode,
  type ClassSummary,
  type ConsentStatus,
  type CreatedStudent,
  type LearningSnapshot,
  type NameMapRow,
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
  locked: "locked",
  invalid_input: "invalid_input",
  closed: "closed",
  consent: "consent",
  learn_only: "learn_only",
  submitted: "submitted",
  no_test: "no_test",
  rate_limited: "rate_limited",
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

type ClassRow = {
  id: string;
  name: string;
  join_code: string;
  mode: ClassSummary["mode"];
  academic_year: string | null;
  free_explore: boolean;
  students: { count: number }[];
};

function toSummary(r: ClassRow): ClassSummary {
  return {
    id: r.id,
    name: r.name,
    joinCode: r.join_code,
    mode: r.mode,
    academicYear: r.academic_year,
    studentCount: r.students?.[0]?.count ?? 0,
    freeExplore: r.free_explore ?? false,
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
      .select("id, name, join_code, mode, academic_year, free_explore, students(count)")
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
      .select("id, name, join_code, mode, academic_year, free_explore, students(count)")
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

  async setFreeExplore(classId, value) {
    const c = await server();
    const { error, count } = await c.from("classes").update({ free_explore: value }, { count: "exact" }).eq("id", classId);
    if (error) throw fromDb(error);
    if (!count) throw new BackendError("not_found");
  },

  async getLearningState() {
    const c = await server();
    const { data, error } = await c.rpc("learning_state");
    if (error) throw fromDb(error);
    const d = data as { free_explore: boolean; steps: LearningSnapshot["steps"]; predictions: Record<string, string>; viewed: Record<string, string[]>; discussed: string[] };
    return { freeMode: d.free_explore, steps: d.steps, predictions: d.predictions, viewed: d.viewed, discussed: d.discussed };
  },

  async savePrediction(key, option) {
    const c = await server();
    const { data, error } = await c.rpc("save_prediction", { p_key: key, p_option: option });
    if (error) throw fromDb(error);
    return data as string;
  },

  async recordObjectView(unit, objectId, mode = "3d", device = null) {
    const c = await server();
    const { error } = await c.rpc("record_object_view", { p_unit: unit, p_object: objectId, p_mode: mode, p_device: device });
    if (error) throw fromDb(error);
  },

  async completeStep(unit, step) {
    const c = await server();
    const { error } = await c.rpc("complete_step", { p_unit: unit, p_step: step });
    if (error) throw fromDb(error);
  },

  async markDiscussed(unit) {
    const c = await server();
    const { error } = await c.rpc("mark_discussed", { p_unit: unit });
    if (error) throw fromDb(error);
  },

  // ---------------------------------------------------------------- tes diagnostik (M6)

  async studentTests() {
    const c = await server();
    const { data, error } = await c.rpc("student_tests");
    if (error) throw fromDb(error);
    return data as StudentTestStatus[];
  },

  async startAttempt(phase, device) {
    const c = await server();
    const { data, error } = await c.rpc("start_attempt", { p_phase: phase, p_device: device });
    if (error) throw fromDb(error);
    const row = (data as { attempt_id: string; test_id: string; submitted: boolean }[])[0]!;
    if (row.submitted) return { attemptId: row.attempt_id, phase, submitted: true, items: [], answers: {} };
    // Butir dibaca dengan kunci layanan (siswa tidak punya akses ke test_items), lalu kuncinya dibuang.
    const items = await loadItems(row.test_id);
    const { data: resp, error: rErr } = await c
      .from("item_responses")
      .select("item_id, tier1_key, confidence_a, reason_key, confidence_r")
      .eq("attempt_id", row.attempt_id);
    if (rErr) throw fromDb(rErr);
    return { attemptId: row.attempt_id, phase, submitted: false, items: deliverItems(row.attempt_id, items), answers: toAnswers(resp as ResponseRow[]) };
  },

  async saveResponse(attemptId, r) {
    const c = await server();
    const { data, error } = await c.rpc("save_response", {
      p_attempt: attemptId,
      p_item: r.itemId,
      p_tier1: r.answer.tier1,
      p_conf_a: r.answer.confidenceA,
      p_reason: r.answer.reason,
      p_conf_r: r.answer.confidenceR,
      p_client_ts: r.clientTs,
      p_time_ms: r.responseTimeMs,
      p_option_order: r.optionOrder,
    });
    if (error) throw fromDb(error);
    return data as "saved" | "stale";
  },

  async submitAttempt(attemptId) {
    const c = await server();
    const { data, error } = await c.rpc("submit_attempt", { p_attempt: attemptId });
    if (error) throw fromDb(error);
    const res = data as { ok: boolean; missing: number[] };
    if (!res.ok) return { ok: false, missing: res.missing };
    await classifyStored(attemptId);
    return { ok: true };
  },

  async classTestOverview(classId) {
    const c = await server();
    const { data, error } = await c.rpc("class_test_overview", { p_class_id: classId });
    if (error) throw fromDb(error);
    type Row = { phase: ClassTestOverview["phase"]; status: ClassTestOverview["status"]; opened_at: string | null; closed_at: string | null; total: number; students: ClassTestOverview["students"] };
    return (data as Row[]).map((r) => ({ phase: r.phase, status: r.status, openedAt: r.opened_at, closedAt: r.closed_at, total: r.total, students: r.students }));
  },

  async openClassTest(classId, phase) {
    const c = await server();
    const { error } = await c.rpc("open_class_test", { p_class_id: classId, p_phase: phase });
    if (error) throw fromDb(error);
  },

  async closeClassTest(classId, phase) {
    const c = await server();
    const { error } = await c.rpc("close_class_test", { p_class_id: classId, p_phase: phase });
    if (error) throw fromDb(error);
  },

  async analysisDataset(classId, ruleSetId = null) {
    const c = await server();
    // Otorisasi (guru: kelas sendiri; admin: semua) ditegakkan di fungsi DB.
    const { data, error } = await c.rpc("analysis_dataset", { p_class_id: classId, p_rule_set: ruleSetId });
    if (error) throw fromDb(error);
    const row = data as DatasetRpcRow;
    return datasetFromRpc(row, await loadItems(row.test_id), ITEMS);
  },

  async logExport(classId, format) {
    const c = await server();
    const { error } = await c.rpc("log_export", { p_class_id: classId, p_format: format });
    if (error) throw fromDb(error);
  },

  async reclassify(ruleSetId, classId) {
    const c = await server();
    // Fungsi DB memastikan pemanggil admin dan mencatat perubahan aturan di audit (FR-55).
    const { error } = await c.rpc("log_reclassify", { p_rule_set: ruleSetId, p_class_id: classId });
    if (error) throw fromDb(error);
    const ruleSet = await loadRuleSet(ruleSetId);
    let q = admin().from("test_attempts").select("id, class_tests!inner(class_id, classes!inner(mode))").not("submitted_at", "is", null).eq("class_tests.classes.mode", "research");
    if (classId) q = q.eq("class_tests.class_id", classId);
    const { data, error: aErr } = await q;
    if (aErr) throw fromDb(aErr);
    let responses = 0;
    for (const a of data as { id: string }[]) responses += await classifyStored(a.id, ruleSet);
    return { attempts: (data as unknown[]).length, responses };
  },

  async rateLimit(scope) {
    const c = await server();
    const { error } = await c.rpc("consume_rate_limit", { p_scope: scope });
    if (error) throw fromDb(error);
  },

  async researchNameMap(classId) {
    const c = await server();
    // Catat dulu (gagal bila bukan admin), baru baca.
    const { error: lErr } = await c.rpc("log_name_map", { p_class_id: classId });
    if (lErr) throw fromDb(lErr);
    const { data, error } = await c.rpc("research_name_map", { p_class_id: classId });
    if (error) throw fromDb(error);
    type Row = { pseudo_id: string; class_name: string; student_code: string; nickname: string | null; consent: NameMapRow["consent"] };
    return (data as Row[]).map((r) => ({ pseudoId: r.pseudo_id, className: r.class_name, studentCode: r.student_code, nickname: r.nickname, consent: r.consent }));
  },
};



type ResponseRow = { item_id: string; tier1_key: string | null; confidence_a: number | null; reason_key: string | null; confidence_r: number | null };
function toAnswers(rows: ResponseRow[]): Record<string, Answer> {
  return Object.fromEntries(rows.map((r) => [r.item_id, { tier1: r.tier1_key, confidenceA: r.confidence_a, reason: r.reason_key, confidenceR: r.confidence_r }]));
}

async function loadItems(testId: string): Promise<StoredItem[]> {
  const { data, error } = await admin().from("test_items").select("id, item_order, content").eq("test_id", testId).order("item_order");
  if (error) throw fromDb(error);
  return (data as { id: string; item_order: number; content: unknown }[]).map((i) => ({ id: i.id, order: i.item_order, content: i.content }));
}

type RuleSetRow = { rule_set_id: string; kind: string; rules: unknown; confidence_mode: string | null; incomplete_category: string | null };
/** Aturan dari DB divalidasi ulang (lengkap & saling lepas) sebelum dipakai. */
function parseRuleSet(r: RuleSetRow) {
  return RuleSet.parse({
    rule_set_id: r.rule_set_id,
    kind: r.kind,
    rules: r.rules,
    ...(r.kind === "combined" ? { confidence_mode: r.confidence_mode } : {}),
    incomplete_category: r.incomplete_category,
  });
}
async function loadRuleSet(ruleSetId: string) {
  const { data, error } = await admin().from("rule_sets").select("rule_set_id, kind, rules, confidence_mode, incomplete_category").eq("rule_set_id", ruleSetId).single<RuleSetRow>();
  if (error) throw fromDb(error);
  return parseRuleSet(data);
}

/**
 * Klasifikasi server (PRD §10), disimpan lewat service role. Bawaan: aturan milik tes;
 * reklasifikasi memberi aturan lain (disimpan berdampingan). Mengembalikan jumlah baris.
 */
async function classifyStored(attemptId: string, override?: RuleSet): Promise<number> {
  const a = admin();
  const { data: att, error } = await a
    .from("test_attempts")
    .select("id, class_tests(test_id, tests(rule_sets(rule_set_id, kind, rules, confidence_mode, incomplete_category)))")
    .eq("id", attemptId)
    .single<{ class_tests: { test_id: string; tests: { rule_sets: { rule_set_id: string; kind: string; rules: unknown; confidence_mode: string | null; incomplete_category: string | null } } } }>();
  if (error) throw fromDb(error);
  const ruleSet = override ?? parseRuleSet(att.class_tests.tests.rule_sets);
  const items = await loadItems(att.class_tests.test_id);
  const { data: resp, error: rErr } = await a.from("item_responses").select("item_id, tier1_key, confidence_a, reason_key, confidence_r").eq("attempt_id", attemptId);
  if (rErr) throw fromDb(rErr);
  const rows = classifyAttempt(items, toAnswers(resp as ResponseRow[]), ruleSet);
  const { error: sErr } = await a.rpc("store_classifications", { p_attempt: attemptId, p_rule_set: ruleSet.rule_set_id, p_rows: rows });
  if (sErr) throw fromDb(sErr);
  return rows.length;
}
