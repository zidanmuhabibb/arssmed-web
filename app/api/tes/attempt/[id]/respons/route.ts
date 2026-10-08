import { NextResponse } from "next/server";
import { z } from "zod";
import { BackendError, getBackend } from "@/lib/backend";
import { errorResponse, NO_STORE } from "@/lib/tes/http";

const Key = z.string().min(1).max(8).nullable();
const Level = z.number().int().min(0).max(9).nullable();
const Body = z.object({
  itemId: z.string().min(1).max(64),
  answer: z.object({ tier1: Key, confidenceA: Level, reason: Key, confidenceR: Level }),
  clientTs: z.iso.datetime({ offset: true }),
  responseTimeMs: z.number().int().min(0).max(24 * 3600 * 1000).nullable(),
  optionOrder: z.object({ tier1: z.array(z.string().max(8)).max(10), reason: z.array(z.string().max(8)).max(10) }).nullable(),
});

/** PUT /api/tes/attempt/[id]/respons — simpan satu butir; idempoten, cap waktu klien terbaru menang. */
export async function PUT(request: Request, ctx: RouteContext<"/api/tes/attempt/[id]/respons">) {
  const { id } = await ctx.params;
  try {
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new BackendError("invalid_input", "Jawaban tidak valid.");
    const status = await getBackend().saveResponse(id, parsed.data);
    return NextResponse.json({ status }, { headers: NO_STORE });
  } catch (e) {
    return errorResponse(e);
  }
}
