/** Titik masuk skrip `pnpm assets:build`: semua model AR unik dari konten Viewer. */
import { CELESTIAL } from "@/lib/content/celestial";
import { buildModel } from "./build";
import { arModelSpec } from "./spec";

export function allSpecs() {
  const seen = new Map<string, ReturnType<typeof arModelSpec>>();
  for (const u of Object.values(CELESTIAL.units)) for (const o of u.objects) {
    const s = arModelSpec(o);
    if (!seen.has(s.id)) seen.set(s.id, s);
  }
  return [...seen.values()];
}

export { buildModel };
