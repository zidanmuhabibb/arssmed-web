import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { UNITS } from "@/content/units";
import { LEARNING } from "@/lib/learning/content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("materi");
  return { title: t("title") };
}

/** FR-04: capaian pembelajaran IPAS Fase C, tujuan belajar tiap unit, petunjuk belajar. */
export default async function MateriPage() {
  const t = await getTranslations();
  const c = LEARNING.curriculum;
  return (
    <>
      <PageHeader title={t("materi.title")} lead={t("materi.lead")} back={{ href: "/", label: t("app.home") }} />
      <div className="flex flex-col gap-5">
        <section aria-labelledby="cp-judul" className="rounded-panel border border-garis bg-permukaan p-5">
          <h2 id="cp-judul" className="text-[1.4rem] font-bold">
            {t("materi.cpTitle")}
          </h2>
          <p className="mt-1 text-[0.9rem] text-tinta-2">{t("materi.cpMeta", { subject: c.subject, phase: c.phase, element: c.element })}</p>
          <blockquote className="mt-3 max-w-[60ch] border-l-4 border-matahari pl-4 text-[1.05rem]">{c.cp_text}</blockquote>
          <p className="mt-3 text-[0.8rem] text-tinta-2">{c.cp_source}</p>
        </section>

        <section aria-labelledby="tujuan-judul" className="flex flex-col gap-3">
          <h2 id="tujuan-judul" className="text-[1.4rem] font-bold">
            {t("materi.objectivesTitle")}
          </h2>
          <ol className="divide-y divide-garis overflow-hidden rounded-panel border border-garis bg-permukaan">
            {UNITS.map((u) => (
              <li key={u.slug} className="p-5">
                <h3 className="text-[1.15rem] font-bold">
                  <span className="text-tinta-2">{t("materi.unitLabel", { number: u.number })} · </span>
                  {t(`units.${u.key}.title`)}
                </h3>
                <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
                  {LEARNING.units[u.slug]!.objectives.map((o) => (
                    <li key={o}>{o}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
          {LEARNING.review_status === "needs_review" ? <p className="text-[0.85rem] text-tinta-2">{t("materi.review")}</p> : null}
        </section>

        <section aria-labelledby="petunjuk-judul" className="rounded-panel border border-garis bg-permukaan p-5">
          <h2 id="petunjuk-judul" className="text-[1.4rem] font-bold">
            {t("materi.howTitle")}
          </h2>
          <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5">
            {c.how_to_learn.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
