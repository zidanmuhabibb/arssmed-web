"use client";

import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import type { CelestialObject } from "@/lib/content/celestial";
import { planet as planetColors, type PlanetKey } from "@/lib/design/tokens";

/**
 * Rel Orbit (FR-12): satu elemen yang diingat. Navigasi antarobjek sekaligus penanda kemajuan.
 * Ukuran titik sengaja tidak proporsional; label skala ditampilkan jelas (PRD §13).
 */
export function RelOrbit({
  objects,
  currentId,
  viewed,
  progress,
  onSelect,
}: {
  objects: CelestialObject[];
  currentId: string;
  viewed: string[];
  progress: { seen: number; total: number; complete: boolean };
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("viewer");
  const maxR = Math.max(...objects.map((o) => o.radius));
  return (
    <nav aria-label={t("rail")} className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-isi text-[0.95rem] font-semibold">{t("rail")}</h2>
        <p className="text-[0.85rem] text-tinta-2 tabular-nums" aria-live="polite">
          {progress.complete ? t("railComplete") : t("railProgress", { seen: progress.seen, total: progress.total })}
        </p>
      </div>
      <div className="relative">
        {/* garis orbit */}
        <div aria-hidden="true" className="absolute top-[30px] right-3 left-3 border-t-2 border-dashed border-garis" />
        <ul className="relative flex snap-x gap-1 overflow-x-auto pb-1 [scrollbar-width:thin] lg:flex-wrap lg:overflow-visible">
          {objects.map((o) => {
            const active = o.id === currentId;
            const seen = viewed.includes(o.id);
            const size = 14 + (o.radius / maxR) * 26;
            return (
              <li key={o.id} className="snap-start">
                <button
                  type="button"
                  onClick={() => onSelect(o.id)}
                  aria-current={active ? "true" : undefined}
                  className={`tekan flex min-h-[84px] w-[88px] flex-col items-center gap-1 rounded-kontrol px-1 pt-1 text-[0.8rem] font-semibold ${
                    active ? "bg-permukaan text-tinta ring-2 ring-laut" : "text-tinta-2 active:bg-permukaan"
                  }`}
                >
                  <span className="relative flex h-[44px] items-center justify-center">
                    <span
                      aria-hidden="true"
                      className="rounded-full"
                      style={{
                        width: size,
                        height: size,
                        background: `radial-gradient(circle at 35% 35%, rgba(255,255,255,.35), transparent 55%), ${planetColors[o.color as PlanetKey]}`,
                        boxShadow: "inset -3px -3px 6px rgba(0,0,0,.35)",
                      }}
                    />
                    {seen ? (
                      <span className="absolute -right-2 -bottom-1 flex size-5 items-center justify-center rounded-full bg-sc text-white">
                        <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
                        <span className="sr-only">{t("viewed")}</span>
                      </span>
                    ) : null}
                  </span>
                  <span className="max-w-full truncate">{o.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="text-[0.8rem] text-tinta-2">{t("scaleNote")}</p>
    </nav>
  );
}
