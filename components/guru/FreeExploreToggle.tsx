"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setFreeExploreAction } from "@/app/guru/kelas/actions";

/** FR-22: sakelar mode bebas untuk langkah Amati. */
export function FreeExploreToggle({ classId, initial }: { classId: string; initial: boolean }) {
  const t = useTranslations("guru.class.freeExplore");
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  return (
    <section aria-labelledby="mode-bebas" className="mb-8 rounded-panel border border-garis bg-permukaan p-5">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <h2 id="mode-bebas" className="text-[1.2rem] font-bold">
            {t("title")}
          </h2>
          <p className="mt-1 max-w-[60ch] text-[0.95rem] text-tinta-2">{t("hint")}</p>
        </div>
        <label className="flex min-h-12 shrink-0 cursor-pointer items-center gap-2 font-semibold">
          <input
            type="checkbox"
            role="switch"
            checked={on}
            disabled={pending}
            aria-describedby="mode-bebas-status"
            onChange={(e) => {
              const v = e.target.checked;
              setOn(v);
              setError(false);
              start(async () => {
                const r = await setFreeExploreAction(classId, v);
                if (!r.ok) {
                  setOn(!v);
                  setError(true);
                } else router.refresh();
              });
            }}
            className="size-6 accent-[var(--laut)]"
          />
          <span className="sr-only">{t("title")}</span>
          <span id="mode-bebas-status" aria-live="polite">
            {on ? t("on") : t("off")}
          </span>
        </label>
      </div>
      {error ? (
        <p role="alert" className="mt-2 font-semibold text-m">
          {t("error")}
        </p>
      ) : null}
    </section>
  );
}
