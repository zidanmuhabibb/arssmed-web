"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Check, ChevronRight, Lock } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import { useLearning } from "@/lib/learning/client";
import { nextStep, STEPS, stepStatus, unitStatus } from "@/lib/learning/flow";
import { stepHref } from "./StepGate";

/** FR-20: urutan langkah dan status penyelesaian di halaman unit. */
export function UnitSteps({ unit }: { unit: string }) {
  const t = useTranslations("belajar");
  const l = useLearning();
  const done = l.state.steps[unit] ?? [];
  const next = nextStep(done);
  const status = unitStatus(done);
  return (
    <section aria-labelledby="langkah-judul" className="flex flex-col gap-4">
      <h2 id="langkah-judul" className="text-[1.4rem] font-bold">
        {t("stepsTitle")}
      </h2>
      <ol className="divide-y divide-garis overflow-hidden rounded-panel border border-garis bg-permukaan" data-testid="unit-steps">
        {STEPS.map((s, i) => {
          const st = l.ready ? stepStatus(done, s) : null;
          const inner = (
            <>
              <span
                aria-hidden="true"
                className={`flex size-10 shrink-0 items-center justify-center rounded-full font-judul text-[1.1rem] font-extrabold tabular-nums ${
                  st === "done" ? "bg-sc text-white" : st === "current" ? "bg-matahari text-matahari-tinta" : "bg-kertas text-tinta-2"
                }`}
              >
                {st === "done" ? <Check className="size-5" strokeWidth={3} /> : st === "locked" ? <Lock className="size-4" /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{t(`steps.${s}.title`)}</span>
                <span className="block text-[0.9rem] text-tinta-2">{t(`steps.${s}.hint`)}</span>
                {st ? <span className="mt-0.5 block text-[0.8rem] font-semibold text-tinta-2" data-testid={`status-${s}`}>{t(`stepStatus.${st}`)}</span> : null}
              </span>
              {st !== "locked" ? <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-tinta-2" /> : null}
            </>
          );
          return (
            <li key={s}>
              {st === "locked" ? (
                <div className="flex min-h-16 items-center gap-4 px-4 py-3 opacity-70" aria-disabled="true">
                  {inner}
                </div>
              ) : (
                <Link href={stepHref(unit, s)} className="tekan flex min-h-16 items-center gap-4 px-4 py-3 text-tinta no-underline active:bg-kertas">
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
      {l.ready ? (
        status === "done" ? (
          <p className="font-semibold text-tinta" role="status">
            {t("unitDone")}
          </p>
        ) : next ? (
          <LinkButton href={stepHref(unit, next)}>{t(status === "notStarted" ? "start" : "continue", { step: t(`steps.${next}.title`) })}</LinkButton>
        ) : null
      ) : (
        <LinkButton href={stepHref(unit, "tebak")}>{t("start", { step: t("steps.tebak.title") })}</LinkButton>
      )}
      {l.ready && !l.isStudent ? (
        <p className="text-[0.9rem] text-tinta-2">
          {t("guestNote")}{" "}
          <Link href="/masuk" className="font-semibold text-laut-teks underline">
            {t("signIn")}
          </Link>
        </p>
      ) : null}
    </section>
  );
}

/** Status ringkas di daftar unit. */
export function UnitStatusBadge({ unit }: { unit: string }) {
  const t = useTranslations("belajar");
  const l = useLearning();
  if (!l.ready) return null;
  const s = unitStatus(l.state.steps[unit] ?? []);
  if (s === "notStarted") return null;
  return (
    <span className={`mt-1 inline-flex items-center gap-1 text-[0.8rem] font-semibold ${s === "done" ? "text-sc" : "text-tinta-2"}`} data-testid={`unit-status-${unit}`}>
      {s === "done" ? <Check aria-hidden="true" className="size-4" strokeWidth={3} /> : null}
      {t(`status.${s}`)}
    </span>
  );
}
