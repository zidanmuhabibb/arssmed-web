"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Orbit } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/Button";
import { learning, useLearning } from "@/lib/learning/client";
import { compareTone } from "@/lib/learning/flow";
import { stepHref } from "./StepGate";

type Item = { key: string; stem: string; options: { key: string; text: string }[]; correct: string; reveal: string; observe: string };

/** FR-23: tebakan di samping yang diamati, dengan bahasa netral (tanpa "salah"). */
export function CompareList({ unit, items }: { unit: string; items: Item[] }) {
  const t = useTranslations("belajar");
  const router = useRouter();
  const l = useLearning();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = (l.state.steps[unit] ?? []).includes("bandingkan");

  async function next() {
    setBusy(true);
    setError(null);
    const err = done ? null : await learning.complete(unit, "bandingkan");
    setBusy(false);
    if (err) setError(t("saveError"));
    else router.push(stepHref(unit, "jelaskan"));
  }

  return (
    <div className="flex flex-col gap-5">
      {items.map((it) => {
        const mine = l.state.predictions[it.key];
        const tone = compareTone(mine, it.correct);
        const mineText = it.options.find((o) => o.key === mine)?.text;
        const sciText = it.options.find((o) => o.key === it.correct)?.text;
        return (
          <article key={it.key} className="rounded-panel border border-garis bg-permukaan p-5" data-testid={`compare-${it.key}`}>
            <h2 className="text-[1.15rem] font-semibold">{it.stem}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-kontrol border-2 border-garis p-4">
                <p className="text-[0.85rem] font-semibold text-tinta-2">{t("bandingkan.yours")}</p>
                <p className="mt-1 font-semibold">{mineText ?? t("bandingkan.missing")}</p>
              </div>
              <div className="rounded-kontrol border-2 border-laut p-4">
                <p className="text-[0.85rem] font-semibold text-tinta-2">{t("bandingkan.seen")}</p>
                <p className="mt-1 font-semibold">{sciText}</p>
              </div>
            </div>
            <p className="mt-4 font-semibold" data-testid="compare-tone">
              {t(`bandingkan.${tone}`)}
            </p>
            <p className="mt-1 max-w-[60ch]">{it.reveal}</p>
            <p className="mt-2 text-[0.9rem] text-tinta-2">{it.observe}</p>
          </article>
        );
      })}
      {error ? (
        <p role="alert" className="font-semibold text-m">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={next} disabled={busy} aria-busy={busy} icon={<ArrowRight aria-hidden="true" className="size-5" />}>
          {t("bandingkan.next")}
        </Button>
        <LinkButton href={stepHref(unit, "amati")} variant="kedua" icon={<Orbit aria-hidden="true" className="size-5" />}>
          {t("bandingkan.lookAgain")}
        </LinkButton>
      </div>
    </div>
  );
}
