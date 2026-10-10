"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { deviceKind } from "@/lib/ar/capabilities";
import { BackendError, getBackend, getViewer } from "@/lib/backend";
import { STEPS } from "@/lib/learning/flow";

/**
 * Aksi alur belajar (FR-21…24). Untuk pengunjung yang belum masuk, kemajuan hanya disimpan
 * di perangkat (`local: true`); untuk siswa, DB menegakkan urutan dan tebakan pertama.
 */
export type LearningResult = { ok: true; local?: true; selected?: string } | { ok: false; error: string; message?: string };

const Slug = z.string().regex(/^u[0-9]{1,2}$/);
const Id = z.string().regex(/^[a-z0-9-]{1,60}$/);
const Op = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("prediction"), key: Id, option: z.enum(["A", "B", "C"]) }),
  z.object({ kind: z.literal("view"), unit: Slug, object: Id, mode: z.enum(["3d", "ar_surface", "ar_marker"]).optional() }),
  z.object({ kind: z.literal("step"), unit: Slug, step: z.enum(STEPS) }),
  z.object({ kind: z.literal("discussed"), unit: Slug }),
]);
export type LearningOp = z.infer<typeof Op>;

export async function learningAction(input: LearningOp): Promise<LearningResult> {
  const parsed = Op.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const viewer = await getViewer();
  if (viewer.kind !== "student") return { ok: true, local: true };
  const b = getBackend();
  const op = parsed.data;
  try {
    switch (op.kind) {
      case "prediction":
        return { ok: true, selected: await b.savePrediction(op.key, op.option) };
      case "view": {
        // Jenis perangkat diturunkan di server dari User-Agent; hanya kategorinya yang disimpan (FR-17).
        const h = await headers();
        const device = deviceKind({ userAgent: h.get("user-agent") ?? "", uaDataPlatform: h.get("sec-ch-ua-platform")?.replace(/"/g, ""), uaDataMobile: h.get("sec-ch-ua-mobile") === "?1" });
        await b.recordObjectView(op.unit, op.object, op.mode ?? "3d", device);
        return { ok: true };
      }
      case "step":
        await b.completeStep(op.unit, op.step);
        return { ok: true };
      case "discussed":
        await b.markDiscussed(op.unit);
        return { ok: true };
    }
  } catch (e) {
    if (e instanceof BackendError) return { ok: false, error: e.code, message: e.message };
    console.error("[belajar] galat tak terduga", e instanceof Error ? e.message : e);
    return { ok: false, error: "unknown" };
  }
}
