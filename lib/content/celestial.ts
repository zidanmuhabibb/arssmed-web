import { z } from "zod";
import data from "@/content/celestial.json";
import type { PlanetKey } from "@/lib/design/tokens";

/** Skema konten Viewer. Divalidasi saat diimpor (galat = build gagal) dan di unit test. */
const ColorKey = z.enum(["matahari", "merkurius", "venus", "bumi", "mars", "jupiter", "saturnus", "uranus", "neptunus"]);
const Look = z.enum(["sun", "earth", "moon", "dwarf", "comet", "asteroid", "rocky", "venus", "mars", "jupiter", "saturn", "icy"]);

const Annotation = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  title: z.string().min(1).max(40),
  body: z.string().min(1).max(260),
  source: z.string().min(1),
});

const CelestialObject = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  kind: z.enum(["bintang", "planet", "satelit_alami", "planet_kerdil", "komet", "asteroid"]),
  color: ColorKey,
  look: Look,
  radius: z.number().positive().max(2),
  ring: z.boolean().optional(),
  animation: z.enum(["greenhouse"]).optional(),
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
        if (new Set(o.annotations.map((a) => a.id)).size !== o.annotations.length) {
          ctx.addIssue({ code: "custom", message: `${unit}/${o.id}: id anotasi ganda` });
        }
      }
    }
  });

export type CelestialObject = z.infer<typeof CelestialObject>;
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
