import { z } from "zod";
import data from "@/content/celestial.json";
import type { PlanetKey } from "@/lib/design/tokens";

/** Skema konten Viewer. Divalidasi saat diimpor (galat = build gagal) dan di unit test. */
const ColorKey = z.enum(["matahari", "merkurius", "venus", "bumi", "mars", "jupiter", "saturnus", "uranus", "neptunus"]);
const Look = z.enum(["sun", "earth", "moon", "dwarf", "comet", "asteroid", "rocky", "venus", "mars", "jupiter", "saturn", "icy", "diorama"]);
export const SceneKind = z.enum(["zones", "meteor", "rotation", "revolution", "eclipse"]);
export const AnimationId = z.enum(["greenhouse", "meteor", "rotation", "revolution", "eclipse-solar", "eclipse-lunar"]);

/**
 * Titik anotasi: di permukaan benda (lat/lon) ATAU pada titik bernama di sebuah adegan
 * (anchor, mis. "bumi" pada adegan zona). Posisi anchor dihitung oleh lib/viewer/dioramas.ts.
 */
const Annotation = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    lat: z.number().min(-90).max(90).optional(),
    lon: z.number().min(-180).max(180).optional(),
    anchor: z.string().regex(/^[a-z0-9-]+$/).optional(),
    title: z.string().min(1).max(40),
    body: z.string().min(1).max(260),
    source: z.string().min(1),
  })
  .refine((a) => (a.anchor !== undefined) !== (a.lat !== undefined && a.lon !== undefined), {
    message: "anotasi butuh lat+lon ATAU anchor",
  });

const CelestialObject = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  kind: z.enum(["bintang", "planet", "satelit_alami", "planet_kerdil", "komet", "asteroid", "kelompok_planet", "batuan_antariksa", "gerak_bumi", "gerhana"]),
  color: ColorKey,
  look: Look,
  radius: z.number().positive().max(2),
  ring: z.boolean().optional(),
  animation: AnimationId.optional(),
  /** Adegan 3D (U3–U6) sebagai pengganti satu benda. */
  scene: SceneKind.optional(),
  variant: z.enum(["solar", "lunar"]).optional(),
  /** Untuk objek yang berbagi satu animasi: langkah (0-based) yang mewakili objek ini. */
  sceneStep: z.number().int().min(0).optional(),
  view: z
    .object({ focus: z.string(), distance: z.number().positive(), elevation: z.number().min(0).max(89), azimuth: z.number().min(-180).max(180).optional() })
    .optional(),
  description: z.string().min(1).max(200),
  facts: z.object({
    diameter_km: z.number().positive().optional(),
    distance_mkm: z.number().positive().optional(),
    mean_temp_c: z.number().optional(),
  }),
  annotations: z.array(Annotation).min(1).max(4),
});

const CelestialContent = z
  .object({
    sources: z.record(z.string(), z.object({ label: z.string().min(1), url: z.url() })),
    units: z.record(z.string(), z.object({ objects: z.array(CelestialObject).min(1) })),
    review_status: z.enum(["needs_review", "reviewed"]),
  })
  .superRefine((c, ctx) => {
    for (const [unit, u] of Object.entries(c.units)) {
      for (const o of u.objects) {
        for (const a of o.annotations) {
          if (!(a.source in c.sources)) ctx.addIssue({ code: "custom", message: `${unit}/${o.id}/${a.id}: sumber '${a.source}' tidak terdaftar` });
        }
        if ((o.look === "diorama") !== (o.scene !== undefined) || (o.scene !== undefined) !== (o.view !== undefined)) {
          ctx.addIssue({ code: "custom", message: `${unit}/${o.id}: look 'diorama' wajib punya scene dan view` });
        }
        for (const a of o.annotations) {
          if ((a.anchor !== undefined) !== (o.scene !== undefined)) ctx.addIssue({ code: "custom", message: `${unit}/${o.id}/${a.id}: adegan memakai anchor, benda memakai lat/lon` });
        }
        if (new Set(o.annotations.map((a) => a.id)).size !== o.annotations.length) {
          ctx.addIssue({ code: "custom", message: `${unit}/${o.id}: id anotasi ganda` });
        }
      }
    }
  });

export type CelestialObject = z.infer<typeof CelestialObject>;
export type SceneKind = z.infer<typeof SceneKind>;
export type AnimationId = z.infer<typeof AnimationId>;
export type Annotation = z.infer<typeof Annotation>;
export const CELESTIAL = CelestialContent.parse(data);

export function unitObjects(unitSlug: string): CelestialObject[] {
  return CELESTIAL.units[unitSlug]?.objects ?? [];
}
export function hasViewer(unitSlug: string) {
  return unitObjects(unitSlug).length > 0;
}
export function sourceOf(id: string) {
  return CELESTIAL.sources[id]!;
}
export const colorVar = (k: PlanetKey) => `var(--planet-${k})`;
