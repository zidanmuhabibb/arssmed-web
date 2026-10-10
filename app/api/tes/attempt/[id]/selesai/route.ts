import { NextResponse } from "next/server";
import { getBackend } from "@/lib/backend";
import { errorResponse, NO_STORE } from "@/lib/tes/http";

/** POST /api/tes/attempt/[id]/selesai — tandai selesai, klasifikasi di server. Hasil TIDAK dikirim ke siswa (FR-36). */
export async function POST(_request: Request, ctx: RouteContext<"/api/tes/attempt/[id]/selesai">) {
  const { id } = await ctx.params;
  try {
    await getBackend().rateLimit("tes_submit");
    const r = await getBackend().submitAttempt(id);
    return NextResponse.json(r.ok ? { ok: true } : { ok: false, missing: r.missing }, { status: r.ok ? 200 : 422, headers: NO_STORE });
  } catch (e) {
    return errorResponse(e);
  }
}
