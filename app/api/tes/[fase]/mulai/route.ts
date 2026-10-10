import { NextResponse } from "next/server";
import { deviceKind } from "@/lib/ar/capabilities";
import { BackendError, getBackend, getViewer } from "@/lib/backend";
import { errorResponse, NO_STORE } from "@/lib/tes/http";
import { isPhase } from "@/lib/tes/types";

/** GET /api/tes/[fase]/mulai — mulai/lanjutkan; butir TANPA kunci, opsi teracak (PRD §11). */
export async function GET(request: Request, ctx: RouteContext<"/api/tes/[fase]/mulai">) {
  const { fase } = await ctx.params;
  if (!isPhase(fase)) return NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_STORE });
  try {
    const viewer = await getViewer();
    if (viewer.kind !== "student") throw new BackendError("forbidden", "Masuk sebagai siswa untuk mengerjakan tes.");
    await getBackend().rateLimit("tes_start");
    const h = request.headers;
    const device = deviceKind({ userAgent: h.get("user-agent") ?? "", uaDataPlatform: h.get("sec-ch-ua-platform")?.replace(/"/g, ""), uaDataMobile: h.get("sec-ch-ua-mobile") === "?1" });
    return NextResponse.json(await getBackend().startAttempt(fase, device), { headers: NO_STORE });
  } catch (e) {
    // Keadaan biasa (tes belum dibuka, belum ada persetujuan, belum masuk) dijawab 200 + `blocked`,
    // bukan status galat, agar tidak tercatat sebagai galat di konsol (DoD PRD §0).
    if (e instanceof BackendError && (["closed", "consent", "learn_only", "forbidden"] as string[]).includes(e.code)) {
      return NextResponse.json({ blocked: e.code, message: e.message }, { headers: NO_STORE });
    }
    return errorResponse(e);
  }
}
