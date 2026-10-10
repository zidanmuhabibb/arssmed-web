import { connection, NextResponse } from "next/server";
import { z } from "zod";
import { BackendError, getBackend, getViewer } from "@/lib/backend";
import { RULE_SETS } from "@/lib/classification";
import { errorResponse, NO_STORE } from "@/lib/tes/http";

const Body = z.object({
  aturan: z.string().refine((x) => x in RULE_SETS, "Aturan tidak dikenal"),
  kelas: z.string().regex(/^[\w-]{1,64}$/).nullable(),
  skor: z.enum(["score_sc", "score_tier1"]).optional(),
  transisi: z.enum(["per_butir", "modus"]).optional(),
});

/**
 * POST /api/riset/reklasifikasi (PRD §11) — hitung ulang klasifikasi percobaan selesai dengan aturan
 * tertentu; admin saja, tercatat di audit. Formulir HTML → 303 kembali ke /riset; JSON → ringkasan.
 */
export async function POST(request: Request) {
  await connection();
  const isForm = !request.headers.get("content-type")?.includes("application/json");
  try {
    const viewer = await getViewer();
    if (viewer.kind !== "staff") throw new BackendError("forbidden", "Masuk sebagai peneliti.");
    const raw = isForm ? Object.fromEntries(await request.formData()) : await request.json().catch(() => null);
    const parsed = Body.safeParse({ ...raw, kelas: raw?.kelas || null });
    if (!parsed.success) throw new BackendError("invalid_input", "Aturan klasifikasi tidak dikenal.");
    const backend = getBackend();
    await backend.rateLimit("riset_export");
    const r = await backend.reclassify(parsed.data.aturan, parsed.data.kelas);
    if (!isForm) return NextResponse.json({ ok: true, ...r }, { headers: NO_STORE });
    const q = new URLSearchParams({ aturan: parsed.data.aturan, reklasifikasi: String(r.responses) });
    if (parsed.data.kelas) q.set("kelas", parsed.data.kelas);
    if (parsed.data.skor) q.set("skor", parsed.data.skor);
    if (parsed.data.transisi) q.set("transisi", parsed.data.transisi);
    // Location relatif: request.url di belakang proksi bisa memakai host lain (melanggar CSP form-action).
    return new Response(null, { status: 303, headers: { ...NO_STORE, Location: `/riset?${q}` } });
  } catch (e) {
    return errorResponse(e);
  }
}
