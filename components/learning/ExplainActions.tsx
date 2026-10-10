"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { MessagesSquare, PartyPopper } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/Button";
import { learning, useLearning } from "@/lib/learning/client";

/** FR-24: "Sudah kudiskusikan" — penanda diskusi, bukan penilaian. */
export function ExplainActions({ unit, number, nextUnit }: { unit: string; number: number; nextUnit: { slug: string; number: number } | null }) {
  const t = useTranslations("belajar");
  const l = useLearning();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const discussed = l.state.discussed.includes(unit) && (l.state.steps[unit] ?? []).includes("jelaskan");

  async function mark() {
    setBusy(true);
    setError(null);
    const err = await learning.discussed(unit);
    setBusy(false);
    if (err) setError(t("saveError"));
  }

  if (discussed) {
    return (
      <section className="flex flex-col items-start gap-4 rounded-panel border-2 border-sc bg-permukaan p-6" aria-labelledby="selesai-judul" data-testid="unit-complete">
        <span className="flex size-14 items-center justify-center rounded-full bg-kertas" aria-hidden="true">
          <PartyPopper className="size-7" />
        </span>
        <div>
          <h2 id="selesai-judul" className="text-[1.5rem] font-bold" tabIndex={-1}>
            {t("jelaskan.doneTitle", { number })}
          </h2>
          <p className="mt-1 text-tinta-2">{t("jelaskan.doneBody")}</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {nextUnit ? <LinkButton href={`/belajar/${nextUnit.slug}`}>{t("jelaskan.nextUnit", { number: nextUnit.number })}</LinkButton> : null}
          <LinkButton href="/belajar" variant={nextUnit ? "kedua" : "utama"}>
            {t("jelaskan.backToUnits")}
          </LinkButton>
        </div>
      </section>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {error ? (
        <p role="alert" className="font-semibold text-m-teks">
          {error}
        </p>
      ) : null}
      <Button onClick={mark} disabled={busy} aria-busy={busy} icon={<MessagesSquare aria-hidden="true" className="size-5" />}>
        {t("jelaskan.discussed")}
      </Button>
    </div>
  );
}
