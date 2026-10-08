"use client";

import { useTranslations } from "next-intl";
import type { CelestialObject } from "@/lib/content/celestial";
import { planet as planetColors, type PlanetKey } from "@/lib/design/tokens";

/** Cadangan bila WebGL tidak tersedia (PRD §9.2.6): gambar statis + deskripsi. */
export function StaticBody({ object }: { object: CelestialObject }) {
  const t = useTranslations("viewer");
  const c = planetColors[object.color as PlanetKey];
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center text-panggung-tinta" role="status">
      <span
        aria-hidden="true"
        className="size-36 rounded-full"
        style={{ background: `radial-gradient(circle at 35% 35%, rgba(255,255,255,.4), transparent 50%), ${c}`, boxShadow: "inset -12px -12px 24px rgba(0,0,0,.45)" }}
      />
      <div>
        <p className="font-semibold">{t("fallback.title")}</p>
        <p className="text-[0.9rem] text-panggung-tinta-2">{t("fallback.body")}</p>
        <p className="mt-2 max-w-[40ch]">{object.description}</p>
      </div>
    </div>
  );
}
