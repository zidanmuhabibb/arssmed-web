import { NextResponse } from "next/server";
import { BackendError, getBackend } from "@/lib/backend";

const STATUS: Partial<Record<BackendError["code"], number>> = {
  invalid_input: 400,
  invalid_credentials: 401,
  rate_limited: 429,
  not_configured: 503,
};

/**
 * POST /api/auth/siswa — masuk siswa (PRD §11). Jawaban tidak pernah di-cache.
 * JSON (dari skrip) → JSON. Formulir biasa (HP lambat, tombol ditekan sebelum skrip siap) →
 * redirect 303, agar PIN tidak pernah masuk ke alamat halaman (?pin=…).
 */
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  const isForm = /application\/x-www-form-urlencoded|multipart\/form-data/.test(request.headers.get("content-type") ?? "");
  let body: Record<string, unknown>;
  try {
    body = isForm ? Object.fromEntries((await request.formData()).entries()) : ((await request.json()) as Record<string, unknown>);
  } catch {
    return isForm ? back(request, "invalid_input") : NextResponse.json({ error: "invalid_input" }, { status: 400, headers });
  }
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  try {
    await getBackend().signInStudent(str(body.joinCode), str(body.studentCode), str(body.pin));
    // Location relatif: request.url bisa memakai host lain di belakang proksi (CSP form-action).
    if (isForm) return new Response(null, { status: 303, headers: { ...Object.fromEntries(new Headers(headers)), Location: "/belajar" } });
    return NextResponse.json({ ok: true, redirect: "/belajar" }, { headers });
  } catch (e) {
    if (isForm) {
      const code = e instanceof BackendError && STATUS[e.code] ? e.code : "unknown";
      const minutes = e instanceof BackendError && code === "rate_limited" ? Math.max(1, Math.ceil(Number(e.meta.retryAfterSeconds ?? 600) / 60)) : undefined;
      return back(request, code, minutes);
    }
    if (e instanceof BackendError && STATUS[e.code]) {
      const retry = e.code === "rate_limited" ? Number(e.meta.retryAfterSeconds ?? 600) : undefined;
      return NextResponse.json(
        { error: e.code, retryAfterSeconds: retry, fields: e.meta.fields },
        { status: STATUS[e.code], headers: retry ? { ...headers, "Retry-After": String(retry) } : headers },
      );
    }
    console.error("[auth/siswa] galat tak terduga", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "unknown" }, { status: 500, headers });
  }
}

function back(_request: Request, code: string, minutes?: number) {
  const q = new URLSearchParams({ galat: code });
  if (minutes) q.set("menit", String(minutes));
  // Location relatif (lihat atas).
  return new Response(null, { status: 303, headers: { "Cache-Control": "no-store", Location: `/masuk?${q}` } });
}
