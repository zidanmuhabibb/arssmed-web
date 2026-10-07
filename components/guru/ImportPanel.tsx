"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState, useTransition, type ChangeEvent } from "react";
import { Download, FileUp } from "lucide-react";
import { importStudentsAction } from "@/app/guru/kelas/actions";
import { Button } from "@/components/ui/Button";
import { FormAlert, inputClass } from "@/components/ui/Field";
import type { CreatedStudent } from "@/lib/backend/types";
import { parseStudentCsv, type ImportIssue, type ImportWarning } from "@/lib/students/csv";
import { downloadEntryCards } from "./cards";
import { useCardLabels } from "./useCardLabels";

export function ImportPanel({ classId, className, joinCode }: { classId: string; className: string; joinCode: string }) {
  const t = useTranslations("guru.import");
  const tc = useTranslations("guru.class");
  const { labels, fileName } = useCardLabels();
  const [text, setText] = useState("");
  const [created, setCreated] = useState<CreatedStudent[] | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const router = useRouter();

  const parsed = useMemo(() => (text.trim() ? parseStudentCsv(text) : null), [text]);
  const issueText = (i: ImportIssue | ImportWarning) => t(`issues.${i.kind}`, i as unknown as Record<string, string>);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setText(await f.text());
    e.target.value = "";
  }

  function submit() {
    if (!parsed || parsed.errors.length > 0) return;
    setServerError(null);
    startTransition(async () => {
      const r = await importStudentsAction(classId, parsed.rows.map(({ code, nickname }) => ({ code, nickname })));
      if (r.ok) {
        setCreated(r.created);
        setText("");
        router.refresh();
      } else {
        const known = ["duplicate_code", "too_many", "forbidden"].includes(r.error);
        // Pesan dari basis data menyebut kode yang bermasalah; tampilkan bila ada.
        setServerError(r.error === "duplicate_code" && r.message ? r.message : t(`serverErrors.${known ? r.error : "unknown"}`));
      }
    });
  }

  if (created) {
    return (
      <section aria-labelledby="hasil-impor" className="flex flex-col gap-4 rounded-panel border-2 border-sc bg-permukaan p-5 sm:p-6">
        <h3 id="hasil-impor" className="text-[1.3rem] font-bold" tabIndex={-1}>
          {t("successTitle", { count: created.length })}
        </h3>
        <p className="font-semibold">{tc("pinOnce")}</p>
        <ul className="grid gap-1 font-mono tabular-nums sm:grid-cols-2">
          {created.map((s) => (
            <li key={s.id}>
              {s.code} · {s.nickname ?? "—"} · PIN {s.pin}
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            icon={<Download aria-hidden="true" className="size-5" />}
            onClick={() =>
              downloadEntryCards({
                className,
                joinCode,
                cards: created.map((s) => ({ studentCode: s.code, nickname: s.nickname, pin: s.pin })),
                labels,
                fileName: fileName(className),
              })
            }
          >
            {tc("downloadCards")}
          </Button>
          <Button variant="kedua" onClick={() => setCreated(null)}>
            {tc("done")}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="impor" className="flex flex-col gap-4 rounded-panel border border-garis bg-permukaan p-5 sm:p-6">
      <div>
        <h3 id="impor" className="text-[1.3rem] font-bold">
          {t("title")}
        </h3>
        <p className="mt-1 max-w-[60ch] text-tinta-2">{t("lead")}</p>
        <p className="mt-1 text-[0.9rem] text-tinta-2">{t("privacy")}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="impor-teks" className="font-semibold">
          {t("paste")}
        </label>
        <textarea
          id="impor-teks"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          spellCheck={false}
          placeholder={t("pastePlaceholder")}
          className={`${inputClass} py-3 font-mono text-[0.95rem]`}
        />
      </div>
      <label className="inline-flex min-h-12 w-fit cursor-pointer items-center gap-2 rounded-kontrol px-1 font-semibold text-laut-teks">
        <FileUp aria-hidden="true" className="size-5" />
        {t("file")}
        <input type="file" accept=".csv,text/csv,text/plain" onChange={onFile} className="sr-only" />
      </label>

      {parsed ? (
        <div aria-live="polite" className="flex flex-col gap-3">
          {parsed.errors.length > 0 ? (
            <FormAlert>
              <ul className="list-disc pl-5">
                {parsed.errors.map((e, i) => (
                  <li key={i}>{issueText(e)}</li>
                ))}
              </ul>
            </FormAlert>
          ) : null}
          {parsed.warnings.length > 0 ? (
            <ul className="list-disc rounded-kontrol border-2 border-e bg-permukaan py-3 pr-4 pl-9 text-[0.95rem]">
              {parsed.warnings.map((w, i) => (
                <li key={i}>{issueText(w)}</li>
              ))}
            </ul>
          ) : null}
          {parsed.rows.length > 0 ? (
            <>
              <p className="font-semibold">{t("previewCount", { count: parsed.rows.length })}</p>
              <ol className="max-h-48 overflow-auto rounded-kontrol border border-garis px-4 py-2 font-mono text-[0.95rem]">
                {parsed.rows.map((r) => (
                  <li key={r.line}>
                    {r.code ?? <em className="not-italic text-tinta-2">({t("autoCode")})</em>} · {r.nickname ?? "—"}
                  </li>
                ))}
              </ol>
            </>
          ) : null}
        </div>
      ) : null}

      {serverError ? <FormAlert>{serverError}</FormAlert> : null}
      <Button disabled={!parsed || parsed.errors.length > 0 || parsed.rows.length === 0 || busy} onClick={submit}>
        {busy ? t("submitting") : t("submit", { count: parsed?.rows.length ?? 0 })}
      </Button>
    </section>
  );
}
