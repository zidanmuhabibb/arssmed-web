import "server-only";
import { NextResponse } from "next/server";
import { BackendError } from "@/lib/backend";

const STATUS: Partial<Record<BackendError["code"], number>> = {
  forbidden: 401,
  not_found: 404,
  invalid_input: 400,
  closed: 403,
  consent: 403,
  learn_only: 403,
  submitted: 409,
  not_configured: 503,
};

export const NO_STORE = { "Cache-Control": "no-store" };

/** Galat API tes: kode + pesan Indonesia; kunci jawaban tidak pernah ikut. */
export function errorResponse(e: unknown) {
  if (e instanceof BackendError && STATUS[e.code]) {
    return NextResponse.json({ error: e.code, message: e.message }, { status: STATUS[e.code], headers: NO_STORE });
  }
  console.error("[tes] galat tak terduga", e instanceof Error ? e.message : e);
  return NextResponse.json({ error: "unknown" }, { status: 500, headers: NO_STORE });
}
