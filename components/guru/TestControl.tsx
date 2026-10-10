"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { Lock, LockOpen } from "lucide-react";
import { setClassTestAction } from "@/app/guru/kelas/actions";
import { Dialog } from "@/components/ui/Dialog";
import type { ClassTestOverview, Phase } from "@/lib/tes/types";

const POLL_MS = 10_000;

/** FR-41: buka/tutup tes awal & akhir per kelas, lihat siapa sudah/belum selesai (diperbarui berkala). */
export function TestControl({ classId, mode, initial }: { classId: string; mode: "research" | "learn_only"; initial: ClassTestOverview[] }) {
  const t = useTranslations("guru.tests");
  const [phases, setPhases] = useState(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ phase: Phase; open: boolean } | null>(null);

  useEffect(() => {
    if (!phases.some((p) => p.status === "open")) return;
    const id = setInterval(async () => {
      try {
        const r = await fetch(`/api/guru/kelas/${classId}/tes`, { cache: "no-store" });
        if (r.ok) setPhases(((await r.json()) as { phases: ClassTestOverview[] }).phases);
      } catch {
        // tetap tampilkan data terakhir
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [classId, phases]);

  function act(phase: Phase, open: boolean) {
    setError(null);
    start(async () => {
      const r = await setClassTestAction(classId, phase, open);
      if (!r.ok) {
        setError(r.error === "learn_only" ? t("errors.learn_only") : r.error === "no_test" ? t("errors.no_test") : t("errors.unknown"));
        return;
      }
      try {
        const res = await fetch(`/api/guru/kelas/${classId}/tes`, { cache: "no-store" });
        if (res.ok) setPhases(((await res.json()) as { phases: ClassTestOverview[] }).phases);
      } catch {
        // abaikan
      }
    });
  }

  if (mode !== "research") {
    return (
      <section aria-labelledby="tes-kelas" className="mb-8 rounded-panel border border-garis bg-permukaan p-5">
        <h2 id="tes-kelas" className="text-[1.2rem] font-bold">
          {t("title")}
        </h2>
        <p className="mt-1 max-w-[60ch] text-[0.95rem] text-tinta-2">{t("learnOnly")}</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="tes-kelas" className="mb-8 flex flex-col gap-3" data-testid="test-control">
      <h2 id="tes-kelas" className="text-[1.5rem] font-bold">
        {t("title")}
      </h2>
      {error ? (
        <p role="alert" className="font-semibold text-m-teks">
          {error}
        </p>
      ) : null}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
        {phases.map((p) => {
          const eligible = p.students.filter((s) => s.consent === "granted");
          const done = eligible.filter((s) => s.submitted).length;
          return (
            <article key={p.phase} className="flex min-w-0 flex-col gap-3 rounded-panel border border-garis bg-permukaan p-5" data-testid={`control-${p.phase}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-[1.2rem] font-bold">{t(`phase.${p.phase}`)}</h3>
                  <p className="text-[0.9rem] text-tinta-2" data-testid={`status-${p.phase}`}>
                    {t(`status.${p.status}`)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirm({ phase: p.phase, open: p.status !== "open" })}
                  className={`tekan inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full px-5 font-semibold disabled:opacity-60 ${
                    p.status === "open" ? "border-2 border-garis bg-permukaan text-tinta" : "bg-matahari text-matahari-tinta"
                  }`}
                >
                  {p.status === "open" ? <Lock aria-hidden="true" className="size-5" /> : <LockOpen aria-hidden="true" className="size-5" />}
                  {p.status === "open" ? t("close") : p.status === "closed" ? t("reopen") : t("open")}
                </button>
              </div>
              <p className="font-semibold tabular-nums" aria-live="polite" data-testid={`done-${p.phase}`}>
                {t("doneCount", { done, total: eligible.length })}
              </p>
              {p.students.length ? (
                <ul className="divide-y divide-garis rounded-kontrol border border-garis">
                  {p.students.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2 text-[0.95rem]" data-testid={`row-${p.phase}-${s.code}`}>
                      <span className="min-w-0 truncate">
                        <span className="font-mono font-semibold">{s.code}</span>
                        {s.nickname ? <span className="text-tinta-2"> · {s.nickname}</span> : null}
                      </span>
                      <span className="shrink-0 text-tinta-2 tabular-nums">
                        {s.consent !== "granted"
                          ? t("row.noConsent")
                          : s.submitted
                            ? t("row.submitted")
                            : s.started
                              ? t("row.working", { n: s.answered, total: p.total })
                              : t("row.notStarted")}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          );
        })}
      </div>
      <p className="max-w-[60ch] text-[0.9rem] text-tinta-2">{t("note")}</p>

      <Dialog open={confirm !== null} onClose={() => setConfirm(null)} title={confirm ? t(confirm.open ? "confirmOpen" : "confirmClose", { phase: t(`phase.${confirm.phase}`) }) : ""} labelledBy="konfirmasi-tes">
        <p className="text-tinta-2">{confirm?.open ? t("confirmOpenBody") : t("confirmCloseBody")}</p>
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            className="tekan inline-flex min-h-12 items-center justify-center rounded-full bg-matahari px-5 font-semibold text-matahari-tinta"
            onClick={() => {
              if (confirm) act(confirm.phase, confirm.open);
              setConfirm(null);
            }}
          >
            {confirm?.open ? t("open") : t("close")}
          </button>
          <button type="button" className="tekan inline-flex min-h-12 items-center justify-center rounded-full border-2 border-garis px-5 font-semibold" onClick={() => setConfirm(null)}>
            {t("cancel")}
          </button>
        </div>
      </Dialog>
    </section>
  );
}
