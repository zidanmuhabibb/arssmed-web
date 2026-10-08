"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { ArrowRight, Check, ClipboardList, LockKeyhole } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import type { StudentTestStatus } from "@/lib/tes/types";

type State = { kind: "loading" } | { kind: "guest" } | { kind: "ok"; tests: StudentTestStatus[] } | { kind: "error" };

/** Status tes awal & akhir untuk siswa (FR-30). Halaman tetap statis; status dibaca klien. */
export function useStudentTests() {
  const [state, setState] = useState<State>({ kind: "loading" });
  useEffect(() => {
    let alive = true;
    fetch("/api/tes/status", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ tests: StudentTestStatus[] }>) : Promise.reject(new Error())))
      .then((d) => alive && setState(d.tests.length ? { kind: "ok", tests: d.tests } : { kind: "guest" }))
      .catch(() => alive && setState({ kind: "error" }));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

export function TestList() {
  const t = useTranslations("tes");
  const s = useStudentTests();
  if (s.kind === "loading") return <p role="status" className="text-tinta-2">{t("runner.loading")}</p>;
  if (s.kind === "guest") {
    return <EmptyState icon={<ClipboardList className="size-7" />} title={t("guest.title")} body={t("guest.body")} action={<LinkButton href="/masuk">{t("signIn")}</LinkButton>} />;
  }
  if (s.kind === "error") {
    return <EmptyState icon={<LockKeyhole className="size-7" />} title={t("blocked.network.title")} body={t("blocked.network.body")} />;
  }
  const anyOpen = s.tests.some((x) => x.status === "open");
  return (
    <div className="flex flex-col gap-4">
      {!anyOpen && s.tests.every((x) => !x.attempt?.submitted) ? (
        <EmptyState
          icon={<LockKeyhole className="size-7" />}
          title={t("closedTitle")}
          body={t("closedBody")}
          action={
            <LinkButton href="/belajar" icon={<ArrowRight aria-hidden="true" className="size-5" />}>
              {t("toLearn")}
            </LinkButton>
          }
        />
      ) : null}
      <ul className="flex flex-col gap-3">
        {s.tests.map((x) => {
          const submitted = !!x.attempt?.submitted;
          const canWork = x.status === "open" && !x.blocked && !submitted;
          return (
            <li key={x.phase} className="flex flex-col gap-3 rounded-panel border border-garis bg-permukaan p-5" data-testid={`test-card-${x.phase}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[1.3rem] font-bold">{t(`phase.${x.phase}`)}</h2>
                  <p className="text-[0.95rem] text-tinta-2">
                    {submitted
                      ? t("card.submitted")
                      : x.status !== "open"
                        ? t(x.status === "closed" ? "card.closed" : "card.notOpen")
                        : x.blocked
                          ? t(`card.blocked.${x.blocked}`)
                          : x.attempt
                            ? t("card.inProgress", { done: x.attempt.answered, total: x.attempt.total })
                            : t("card.open")}
                  </p>
                </div>
                {submitted ? (
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sc text-white" aria-hidden="true">
                    <Check className="size-5" strokeWidth={3} />
                  </span>
                ) : null}
              </div>
              {canWork ? (
                <LinkButton href={`/tes/${x.phase}`} icon={<ArrowRight aria-hidden="true" className="size-5" />}>
                  {x.attempt ? t("card.continue") : t("card.start")}
                </LinkButton>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="max-w-[60ch] text-[0.9rem] text-tinta-2">{t("note")}</p>
    </div>
  );
}

/** Tombol "Kerjakan tes" di Beranda: hanya tampil bila ada tes yang dibuka untuk siswa ini (FR-01). */
export function HomeTestButton() {
  const t = useTranslations("home");
  const s = useStudentTests();
  if (s.kind !== "ok") return null;
  const open = s.tests.find((x) => x.status === "open" && !x.blocked && !x.attempt?.submitted);
  if (!open) return null;
  return (
    <LinkButton href={`/tes/${open.phase}`} variant="kedua" icon={<ClipboardList aria-hidden="true" className="size-5" />}>
      {t("takeTest")}
    </LinkButton>
  );
}
