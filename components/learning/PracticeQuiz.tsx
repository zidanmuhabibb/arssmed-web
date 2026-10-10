"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { CircleCheck, Lightbulb, RotateCcw } from "lucide-react";

type Q = { key: string; stem: string; options: { key: string; text: string }[]; correct: string; feedback: string };

/**
 * FR-26: kuis latihan dengan umpan balik langsung. Tidak disimpan ke server dan tidak masuk
 * analisis penelitian. Bahasa netral: "Tepat" / "Belum tepat" (PRD §8.6).
 */
export function PracticeQuiz({ questions }: { questions: Q[] }) {
  const t = useTranslations("belajar.quiz");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const answered = questions.filter((q) => answers[q.key]);
  const hits = answered.filter((q) => answers[q.key] === q.correct).length;
  const done = answered.length === questions.length;

  return (
    <div className="flex flex-col gap-5">
      {questions.map((q, i) => {
        const a = answers[q.key];
        const ok = a === q.correct;
        return (
          <fieldset key={q.key} className="rounded-panel border border-garis bg-permukaan p-5" data-testid={`quiz-${q.key}`}>
            <legend className="float-left mb-3 w-full">
              <span className="block text-[0.85rem] font-semibold text-tinta-2">{t("question", { number: i + 1, total: questions.length })}</span>
              <span className="mt-1 block text-[1.15rem] font-semibold">{q.stem}</span>
            </legend>
            <div className="clear-both flex flex-col gap-2">
              {q.options.map((o) => (
                <label
                  key={o.key}
                  className="tekan flex min-h-14 cursor-pointer items-center gap-3 rounded-kontrol border-2 border-garis px-4 py-3 active:bg-kertas has-[:checked]:border-laut has-[:checked]:bg-kertas has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-laut"
                >
                  <input
                    type="radio"
                    name={q.key}
                    value={o.key}
                    checked={a === o.key}
                    onChange={() => setAnswers((s) => ({ ...s, [q.key]: o.key }))}
                    className="size-5 shrink-0 accent-[var(--laut)]"
                  />
                  <span>{o.text}</span>
                </label>
              ))}
            </div>
            <div aria-live="polite" className="mt-3">
              {a ? (
                <div className="flex gap-3 rounded-kontrol bg-kertas p-3" data-testid={`feedback-${q.key}`} data-result={ok ? "tepat" : "belum"}>
                  {ok ? <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-sc" /> : <Lightbulb aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-e" />}
                  <p>
                    <strong>{ok ? t("right") : t("notYet")}</strong> {q.feedback}
                  </p>
                </div>
              ) : null}
            </div>
          </fieldset>
        );
      })}
      <div className="flex flex-col gap-3 rounded-panel border border-garis bg-permukaan p-5" aria-live="polite" data-testid="quiz-summary">
        <p className="font-semibold">{done ? t("summary", { hits, total: questions.length }) : t("progress", { answered: answered.length, total: questions.length })}</p>
        <p className="text-tinta-2">{t("note")}</p>
        {answered.length > 0 ? (
          <button
            type="button"
            onClick={() => setAnswers({})}
            className="tekan inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-garis bg-permukaan px-5 font-semibold text-tinta active:bg-kertas sm:w-auto sm:self-start"
          >
            <RotateCcw aria-hidden="true" className="size-5" />
            {t("again")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
