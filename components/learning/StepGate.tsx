"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import { useLearning } from "@/lib/learning/client";
import { blockingStep, type Step } from "@/lib/learning/flow";

const HREF: Record<Step, string> = { tebak: "tebak", amati: "viewer", bandingkan: "bandingkan", jelaskan: "jelaskan" };
export const stepHref = (unit: string, step: Step) => `/belajar/${unit}/${HREF[step]}`;

/**
 * Langkah dibuka berurutan (PRD §4.2): tebakan harus ada sebelum siswa melihat jawaban.
 * Sebelum status diketahui, isi tetap dirender (tanpa kedip) — kecuali `hideUntilReady`
 * untuk langkah yang membocorkan jawaban (Bandingkan, Jelaskan).
 */
export function StepGate({ unit, step, children, hideUntilReady = false }: { unit: string; step: Step; children: ReactNode; hideUntilReady?: boolean }) {
  const t = useTranslations("belajar");
  const l = useLearning();
  if (!l.ready) {
    return hideUntilReady ? (
      <p role="status" className="text-tinta-2">
        {t("loading")}
      </p>
    ) : (
      <>{children}</>
    );
  }
  const block = blockingStep(l.state.steps[unit] ?? [], step);
  if (!block) return <>{children}</>;
  const name = t(`steps.${block}.title`);
  return (
    <div className="flex flex-col items-start gap-4 rounded-panel border border-garis bg-permukaan p-6" data-testid="step-locked">
      <span className="flex size-14 items-center justify-center rounded-full bg-kertas" aria-hidden="true">
        <Lock className="size-7" />
      </span>
      <div>
        <h2 className="text-[1.5rem] font-bold">{t("lockedPage.title")}</h2>
        <p className="mt-1 text-tinta-2">{t("lockedPage.body", { step: name })}</p>
      </div>
      <LinkButton href={stepHref(unit, block)}>{t("lockedPage.go", { step: name })}</LinkButton>
    </div>
  );
}

/** Penanda langkah 1–4 di atas halaman langkah (urutan memang bermakna, PRD §8.3). */
export function StepProgress({ unit, step }: { unit: string; step: Step }) {
  const t = useTranslations("belajar");
  const l = useLearning();
  const done = l.state.steps[unit] ?? [];
  const order: Step[] = ["tebak", "amati", "bandingkan", "jelaskan"];
  return (
    <ol className="mb-4 flex gap-1.5" aria-label={t("stepsTitle")}>
      {order.map((s, i) => (
        <li key={s} className="flex-1">
          <span
            className={`block h-1.5 rounded-full ${s === step ? "bg-matahari" : done.includes(s) ? "bg-sc" : "bg-garis"}`}
            aria-hidden="true"
          />
          <span className={`mt-1 block truncate text-[0.75rem] ${s === step ? "font-semibold text-tinta" : "text-tinta-2"}`}>
            <span className="sr-only">{t("stepNumber", { number: i + 1 })}: </span>
            {t(`steps.${s}.title`)}
            {s === step ? <span className="sr-only"> ({t("stepStatus.current")})</span> : done.includes(s) ? <span className="sr-only"> ({t("stepStatus.done")})</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}
