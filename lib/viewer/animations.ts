/**
 * Spesifikasi animasi berlangkah (FR-13). Teks tiap langkah ada di messages/id.json →
 * viewer.anim.<id>.s1…sN; label sakelar di viewer.anim.toggles.<key>.
 */
import type { AnimationId } from "@/lib/content/celestial";
import type { Timeline } from "./timeline";

export interface AnimationSpec extends Timeline {
  id: AnimationId;
  /** Sakelar visual dan nilai awalnya. */
  toggles: Record<string, boolean>;
  /** Posisi awal bila objek tidak mewakili langkah tertentu. */
  start?: number;
}

export const ANIMATIONS: Record<AnimationId, AnimationSpec> = {
  greenhouse: { id: "greenhouse", steps: 3, stepSeconds: 4, toggles: { atmosphere: true } },
  meteor: { id: "meteor", steps: 3, stepSeconds: 3.5, toggles: { atmosphere: true } },
  rotation: { id: "rotation", steps: 4, stepSeconds: 3, toggles: { tilt: true, axis: true }, start: 0.5 },
  revolution: { id: "revolution", steps: 4, stepSeconds: 3, toggles: { tilt: true, orbit: true }, start: 0.5 },
  "eclipse-solar": { id: "eclipse-solar", steps: 3, stepSeconds: 3, toggles: { shadow: true, orbit: true } },
  "eclipse-lunar": { id: "eclipse-lunar", steps: 3, stepSeconds: 3, toggles: { shadow: true, orbit: true } },
};

/** Posisi awal: tengah langkah yang diwakili objek (bila ada), selain itu awal. */
export function initialPosition(spec: AnimationSpec, sceneStep?: number) {
  if (sceneStep === undefined) return spec.start ?? 0;
  return Math.min(sceneStep, spec.steps - 1) + 0.5;
}
