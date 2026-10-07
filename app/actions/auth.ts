"use server";

import { z } from "zod";
import { BackendError, getBackend, getViewer } from "@/lib/backend";

export type TeacherSignInState = {
  error: "invalid_credentials" | "invalid_input" | "not_configured" | "unknown" | null;
  email: string;
  /** Berhasil: klien melakukan navigasi penuh (bukan router) agar cache halaman dari sesi lama terbuang. */
  redirectTo?: string;
};

const TeacherSignIn = z.object({ email: z.email().max(254), password: z.string().min(1).max(200) });

export async function signInTeacherAction(_prev: TeacherSignInState, form: FormData): Promise<TeacherSignInState> {
  const email = String(form.get("email") ?? "").trim();
  const parsed = TeacherSignIn.safeParse({ email, password: form.get("password") });
  if (!parsed.success) return { error: "invalid_input", email };
  try {
    await getBackend().signInTeacher(parsed.data.email, parsed.data.password);
  } catch (e) {
    const code = e instanceof BackendError ? e.code : "unknown";
    return { error: code === "invalid_credentials" || code === "not_configured" ? code : "unknown", email };
  }
  return { error: null, email, redirectTo: "/guru/kelas" };
}

/** Mengembalikan tujuan; klien menavigasi penuh agar data pengguna sebelumnya tidak tertinggal di perangkat bersama. */
export async function signOutAction(): Promise<string> {
  const viewer = await getViewer();
  await getBackend().signOut();
  return viewer.kind === "staff" ? "/guru/masuk" : "/";
}
