"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Download, KeyRound, Trash2 } from "lucide-react";
import { deleteStudentAction, resetPinAction, setConsentAction } from "@/app/guru/kelas/actions";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { FormAlert } from "@/components/ui/Field";
import type { ConsentStatus, StudentRow } from "@/lib/backend/types";
import { downloadEntryCards } from "./cards";
import { useCardLabels } from "./useCardLabels";

type Pending = { kind: "reset" | "delete"; student: StudentRow } | null;

export function StudentTable({ students, className, joinCode }: { students: StudentRow[]; className: string; joinCode: string }) {
  const t = useTranslations("guru.class");
  const { labels, fileName } = useCardLabels();
  const [confirm, setConfirm] = useState<Pending>(null);
  const [newPin, setNewPin] = useState<{ student: StudentRow; pin: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const router = useRouter();

  const errText = (code: string) => (["forbidden", "not_found"].includes(code) ? t(`errors.${code}`) : t("errors.unknown"));

  function changeConsent(s: StudentRow, status: ConsentStatus) {
    setError(null);
    startTransition(async () => {
      const r = await setConsentAction(s.id, status);
      if (!r.ok) setError(errText(r.error));
      else router.refresh();
    });
  }

  function runConfirmed() {
    const c = confirm;
    if (!c) return;
    setError(null);
    startTransition(async () => {
      if (c.kind === "reset") {
        const r = await resetPinAction(c.student.id);
        setConfirm(null);
        if (r.ok) setNewPin({ student: c.student, pin: r.pin });
        else setError(errText(r.error));
      } else {
        const r = await deleteStudentAction(c.student.id);
        setConfirm(null);
        if (!r.ok) setError(errText(r.error));
        else router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? <FormAlert>{error}</FormAlert> : null}
      {/* Satu daftar responsif: baris tabel di layar lebar, kartu bertumpuk di HP (tanpa geser horizontal). */}
      <div className="overflow-hidden rounded-panel border border-garis bg-permukaan">
        <div aria-hidden="true" className="hidden grid-cols-[5rem_minmax(7rem,1fr)_11rem_auto] gap-3 border-b border-garis px-4 py-3 text-[0.875rem] font-semibold text-tinta-2 md:grid">
          <span>{t("columns.code")}</span>
          <span>{t("columns.nickname")}</span>
          <span>{t("columns.consent")}</span>
          <span className="text-right">{t("columns.actions")}</span>
        </div>
        <ul className="divide-y divide-garis">
          {students.map((s) => (
            <li
              key={s.id}
              data-student={s.code}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 md:grid-cols-[5rem_minmax(7rem,1fr)_11rem_auto] md:py-2"
            >
              <span className="flex min-w-0 items-baseline gap-3 md:contents">
                <span className="font-mono font-semibold tabular-nums">{s.code}</span>
                <span className="min-w-0 truncate">{s.nickname ?? <span className="text-tinta-2">{t("noNickname")}</span>}</span>
              </span>
              <select
                aria-label={t("consent.label", { code: s.code })}
                value={s.consent}
                disabled={busy}
                onChange={(e) => changeConsent(s, e.target.value as ConsentStatus)}
                className="col-start-1 row-start-2 min-h-12 w-full max-w-[14rem] rounded-kontrol border-2 border-garis bg-permukaan px-3 font-semibold text-tinta md:col-start-auto md:row-start-auto"
              >
                {(["pending", "granted", "withdrawn"] as const).map((c) => (
                  <option key={c} value={c}>
                    {t(`consent.${c}`)}
                  </option>
                ))}
              </select>
              <div className="col-start-2 row-span-2 row-start-1 flex flex-col justify-end gap-1 sm:flex-row md:col-start-auto md:row-span-1 md:row-start-auto">
                <button
                  type="button"
                  onClick={() => setConfirm({ kind: "reset", student: s })}
                  title={t("resetPin")}
                  className="inline-flex min-h-12 items-center gap-1.5 rounded-kontrol px-3 font-semibold text-laut-teks active:bg-kertas"
                >
                  <KeyRound aria-hidden="true" className="size-5" />
                  <span className="sr-only 2xl:not-sr-only">{t("resetPin")}</span>
                  <span className="sr-only">{s.code}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirm({ kind: "delete", student: s })}
                  title={t("delete")}
                  className="inline-flex min-h-12 items-center gap-1.5 rounded-kontrol px-3 font-semibold text-m active:bg-kertas"
                >
                  <Trash2 aria-hidden="true" className="size-5" />
                  <span className="sr-only 2xl:not-sr-only">{t("delete")}</span>
                  <span className="sr-only">{s.code}</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <p className="max-w-[70ch] text-[0.9rem] text-tinta-2">{t("consent.note")}</p>

      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm?.kind === "delete" ? t("delete") : t("resetPin")}
        labelledBy="konfirmasi-siswa"
      >
        <p>
          {confirm
            ? confirm.kind === "delete"
              ? t("deleteConfirm", { code: confirm.student.code })
              : t("resetPinConfirm", { code: confirm.student.code })
            : null}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="kedua" size="kecil" onClick={() => setConfirm(null)}>
            {t("cancel")}
          </Button>
          <Button variant={confirm?.kind === "delete" ? "bahaya" : "utama"} size="kecil" disabled={busy} onClick={runConfirmed}>
            {confirm?.kind === "delete" ? t("delete") : t("resetPin")}
          </Button>
        </div>
      </Dialog>

      <Dialog open={newPin !== null} onClose={() => setNewPin(null)} title={newPin ? t("newPinTitle", { code: newPin.student.code }) : ""} labelledBy="pin-baru">
        <p className="text-center font-mono text-[2.4rem] font-bold tracking-[0.3em] tabular-nums" aria-live="polite">
          {newPin?.pin}
        </p>
        <p className="text-tinta-2">{t("pinOnce")}</p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="kedua" size="kecil" onClick={() => setNewPin(null)}>
            {t("done")}
          </Button>
          <Button
            size="kecil"
            icon={<Download aria-hidden="true" className="size-5" />}
            onClick={() =>
              newPin &&
              downloadEntryCards({
                className,
                joinCode,
                cards: [{ studentCode: newPin.student.code, nickname: newPin.student.nickname, pin: newPin.pin }],
                labels,
                fileName: fileName(`${className}-${newPin.student.code}`),
              })
            }
          >
            {t("downloadCards")}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
