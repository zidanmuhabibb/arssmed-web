"use client";

import { useTranslations } from "next-intl";
import type { CelestialObject } from "@/lib/content/celestial";
import { planet as planetColors, type PlanetKey } from "@/lib/design/tokens";

/**
 * "Bandingkan ukuran sesuai skala" (PRD §13): diameter digambar proporsional,
 * agar ukuran tak-proporsional di Rel Orbit tidak menimbulkan miskonsepsi baru.
 */
export function ScaleCompare({ objects }: { objects: CelestialObject[]; onClose: () => void }) {
  const t = useTranslations("viewer");
  const items = objects.filter((o) => o.facts.diameter_km);
  const max = Math.max(...items.map((o) => o.facts.diameter_km!));
  const earth = items.find((o) => o.id === "bumi")?.facts.diameter_km ?? 12756;
  return (
    <section aria-labelledby="skala-judul" className="flex h-full flex-col gap-3 overflow-auto p-4 text-panggung-tinta">
      <div>
        <h2 id="skala-judul" className="text-[1.2rem] font-bold">
          {t("scale.title")}
        </h2>
        <p className="text-[0.85rem] text-panggung-tinta-2">{t("scale.lead")}</p>
      </div>
      <ul className="flex flex-1 items-end gap-3 overflow-x-auto pb-2">
        {items.map((o) => {
          const d = o.facts.diameter_km!;
          const px = Math.max(2, (d / max) * 168);
          return (
            <li key={o.id} className="flex shrink-0 flex-col items-center gap-1.5">
              <span
                aria-hidden="true"
                className="rounded-full"
                style={{ width: px, height: px, background: planetColors[o.color as PlanetKey] }}
              />
              <span className="text-[0.8rem] font-semibold">{o.name}</span>
              <span className="text-[0.75rem] text-panggung-tinta-2 tabular-nums">
                {t("scale.times", { value: (d / earth).toLocaleString("id-ID", { maximumFractionDigits: d / earth < 1 ? 2 : 1 }) })}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
