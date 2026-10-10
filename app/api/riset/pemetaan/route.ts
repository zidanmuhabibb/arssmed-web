import { connection, NextResponse } from "next/server";
import { z } from "zod";
import { toCsv } from "@/lib/analysis";
import { NAME_MAP_CONFIRMATION } from "@/lib/analysis/options";
import { BackendError, getBackend, getViewer } from "@/lib/backend";
import { errorResponse, NO_STORE } from "@/lib/tes/http";


const Body = z.object({
  confirm: z.literal(NAME_MAP_CONFIRMATION),
  kelas: z.string().regex(/^[\w-]{1,64}$/).nullable().optional(),
});

/**
 * POST /api/riset/pemetaan — CSV pemetaan student_pseudo_id → kode siswa & nama panggilan.
 * Admin saja, dengan konfirmasi tertulis, dibatasi lajunya, dan tercatat di audit. Disimpan TERPISAH dari ekspor data.
 */
export async function POST(request: Request) {
  await connection();
  try {
    const viewer = await getViewer();
    if (viewer.kind !== "staff") throw new BackendError("forbidden", "Masuk sebagai peneliti.");
    const form = request.headers.get("content-type")?.includes("application/json") ? await request.json().catch(() => null) : Object.fromEntries(await request.formData());
    const parsed = Body.safeParse({ ...form, kelas: form?.kelas || null });
    if (!parsed.success) return NextResponse.json({ error: "invalid_input", message: "Ketik kalimat konfirmasi persis seperti yang diminta." }, { status: 400, headers: NO_STORE });
    const backend = getBackend();
    await backend.rateLimit("riset_name_map");
    const rows = await backend.researchNameMap(parsed.data.kelas ?? null);
    const csv = toCsv({
      name: "name_map",
      columns: ["student_pseudo_id", "class_name", "student_code", "nickname", "consent"],
      rows: rows.map((r) => [r.pseudoId, r.className, r.studentCode, r.nickname, r.consent]),
    });
    return new Response(csv, {
      headers: { ...NO_STORE, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="arssmed_pemetaan_RAHASIA_${new Date().toISOString().slice(0, 10)}.csv"` },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
