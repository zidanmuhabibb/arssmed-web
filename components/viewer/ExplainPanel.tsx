"use client";

import { useTranslations } from "next-intl";
import type { CelestialObject } from "@/lib/content/celestial";

/** Alternatif non-visual untuk 3D (PRD §8.7): semua isi anotasi sebagai teks. */
export function ExplainPanel({ object, sources }: { object: CelestialObject; sources: Record<string, { label: string; url: string }> }) {
  const t = useTranslations("viewer");
  const used = [...new Set(object.annotations.map((a) => a.source))];
  return (
    <section id="penjelasan" aria-labelledby="penjelasan-judul" className="rounded-panel border border-garis bg-permukaan p-5">
      <p className="text-[0.85rem] font-semibold text-tinta-2">{t(`kinds.${object.kind}`)}</p>
      <h2 id="penjelasan-judul" className="text-[1.3rem] font-bold">
        {t("explain.title", { name: object.name })}
      </h2>
      <p className="mt-2">{object.description}</p>
      <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5">
        {object.annotations.map((a) => (
          <li key={a.id}>
            <span className="font-semibold">{a.title}.</span> {a.body}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[0.8rem] text-tinta-2">
        {t("sheet.source")}:{" "}
        {used.map((s, i) => (
          <span key={s}>
            {i > 0 ? "; " : ""}
            <a href={sources[s]!.url} target="_blank" rel="noopener noreferrer" className="text-laut-teks underline">
              {sources[s]!.label}
            </a>
          </span>
        ))}
      </p>
    </section>
  );
}
