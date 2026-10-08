import "server-only";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { MAX_NICKNAME, MAX_STUDENTS, STUDENT_CODE_RE } from "@/lib/students/csv";
import { unitObjects } from "@/lib/content/celestial";
import { findPrediction, unitLearning } from "@/lib/learning/content";
import { blockingStep, canFinishObserve, predictionsComplete, STEPS, type Step } from "@/lib/learning/flow";
import { PEDOMAN_V1_RULE_SET, getRuleSet } from "@/lib/classification";
import { classifyAttempt, deliverItems, itemShape, type ClassificationRow, type StoredItem } from "@/lib/tes/deliver";
import { ITEMS } from "@/lib/tes/items-sql-data";
import { EMPTY_ANSWER, isComplete, validateAnswer, type Answer } from "@/lib/tes/session";
import type { ClassTestStatus, Phase, StudentTestStatus } from "@/lib/tes/types";
import { loginStudent, studentAuthEmail } from "./student-login";
import { BackendError, type Backend, type ClassMode, type ConsentStatus, type CreatedStudent, type LearningSnapshot, type Viewer } from "./types";

/**
 * Backend di memori untuk uji e2e dan demo lokal TANPA Supabase (DECISIONS D-026).
 * Meniru aturan basis data (kepemilikan kelas, kode unik, PIN, pembatasan laju)
 * tetapi tidak aman untuk produksi: sesi tidak ditandatangani dan data hilang saat server mati.
 * Hanya aktif bila ARSSMED_BACKEND=memory (lihat ./index.ts).
 */

const COOKIE = "arssmed_mem_session";
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

interface MemTeacher { id: string; email: string; password: string; role: "teacher" | "admin"; fullName: string }
interface MemClass { id: string; teacherId: string; name: string; joinCode: string; mode: ClassMode; academicYear: string | null; createdAt: number; freeExplore?: boolean }
interface MemLearning {
  steps: Record<string, Step[]>;
  predictions: Record<string, string>;
  viewed: Record<string, string[]>;
  discussed: string[];
  /** Log tampilan (mode + jenis perangkat), seperti tabel object_views. */
  views?: { unit: string; object: string; mode: string; device: string | null }[];
}
interface MemStudent { id: string; classId: string; code: string; nickname: string | null; pin: string; pseudoId: string; consent: ConsentStatus }
interface Attempt { key: string; at: number; ok: boolean }

const code = (n: number) => Array.from(randomBytes(n), (b) => ALPHABET[b % ALPHABET.length]).join("");
const pin = () => String(randomInt(0, 10000)).padStart(4, "0");

function seed() {
  const teacher: MemTeacher = { id: "mem-teacher-1", email: "guru@contoh.id", password: "rahasia123", role: "teacher", fullName: "Bu Dewi" };
  const other: MemTeacher = { id: "mem-teacher-2", email: "guru2@contoh.id", password: "rahasia123", role: "teacher", fullName: "Pak Arif" };
  const cls: MemClass = { id: "mem-class-6a", teacherId: teacher.id, name: "6A", joinCode: "K7M2QX", mode: "research", academicYear: "2026/2027", createdAt: 1 };
  const otherCls: MemClass = { id: "mem-class-6b", teacherId: other.id, name: "6B", joinCode: "P3RT9W", mode: "learn_only", academicYear: null, createdAt: 2 };
  return {
    teachers: [teacher, other],
    classes: [cls, otherCls],
    students: [
      { id: "mem-stu-1", classId: cls.id, code: "S01", nickname: "Raka", pin: "1234", pseudoId: "P-RAKA0001", consent: "granted" },
      { id: "mem-stu-2", classId: cls.id, code: "S02", nickname: "Sinta", pin: "5678", pseudoId: "P-SINT0002", consent: "pending" },
      { id: "mem-stu-3", classId: otherCls.id, code: "S01", nickname: "Budi", pin: "4321", pseudoId: "P-BUDI0003", consent: "pending" },
    ] as MemStudent[],
    attempts: [] as Attempt[],
    learning: {} as Record<string, MemLearning>,
    classTests: [] as MemClassTest[],
    testAttempts: [] as MemAttempt[],
    responses: {} as Record<string, MemResponse>,
    events: [] as { key: string; field: string; old: string | null; new: string | null; at: number }[],
    classifications: {} as Record<string, ClassificationRow[]>,
    itemsFrozen: false,
  };
}

interface MemClassTest { classId: string; phase: Phase; status: ClassTestStatus; openedAt: string | null; closedAt: string | null }
interface MemAttempt { id: string; studentId: string; classId: string; phase: Phase; submittedAt: string | null; device: string | null }
interface MemResponse { answer: Answer; clientTs: number; changes: number; timeMs: number | null; optionOrder: unknown }

/** Bank soal dari data/items.json (sama dengan migrasi *_items.sql). */
const MEM_ITEMS: StoredItem[] = ITEMS.items.map((i) => ({ id: `item-${i.item_order}`, order: i.item_order, content: i.content }));
const MEM_RULE_SET = ITEMS.default_rule_set_id ? getRuleSet(ITEMS.default_rule_set_id) : PEDOMAN_V1_RULE_SET;

type Store = ReturnType<typeof seed>;
const g = globalThis as unknown as { __arssmedMemStore?: Store };
function store(): Store {
  return (g.__arssmedMemStore ??= seed());
}
/** Hanya untuk uji: kembalikan data awal. */
export function resetMemoryStore() {
  g.__arssmedMemStore = seed();
}

type Session = { kind: "staff"; id: string } | { kind: "student"; id: string };

async function readSession(): Promise<Session | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Session;
  } catch {
    return null;
  }
}
async function writeSession(s: Session | null) {
  const jar = await cookies();
  if (!s) jar.delete(COOKIE);
  else jar.set(COOKIE, Buffer.from(JSON.stringify(s)).toString("base64url"), { httpOnly: true, sameSite: "lax", path: "/" });
}

async function requireStaff(): Promise<MemTeacher> {
  const s = await readSession();
  const t = s?.kind === "staff" ? store().teachers.find((x) => x.id === s.id) : undefined;
  if (!t) throw new BackendError("forbidden");
  return t;
}
function ownsClass(t: MemTeacher, classId: string) {
  const c = store().classes.find((x) => x.id === classId);
  return c && (t.role === "admin" || c.teacherId === t.id) ? c : null;
}
async function studentInOwnedClass(studentId: string) {
  const t = await requireStaff();
  const s = store().students.find((x) => x.id === studentId);
  if (!s || !ownsClass(t, s.classId)) throw new BackendError("not_found", "Siswa tidak ditemukan.");
  return s;
}

const WINDOW_MS = 10 * 60 * 1000;

/** Meniru fungsi DB alur belajar (supabase/migrations/*_learning.sql): urutan & validasi sama. */
async function requireStudent() {
  const s = await readSession();
  const st = s?.kind === "student" ? store().students.find((x) => x.id === s.id) : undefined;
  if (!st) throw new BackendError("forbidden", "Masuk sebagai siswa untuk menyimpan kemajuan.");
  const l = (store().learning[st.id] ??= { steps: {}, predictions: {}, viewed: {}, discussed: [] });
  const cls = store().classes.find((c) => c.id === st.classId);
  return { st, l, free: cls?.freeExplore ?? false };
}
function requireUnit(unit: string) {
  const u = unitLearning(unit);
  if (!u) throw new BackendError("not_found", "Unit tidak ditemukan.");
  return u;
}
const rkey = (attemptId: string, itemId: string) => `${attemptId}:${itemId}`;
function answersOf(attemptId: string): Record<string, Answer> {
  const out: Record<string, Answer> = {};
  for (const it of MEM_ITEMS) {
    const r = store().responses[rkey(attemptId, it.id)];
    if (r) out[it.id] = r.answer;
  }
  return out;
}
function answeredCount(attemptId: string) {
  const a = answersOf(attemptId);
  return MEM_ITEMS.filter((it) => isComplete(itemShape(it.content).format, a[it.id])).length;
}
function classTest(classId: string, phase: Phase) {
  return store().classTests.find((c) => c.classId === classId && c.phase === phase);
}
async function openAttempt(attemptId: string) {
  const { st } = await requireStudent();
  const a = store().testAttempts.find((x) => x.id === attemptId && x.studentId === st.id);
  if (!a) throw new BackendError("not_found", "Percobaan tes tidak ditemukan.");
  if (a.submittedAt) throw new BackendError("submitted", "Tes sudah diselesaikan.");
  if (classTest(a.classId, a.phase)?.status !== "open") throw new BackendError("closed", "Tes sudah ditutup gurumu.");
  return a;
}

function summarize(c: MemClass) {
  return {
    id: c.id,
    name: c.name,
    joinCode: c.joinCode,
    mode: c.mode,
    academicYear: c.academicYear,
    studentCount: store().students.filter((s) => s.classId === c.id).length,
    freeExplore: c.freeExplore ?? false,
  };
}

export const memoryBackend: Backend = {
  name: "memory",

  async getViewer(): Promise<Viewer> {
    const s = await readSession();
    if (s?.kind === "staff") {
      const t = store().teachers.find((x) => x.id === s.id);
      if (t) return { kind: "staff", id: t.id, email: t.email, role: t.role, fullName: t.fullName };
    }
    if (s?.kind === "student") {
      const st = store().students.find((x) => x.id === s.id);
      const c = st && store().classes.find((x) => x.id === st.classId);
      if (st && c) return { kind: "student", studentId: st.id, studentCode: st.code, nickname: st.nickname, classId: c.id, className: c.name };
    }
    return { kind: "anon" };
  },

  async signInTeacher(email, password) {
    const t = store().teachers.find((x) => x.email === email.trim().toLowerCase() && x.password === password);
    if (!t) throw new BackendError("invalid_credentials");
    await writeSession({ kind: "staff", id: t.id });
  },

  async signInStudent(joinCode, studentCode, pinInput) {
    let found: MemStudent | undefined;
    await loginStudent(
      {
        async verify(input) {
          const key = `${input.joinCode}|${input.studentCode}`;
          const now = Date.now();
          const all = store().attempts.filter((a) => a.key === key);
          const lastOk = Math.max(0, ...all.filter((a) => a.ok).map((a) => a.at));
          const fails = all.filter((a) => !a.ok && a.at > now - WINDOW_MS && a.at > lastOk);
          if (fails.length >= 5) {
            const oldest = Math.min(...fails.map((a) => a.at));
            return { status: "rate_limited", student_id: null, auth_user_id: null, retry_after_seconds: Math.ceil((oldest + WINDOW_MS - now) / 1000) };
          }
          const cls = store().classes.find((c) => c.joinCode === input.joinCode);
          found = cls && store().students.find((s) => s.classId === cls.id && s.code === input.studentCode && s.pin === input.pin);
          store().attempts.push({ key, at: now, ok: !!found });
          return found
            ? { status: "ok", student_id: found.id, auth_user_id: found.id, retry_after_seconds: null }
            : { status: "invalid", student_id: null, auth_user_id: null, retry_after_seconds: null };
        },
        createAuthUser: async () => "unused",
        linkAuthUser: async () => undefined,
        getLinkedAuthUser: async () => null,
        async issueSession(email) {
          if (!found || email !== studentAuthEmail(found.id)) throw new Error("sesi tidak cocok");
          await writeSession({ kind: "student", id: found.id });
        },
      },
      { joinCode, studentCode, pin: pinInput },
    );
  },

  async signOut() {
    await writeSession(null);
  },

  async listClasses() {
    const t = await requireStaff();
    return store()
      .classes.filter((c) => t.role === "admin" || c.teacherId === t.id)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map(summarize);
  },

  async createClass(input) {
    const t = await requireStaff();
    const c: MemClass = { id: randomUUID(), teacherId: t.id, name: input.name, joinCode: code(6), mode: input.mode, academicYear: input.academicYear, createdAt: Date.now() };
    store().classes.push(c);
    return { id: c.id };
  },

  async getClass(id) {
    const t = await requireStaff();
    const c = ownsClass(t, id);
    if (!c) return null;
    return summarize(c);
  },

  async listStudents(classId) {
    const t = await requireStaff();
    if (!ownsClass(t, classId)) throw new BackendError("not_found");
    return store()
      .students.filter((s) => s.classId === classId)
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((s) => ({ id: s.id, code: s.code, nickname: s.nickname, pseudoId: s.pseudoId, consent: s.consent }));
  },

  async createStudents(classId, rows) {
    const t = await requireStaff();
    if (!ownsClass(t, classId)) throw new BackendError("forbidden", "Anda tidak punya akses ke kelas ini.");
    if (rows.length === 0) throw new BackendError("empty", "Daftar siswa kosong.");
    const existing = store().students.filter((s) => s.classId === classId);
    if (existing.length + rows.length > MAX_STUDENTS) throw new BackendError("too_many", "Satu kelas paling banyak 60 siswa.");
    const taken = new Set(existing.map((s) => s.code));
    let next = Math.max(0, ...existing.map((s) => Number(/^S(\d+)$/.exec(s.code)?.[1] ?? 0))) + 1;
    const out: CreatedStudent[] = [];
    const pending: MemStudent[] = [];
    for (const r of rows) {
      let c = r.code?.trim().toUpperCase() || null;
      if (!c) {
        do c = `S${String(next++).padStart(2, "0")}`;
        while (taken.has(c));
      }
      if (!STUDENT_CODE_RE.test(c)) throw new BackendError("invalid_code", `Kode siswa tidak valid: ${c}.`);
      if (taken.has(c)) throw new BackendError("duplicate_code", `Kode siswa sudah dipakai: ${c}.`);
      const nick = r.nickname?.trim() || null;
      if (nick && nick.length > MAX_NICKNAME) throw new BackendError("nickname_too_long");
      taken.add(c);
      const s: MemStudent = { id: randomUUID(), classId, code: c, nickname: nick, pin: pin(), pseudoId: `P-${code(8)}`, consent: "pending" };
      pending.push(s);
      out.push({ id: s.id, code: s.code, nickname: s.nickname, pin: s.pin });
    }
    store().students.push(...pending); // semua atau tidak sama sekali, seperti transaksi DB
    return out;
  },

  async resetPin(studentId) {
    const s = await studentInOwnedClass(studentId);
    s.pin = pin();
    return s.pin;
  },

  async setConsent(studentId, status) {
    const s = await studentInOwnedClass(studentId);
    s.consent = status;
  },

  async deleteStudent(studentId) {
    const s = await studentInOwnedClass(studentId);
    store().students = store().students.filter((x) => x.id !== s.id);
    delete store().learning[s.id];
  },

  async setFreeExplore(classId, value) {
    const t = await requireStaff();
    const c = ownsClass(t, classId);
    if (!c) throw new BackendError("not_found");
    c.freeExplore = value;
  },

  async getLearningState(): Promise<LearningSnapshot> {
    const { l, free } = await requireStudent();
    const { views: _views, ...rest } = l;
    void _views;
    return structuredClone({ freeMode: free, ...rest });
  },

  async savePrediction(key, option) {
    const { l } = await requireStudent();
    const found = findPrediction(key);
    if (!found) throw new BackendError("not_found", "Pertanyaan tidak ditemukan.");
    if (!found.prediction.options.some((o) => o.key === option)) throw new BackendError("invalid_input", "Pilihan tidak dikenal.");
    l.predictions[key] ??= option;
    return l.predictions[key]!;
  },

  async recordObjectView(unit, objectId, mode = "3d", device = null) {
    const { l } = await requireStudent();
    requireUnit(unit);
    if (!unitObjects(unit).some((o) => o.id === objectId)) throw new BackendError("not_found", "Objek tidak ditemukan.");
    (l.views ??= []).push({ unit, object: objectId, mode, device });
    const v = (l.viewed[unit] ??= []);
    if (!v.includes(objectId)) v.push(objectId);
  },

  async completeStep(unit, step) {
    const { l, free } = await requireStudent();
    const u = requireUnit(unit);
    if (!STEPS.includes(step)) throw new BackendError("invalid_input", "Langkah tidak dikenal.");
    const done = (l.steps[unit] ??= []);
    if (done.includes(step)) return;
    if (blockingStep(done, step)) throw new BackendError("locked", "Selesaikan langkah sebelumnya dulu.");
    if (step === "tebak" && !predictionsComplete(l.predictions, u.predictions.map((p) => p.key)))
      throw new BackendError("locked", "Jawab semua pertanyaan Tebak dulu.");
    if (step === "amati" && !canFinishObserve(l.viewed[unit] ?? [], unitObjects(unit).map((o) => o.id), free))
      throw new BackendError("locked", "Lihat semua benda di Rel Orbit dulu.");
    done.push(step);
  },

  async markDiscussed(unit) {
    await this.completeStep(unit, "jelaskan");
    const { l } = await requireStudent();
    if (!l.discussed.includes(unit)) l.discussed.push(unit);
  },

  // ---------------------------------------------------------------- tes diagnostik (M6)

  async studentTests(): Promise<StudentTestStatus[]> {
    const { st } = await requireStudent();
    const cls = store().classes.find((c) => c.id === st.classId)!;
    return (["pre", "post"] as Phase[]).map((phase) => {
      const ct = classTest(cls.id, phase);
      const a = store().testAttempts.find((x) => x.studentId === st.id && x.phase === phase);
      return {
        phase,
        status: ct?.status ?? "draft",
        blocked: cls.mode !== "research" ? "learn_only" : st.consent === "withdrawn" ? "consent_withdrawn" : st.consent !== "granted" ? "consent_pending" : null,
        attempt: a ? { answered: answeredCount(a.id), total: MEM_ITEMS.length, submitted: !!a.submittedAt } : null,
      };
    });
  },

  async startAttempt(phase, device) {
    const { st } = await requireStudent();
    const cls = store().classes.find((c) => c.id === st.classId)!;
    let a = store().testAttempts.find((x) => x.studentId === st.id && x.phase === phase);
    if (a?.submittedAt) return { attemptId: a.id, phase, submitted: true, items: [], answers: {} };
    if (classTest(cls.id, phase)?.status !== "open") throw new BackendError("closed", "Tes belum dibuka. Tanyakan ke gurumu.");
    if (cls.mode !== "research") throw new BackendError("learn_only", "Tes diagnostik hanya untuk kelas penelitian.");
    if (st.consent !== "granted") throw new BackendError("consent", "Gurumu perlu mencatat persetujuan orang tuamu dulu.");
    if (!a) {
      a = { id: randomUUID(), studentId: st.id, classId: cls.id, phase, submittedAt: null, device };
      store().testAttempts.push(a);
    }
    return { attemptId: a.id, phase, submitted: false, items: deliverItems(a.id, MEM_ITEMS), answers: answersOf(a.id) };
  },

  async saveResponse(attemptId, r) {
    const a = await openAttempt(attemptId);
    const item = MEM_ITEMS.find((i) => i.id === r.itemId);
    if (!item) throw new BackendError("not_found", "Butir tidak ditemukan.");
    const shape = itemShape(item.content);
    const v = validateAnswer(shape, r.answer);
    // DB memeriksa kunci & skala; urutan tier ditegakkan di klien (D-049). Samakan perilakunya.
    if (v && v !== "order") throw new BackendError("invalid_input", "Jawaban tidak valid.");
    const key = rkey(a.id, item.id);
    const ts = Date.parse(r.clientTs);
    const prev = store().responses[key];
    if (prev && prev.clientTs > ts) return "stale";
    if (prev) {
      let changed = false;
      for (const f of ["tier1", "confidenceA", "reason", "confidenceR"] as const) {
        if (prev.answer[f] !== r.answer[f]) {
          changed = true;
          store().events.push({ key, field: f, old: prev.answer[f] === null ? null : String(prev.answer[f]), new: r.answer[f] === null ? null : String(r.answer[f]), at: Date.now() });
        }
      }
      if (changed) prev.changes++;
      prev.answer = { ...EMPTY_ANSWER, ...r.answer };
      prev.clientTs = ts;
      prev.timeMs = r.responseTimeMs ?? prev.timeMs;
    } else {
      store().responses[key] = { answer: { ...EMPTY_ANSWER, ...r.answer }, clientTs: ts, changes: 0, timeMs: r.responseTimeMs, optionOrder: r.optionOrder };
    }
    return "saved";
  },

  async submitAttempt(attemptId) {
    const a = await openAttempt(attemptId);
    const answers = answersOf(a.id);
    const missing = MEM_ITEMS.filter((it) => !isComplete(itemShape(it.content).format, answers[it.id])).map((it) => it.order);
    if (missing.length) return { ok: false, missing };
    a.submittedAt = new Date().toISOString();
    store().classifications[a.id] = classifyAttempt(MEM_ITEMS, answers, MEM_RULE_SET);
    return { ok: true };
  },

  async classTestOverview(classId) {
    const t = await requireStaff();
    const c = ownsClass(t, classId);
    if (!c) throw new BackendError("not_found", "Kelas tidak ditemukan.");
    return (["pre", "post"] as Phase[]).map((phase) => {
      const ct = classTest(c.id, phase);
      return {
        phase,
        status: ct?.status ?? "draft",
        openedAt: ct?.openedAt ?? null,
        closedAt: ct?.closedAt ?? null,
        total: MEM_ITEMS.length,
        students: store()
          .students.filter((s) => s.classId === c.id)
          .sort((x, y) => x.code.localeCompare(y.code))
          .map((s) => {
            const a = store().testAttempts.find((x) => x.studentId === s.id && x.phase === phase);
            return { id: s.id, code: s.code, nickname: s.nickname, consent: s.consent, started: !!a, submitted: !!a?.submittedAt, answered: a ? answeredCount(a.id) : 0 };
          }),
      };
    });
  },

  async openClassTest(classId, phase) {
    const t = await requireStaff();
    const c = ownsClass(t, classId);
    if (!c) throw new BackendError("not_found", "Kelas tidak ditemukan.");
    if (c.mode !== "research") throw new BackendError("learn_only", "Tes diagnostik hanya untuk kelas yang ikut penelitian.");
    const ct = classTest(c.id, phase);
    if (ct) {
      ct.status = "open";
      ct.openedAt ??= new Date().toISOString();
      ct.closedAt = null;
    } else store().classTests.push({ classId: c.id, phase, status: "open", openedAt: new Date().toISOString(), closedAt: null });
    store().itemsFrozen = true;
  },

  async closeClassTest(classId, phase) {
    const t = await requireStaff();
    const c = ownsClass(t, classId);
    if (!c) throw new BackendError("not_found", "Kelas tidak ditemukan.");
    const ct = classTest(c.id, phase);
    if (ct?.status === "open") {
      ct.status = "closed";
      ct.closedAt = new Date().toISOString();
    }
  },
};
