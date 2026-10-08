"use server";

import { refresh } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import { z } from "zod";
import { BackendError, getBackend, type CreatedStudent } from "@/lib/backend";

type Fail = { ok: false; error: string; message?: string };

function fail(e: unknown): Fail {
  if (e instanceof BackendError) return { ok: false, error: e.code, message: e.message };
  console.error("[guru] galat tak terduga", e instanceof Error ? e.message : e);
  return { ok: false, error: "unknown" };
}

// ---------------------------------------------------------------- kelas

export type CreateClassState = { error: "name" | "academicYear" | "unknown" | null; values: { name: string; academicYear: string; mode: string } };

const CreateClass = z.object({
  name: z.string().trim().min(1).max(60),
  academicYear: z
    .string()
    .trim()
    .regex(/^(\d{4}\/\d{4})?$/),
  mode: z.enum(["learn_only", "research"]),
});

export async function createClassAction(_prev: CreateClassState, form: FormData): Promise<CreateClassState> {
  const values = {
    name: String(form.get("name") ?? ""),
    academicYear: String(form.get("academicYear") ?? ""),
    mode: String(form.get("mode") ?? "learn_only"),
  };
  const parsed = CreateClass.safeParse(values);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return { error: field === "academicYear" ? "academicYear" : "name", values };
  }
  let id: string;
  try {
    ({ id } = await getBackend().createClass({
      name: parsed.data.name,
      academicYear: parsed.data.academicYear || null,
      mode: parsed.data.mode,
    }));
  } catch (e) {
    if (e instanceof BackendError && e.code === "forbidden") redirect("/guru/masuk", RedirectType.replace);
    return { error: "unknown", values };
  }
  redirect(`/guru/kelas/${id}`);
}

// ---------------------------------------------------------------- siswa

const Uuidish = z.string().min(1).max(64);
const ImportRows = z
  .array(z.object({ code: z.string().max(12).nullable(), nickname: z.string().max(30).nullable() }))
  .min(1)
  .max(60);

export async function importStudentsAction(classId: string, rows: unknown): Promise<{ ok: true; created: CreatedStudent[] } | Fail> {
  const id = Uuidish.safeParse(classId);
  const parsed = ImportRows.safeParse(rows);
  if (!id.success || !parsed.success) return { ok: false, error: "invalid_input" };
  try {
    const created = await getBackend().createStudents(id.data, parsed.data);
    refresh();
    return { ok: true, created };
  } catch (e) {
    return fail(e);
  }
}

export async function resetPinAction(studentId: string): Promise<{ ok: true; pin: string } | Fail> {
  const id = Uuidish.safeParse(studentId);
  if (!id.success) return { ok: false, error: "invalid_input" };
  try {
    return { ok: true, pin: await getBackend().resetPin(id.data) };
  } catch (e) {
    return fail(e);
  }
}

export async function setConsentAction(studentId: string, status: string): Promise<{ ok: true } | Fail> {
  const id = Uuidish.safeParse(studentId);
  const st = z.enum(["pending", "granted", "withdrawn"]).safeParse(status);
  if (!id.success || !st.success) return { ok: false, error: "invalid_input" };
  try {
    await getBackend().setConsent(id.data, st.data);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteStudentAction(studentId: string): Promise<{ ok: true } | Fail> {
  const id = Uuidish.safeParse(studentId);
  if (!id.success) return { ok: false, error: "invalid_input" };
  try {
    await getBackend().deleteStudent(id.data);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- alur belajar

/** FR-22: mode bebas — siswa boleh lanjut dari Amati tanpa membuka semua objek. */
export async function setFreeExploreAction(classId: string, value: boolean): Promise<{ ok: true } | Fail> {
  const id = Uuidish.safeParse(classId);
  if (!id.success || typeof value !== "boolean") return { ok: false, error: "invalid_input" };
  try {
    await getBackend().setFreeExplore(id.data, value);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
