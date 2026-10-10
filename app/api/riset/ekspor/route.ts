import { connection, NextResponse } from "next/server";
import { z } from "zod";
import { allTables, responsesLong, scoresWide, toCsv, type Table } from "@/lib/analysis";
import { APP_VERSION, loadAnalysis } from "@/lib/analysis/server";
import { buildXlsx } from "@/lib/analysis/xlsx";
import { buildClassSummaryPdf } from "@/lib/analysis/pdf";
import { getTranslations } from "next-intl/server";
import { errorResponse, NO_STORE } from "@/lib/tes/http";

const Query = z.object({
  format: z.enum(["csv", "xlsx", "json", "pdf"]).default("csv"),
  tabel: z.enum(["responses_long", "scores_wide"]).default("responses_long"),
});

/**
 * GET /api/riset/ekspor?format=csv|xlsx|json&tabel=&kelas=&skor=&transisi= (PRD §7.4, FR-53).
 * Guru: kelasnya sendiri (kelas wajib). Admin: kelas mana pun atau semua. Tercatat di audit (FR-55).
 * Isi: hanya student_pseudo_id; hanya persetujuan `granted` (FR-61).
 */
export async function GET(request: Request) {
  await connection();
  try {
    const url = new URL(request.url);
    const q = Query.safeParse(Object.fromEntries(url.searchParams));
    if (!q.success) return NextResponse.json({ error: "invalid_input", message: "Format ekspor tidak dikenal." }, { status: 400, headers: NO_STORE });
    const { backend, classId, ds, analysis } = await loadAnalysis(url, "riset_export");
    const exportedAt = new Date().toISOString();
    const scope = classId ?? "semua";
    const meta = { appVersion: APP_VERSION, exportedAt, scope };
    const base = `arssmed_${scope.replace(/[^\w-]/g, "")}_${exportedAt.slice(0, 10)}`;
    const { format, tabel } = q.data;
    await backend.logExport(classId, format === "csv" ? `csv:${tabel}` : format);

    const headers = (type: string, name: string) => ({ ...NO_STORE, "Content-Type": type, "Content-Disposition": `attachment; filename="${name}"`, "X-Content-Type-Options": "nosniff" });
    if (format === "csv") {
      const t: Table = tabel === "responses_long" ? responsesLong(ds) : scoresWide(ds, analysis.options);
      return new Response(toCsv(t), { headers: headers("text/csv; charset=utf-8", `${base}_${tabel}.csv`) });
    }
    if (format === "pdf") {
      const t = await getTranslations("hasil.pdf");
      const tr = (key: string, values?: Record<string, string | number>) => t(key as "title", values as never);
      const title = t("title", { scope: classId ? (ds.classes[0]?.name ?? classId) : t("allClasses") });
      const pdf = await buildClassSummaryPdf(ds, analysis, { ...meta, title }, tr);
      return new Response(new Uint8Array(pdf), { headers: headers("application/pdf", `${base}_ringkasan.pdf`) });
    }
    const tables = allTables(ds, analysis, meta);
    if (format === "xlsx") {
      return new Response(new Uint8Array(buildXlsx(tables)), { headers: headers("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", `${base}.xlsx`) });
    }
    const asObjects = (t: Table) => t.rows.map((r) => Object.fromEntries(t.columns.map((c, i) => [c, r[i]])));
    const body = {
      readme: Object.fromEntries(tables[0]!.rows.map((r) => [r[0], r[1]])),
      items: ds.items.map((i) => ({ item_id: i.code, item_order: i.order, concept_domain: i.conceptDomain, report_domain: i.reportDomain, misconception_code: i.misconceptionCode })),
      ...Object.fromEntries(tables.slice(1).map((t) => [t.name, asObjects(t)])),
    };
    return new Response(JSON.stringify(body, null, 1), { headers: headers("application/json; charset=utf-8", `${base}.json`) });
  } catch (e) {
    return errorResponse(e);
  }
}
