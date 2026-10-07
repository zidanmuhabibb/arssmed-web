import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getPublicSupabaseEnv, getSecretSupabaseKey } from "./env";

/** Klien per permintaan dengan sesi pengguna dari cookie (RLS berlaku). */
export async function createSupabaseServerClient() {
  const env = getPublicSupabaseEnv();
  if (!env) return null;
  const store = await cookies();
  return createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) store.set(name, value, options);
        } catch {
          // Dipanggil dari Server Component (cookie hanya-baca); proxy.ts yang memperbarui sesi.
        }
      },
    },
  });
}

/** Klien service role: melewati RLS. Hanya untuk masuk siswa dan tugas server tepercaya. */
export function createSupabaseAdminClient() {
  const env = getPublicSupabaseEnv();
  const secret = getSecretSupabaseKey();
  if (!env || !secret) return null;
  return createClient(env.url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}
