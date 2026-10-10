import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { MessagesSquare } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { UNITS } from "@/content/units";
import { requireStaff } from "@/lib/backend";
import { DISCUSSION, discussionCard } from "@/lib/learning/extras";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("guru.discussion");
  return { title: t("title") };
}

export default function KartuDiskusiPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={4} />}>
      <Cards />
    </Suspense>
  );
}

/** FR-25: kartu diskusi per unit — pertanyaan pemantik + miskonsepsi umum + butir tes terkait. Bisa dicetak. */
async function Cards() {
  await requireStaff();
  const t = await getTranslations();
  return (
    <>
      <PageHeader title={t("guru.discussion.title")} lead={t("guru.discussion.lead")} />
      {DISCUSSION.review_status === "needs_review" ? <p className="mb-6 rounded-kontrol border border-garis bg-permukaan p-3 text-[0.95rem]">{t("guru.discussion.draft")}</p> : null}
      <nav aria-label={t("guru.discussion.jump")} className="mb-6 flex flex-wrap gap-2 print:hidden">
        {UNITS.map((u) => (
          <a key={u.slug} href={`#${u.slug}`} className="inline-flex min-h-12 items-center rounded-full border-2 border-garis bg-permukaan px-4 font-semibold text-tinta no-underline">
            {t("belajar.unitLabel", { number: u.number })}
          </a>
        ))}
      </nav>
      <div className="flex flex-col gap-6">
        {UNITS.map((u) => {
          const c = discussionCard(u.slug)!;
          return (
            <article key={u.slug} id={u.slug} tabIndex={-1} className="scroll-mt-24 break-inside-avoid rounded-panel border border-garis bg-permukaan p-5 outline-none sm:p-6" data-testid={`card-${u.slug}`}>
              <p className="text-[0.9rem] font-semibold text-tinta-2">{t("belajar.unitLabel", { number: u.number })}</p>
              <h2 className="flex items-center gap-2 text-[1.5rem] font-bold">
                <MessagesSquare aria-hidden="true" className="size-6 text-laut-teks" />
                {t(`units.${u.key}.title`)}
              </h2>
              <h3 className="mt-4 font-bold">{t("guru.discussion.questions")}</h3>
              <ol className="mt-2 flex list-decimal flex-col gap-2 pl-6">
                {c.questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ol>
              <h3 className="mt-5 font-bold">{t("guru.discussion.misconceptions")}</h3>
              <ul className="mt-2 flex flex-col gap-3">
                {c.misconceptions.map((m) => (
                  <li key={m.code} className="rounded-kontrol bg-kertas p-3">
                    <span className="block font-mono text-[0.8rem] text-tinta-2">{m.code}</span>
                    <span className="block">
                      <span className="font-semibold">{t("guru.discussion.belief")}: </span>
                      {m.statement}
                    </span>
                    <span className="block">
                      <span className="font-semibold">{t("guru.discussion.scientific")}: </span>
                      {m.scientific}
                    </span>
                  </li>
                ))}
              </ul>
              <details className="mt-4">
                <summary className="min-h-12 cursor-pointer content-center font-semibold text-laut-teks">{t("guru.discussion.items", { n: c.items.length })}</summary>
                <ul className="mt-2 flex flex-col gap-2 text-[0.95rem]">
                  {c.items.map((i) => (
                    <li key={i.code}>
                      <span className="font-bold">{i.code}</span> {i.indicator}
                      {i.alternative ? <span className="block text-tinta-2">{t("guru.discussion.alternative")}: {i.alternative}</span> : null}
                    </li>
                  ))}
                </ul>
              </details>
            </article>
          );
        })}
      </div>
    </>
  );
}
