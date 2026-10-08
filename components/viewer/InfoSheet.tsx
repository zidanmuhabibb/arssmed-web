"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { ArrowRight, X } from "lucide-react";
import type { Annotation } from "@/lib/content/celestial";

/**
 * Lembar info anotasi (FR-11): naik dari bawah di HP, panel kanan di desktop (≥ 1024px).
 * Tidak memblokir kanvas: siswa tetap bisa memutar objek sambil membaca.
 */
export function InfoSheet({
  annotation,
  index,
  total,
  color,
  source,
  onClose,
  onNext,
}: {
  annotation: Annotation | null;
  index: number;
  total: number;
  color: string;
  source?: { label: string; url: string };
  onClose: () => void;
  onNext: () => void;
}) {
  const t = useTranslations("viewer");
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (annotation) heading.current?.focus();
  }, [annotation]);

  useEffect(() => {
    if (!annotation) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [annotation, onClose]);

  if (!annotation) return null;
  return (
    <section
      key={annotation.id}
      role="dialog"
      aria-modal="false"
      aria-labelledby="info-judul"
      className="lembar fixed inset-x-0 bottom-[calc(var(--tab-tinggi)+env(safe-area-inset-bottom))] z-40 mx-auto max-w-xl rounded-t-panel border border-garis bg-permukaan px-5 pt-3 pb-5 shadow-[0_-8px_24px_rgb(11_22_38/0.18)] lg:inset-x-auto lg:top-24 lg:right-5 lg:bottom-auto lg:w-[21rem] lg:rounded-panel"
    >
      <div aria-hidden="true" className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-garis lg:hidden" />
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="mt-1.5 h-6 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
        <div className="min-w-0 flex-1">
          <p className="text-[0.8rem] font-semibold text-tinta-2 tabular-nums">
            {index + 1}/{total}
          </p>
          <h2 id="info-judul" ref={heading} tabIndex={-1} className="text-[1.35rem] font-bold outline-none">
            {annotation.title}
          </h2>
        </div>
        <button type="button" onClick={onClose} aria-label={t("sheet.close")} className="tekan -mt-1 -mr-2 flex size-12 items-center justify-center rounded-full text-tinta-2 active:bg-kertas">
          <X aria-hidden="true" className="size-6" />
        </button>
      </div>
      <p className="mt-2 max-w-[60ch]">{annotation.body}</p>
      {source ? (
        <p className="mt-3 text-[0.8rem] text-tinta-2">
          {t("sheet.source")}:{" "}
          <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-laut-teks underline">
            {source.label}
          </a>
        </p>
      ) : null}
      {total > 1 ? (
        <button type="button" onClick={onNext} className="tekan mt-4 inline-flex min-h-12 items-center gap-2 rounded-full px-1 font-semibold text-laut-teks">
          {t("sheet.next")}
          <ArrowRight aria-hidden="true" className="size-5" />
        </button>
      ) : null}
    </section>
  );
}
