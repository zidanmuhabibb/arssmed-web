import { z } from "zod";

/**
 * Konfigurasi Supabase dari variabel lingkungan. Mendukung nama kunci baru
 * (publishable/secret) dan lama (anon/service_role).
 */
const PublicEnv = z.object({
  url: z.url(),
  publishableKey: z.string().min(20),
});

export function getPublicSupabaseEnv() {
  const parsed = PublicEnv.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  return parsed.success ? parsed.data : null;
}

/** Kunci rahasia: HANYA server. Tidak boleh berawalan NEXT_PUBLIC_. */
export function getSecretSupabaseKey(): string | null {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  return key && key.length >= 20 ? key : null;
}
