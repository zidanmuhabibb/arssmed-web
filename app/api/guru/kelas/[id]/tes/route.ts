import { NextResponse } from "next/server";
import { getBackend, getViewer } from "@/lib/backend";
import { errorResponse, NO_STORE } from "@/lib/tes/http";

/** Kemajuan tes kelas untuk dasbor guru, dibaca berkala (FR-41: polling, tanpa WebSocket). */
export async function GET(_request: Request, ctx: RouteContext<"/api/guru/kelas/[id]/tes">) {
  const { id } = await ctx.params;
  try {
    const v = await getViewer();
    if (v.kind !== "staff") return NextResponse.json({ error: "forbidden" }, { status: 401, headers: NO_STORE });
    return NextResponse.json({ phases: await getBackend().classTestOverview(id) }, { headers: NO_STORE });
  } catch (e) {
    return errorResponse(e);
  }
}
