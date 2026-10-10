"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { learning, useLearning } from "@/lib/learning/client";
import { predictionsComplete } from "@/lib/learning/flow";
import { stepHref } from "./StepGate";

type Q = { key: string; stem: string; options: { key: "A" | "B" | "C"; text: string }[] };

/** FR-21: pertanyaan prediksi. Tanpa skor, tanpa "benar/salah"; jawaban pertama disimpan. */
export function TebakForm({ unit, questions }: { unit: string; questions: Q[] }) {
  const t = useTranslations("belajar");
  const router = useRouter();
  const l = useLearning();
  const [draft, setDraft] = useState<Record<string, "A" | "B" | "C">>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saved = l.state.predictions;
  const keys = questions.map((q) => q.key);
  const allSaved = predictionsComplete(saved, keys);
  const tebakDone = (l.state.steps[unit] ?? []).includes("tebak");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const missing = questions.filter((q) => !saved[q.key] && !draft[q.key]);
    if (missing.length) {
      setError(t("tebak.chooseAll"));
      document.getElementById(`q-${missing[0]!.key}`)?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    for (const q of questions) if (!saved[q.key]) await learning.answer(q.key, draft[q.key]!);
    const err = tebakDone ? null : await learning.complete(unit, "tebak");
    setBusy(false);
    if (err) setError(t("saveError"));
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      {questions.map((q, i) => {
        const locked = saved[q.key];
        const value = locked ?? draft[q.key];
        return (
          <fieldset key={q.key} className="rounded-panel border border-garis bg-permukaan p-5" aria-describedby={locked ? `kunci-${q.key}` : undefined}>
            <legend id={`q-${q.key}`} tabIndex={-1} className="float-left mb-3 w-full outline-none">
              <span className="block text-[0.85rem] font-semibold text-tinta-2">{t("tebak.question", { number: i + 1, total: questions.length })}</span>
              <span className="mt-1 block text-[1.15rem] font-semibold">{q.stem}</span>
            </legend>
            <div className="clear-both flex flex-col gap-2">
              {q.options.map((o) => (
                <label
                  key={o.key}
                  className={`tekan flex min-h-14 cursor-pointer items-center gap-3 rounded-kontrol border-2 px-4 py-3 has-[:checked]:border-laut has-[:checked]:bg-kertas has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-laut ${
                    locked ? "cursor-default border-garis" : "border-garis active:bg-kertas"
                  }`}
                >
                  <input
                    type="radio"
                    name={q.key}
                    value={o.key}
                    checked={value === o.key}
                    disabled={!!locked && locked !== o.key}
                    readOnly={!!locked}
                    onChange={() => !locked && setDraft((d) => ({ ...d, [q.key]: o.key }))}
                    className="size-5 shrink-0 accent-[var(--laut)]"
                  />
                  <span>{o.text}</span>
                </label>
              ))}
            </div>
            {locked ? (
              <p id={`kunci-${q.key}`} className="mt-3 flex items-center gap-2 text-[0.9rem] font-semibold text-sc">
                <Check aria-hidden="true" className="size-4" strokeWidth={3} />
                {t("tebak.saved")}
              </p>
            ) : null}
          </fieldset>
        );
      })}

      {allSaved ? <p className="text-[0.9rem] text-tinta-2">{t("tebak.alreadySaved")}</p> : null}
      {error ? (
        <p role="alert" className="font-semibold text-m-teks">
          {error}
        </p>
      ) : null}

      {allSaved && tebakDone ? (
        <Button onClick={() => router.push(stepHref(unit, "amati"))} icon={<ArrowRight aria-hidden="true" className="size-5" />}>
          {t("tebak.next")}
        </Button>
      ) : (
        <Button type="submit" disabled={busy} aria-busy={busy}>
          {t("tebak.save")}
        </Button>
      )}
    </form>
  );
}
