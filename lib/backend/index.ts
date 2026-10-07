import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { memoryBackend } from "./memory";
import { supabaseBackend } from "./supabase";
import type { Backend, Viewer } from "./types";

export * from "./types";

/**
 * Pilih backend. `ARSSMED_BACKEND=memory` hanya untuk uji e2e/demo lokal dan
 * di build produksi butuh izin eksplisit `ARSSMED_ALLOW_MEMORY_BACKEND=1`.
 */
export function getBackend(): Backend {
  if (process.env.ARSSMED_BACKEND === "memory") {
    if (process.env.NODE_ENV === "production" && process.env.ARSSMED_ALLOW_MEMORY_BACKEND !== "1") {
      throw new Error("Backend memori tidak boleh dipakai di produksi.");
    }
    return memoryBackend;
  }
  return supabaseBackend;
}

/**
 * Pengguna saat ini, sekali per permintaan. `connection()` memastikan pemanggil SELALU
 * dirender per permintaan — tanpa ini, halaman bisa terprarender saat build sebagai
 * "anon" (mis. variabel lingkungan Supabase belum ada) dan redirect ke halaman masuk ikut terbekukan.
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  await connection();
  return getBackend().getViewer();
});

export async function requireStaff() {
  const v = await getViewer();
  if (v.kind !== "staff") redirect("/guru/masuk");
  return v;
}
