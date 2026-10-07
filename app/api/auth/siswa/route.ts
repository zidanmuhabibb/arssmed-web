import { NextResponse } from "next/server";
import { BackendError, getBackend } from "@/lib/backend";

const STATUS: Partial<Record<BackendError["code"], number>> = {
  invalid_input: 400,
  invalid_credentials: 401,
  rate_limited: 429,
  not_configured: 503,
};

/** POST /api/auth/siswa — masuk siswa (PRD §11). Jawaban tidak pernah di-cache. */
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400, headers });
  }
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  try {
    await getBackend().signInStudent(str(body.joinCode), str(body.studentCode), str(body.pin));
    return NextResponse.json({ ok: true, redirect: "/belajar" }, { headers });
  } catch (e) {
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
