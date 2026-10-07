import "server-only";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { MAX_NICKNAME, MAX_STUDENTS, STUDENT_CODE_RE } from "@/lib/students/csv";
import { loginStudent, studentAuthEmail } from "./student-login";
import { BackendError, type Backend, type ClassMode, type ConsentStatus, type CreatedStudent, type Viewer } from "./types";

/**
 * Backend di memori untuk uji e2e dan demo lokal TANPA Supabase (DECISIONS D-026).
 * Meniru aturan basis data (kepemilikan kelas, kode unik, PIN, pembatasan laju)
 * tetapi tidak aman untuk produksi: sesi tidak ditandatangani dan data hilang saat server mati.
 * Hanya aktif bila ARSSMED_BACKEND=memory (lihat ./index.ts).
 */

const COOKIE = "arssmed_mem_session";
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

interface MemTeacher { id: string; email: string; password: string; role: "teacher" | "admin"; fullName: string }
interface MemClass { id: string; teacherId: string; name: string; joinCode: string; mode: ClassMode; academicYear: string | null; createdAt: number }
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
  };
}

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
      .map((c) => ({
        id: c.id,
        name: c.name,
        joinCode: c.joinCode,
        mode: c.mode,
        academicYear: c.academicYear,
        studentCount: store().students.filter((s) => s.classId === c.id).length,
      }));
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
    return { id: c.id, name: c.name, joinCode: c.joinCode, mode: c.mode, academicYear: c.academicYear, studentCount: store().students.filter((s) => s.classId === c.id).length };
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
  },
};
