import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { ListChecks, Orbit } from "lucide-react";
import { UnitSteps } from "@/components/learning/UnitSteps";
import { LinkButton } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { findUnit, UNITS } from "@/content/units";
import { unitLearning } from "@/lib/learning/content";
import { pickMessages } from "@/lib/i18n-pick";

export function generateStaticParams() {
  return UNITS.map((u) => ({ unit: u.slug }));
}

export async function generateMetadata({ params }: PageProps<"/belajar/[unit]">): Promise<Metadata> {
  const unit = findUnit((await params).unit);
  if (!unit) return {};
  const t = await getTranslations("units");
  return { title: t(`${unit.key}.title`) };
}

/** FR-20: tujuan belajar, urutan langkah, status penyelesaian. */
export default async function UnitPage({ params }: PageProps<"/belajar/[unit]">) {
  const unit = findUnit((await params).unit);
  const content = unit && unitLearning(unit.slug);
  if (!unit || !content) notFound();
  const t = await getTranslations();
  const messages = await pickMessages(["belajar"]);
  return (
    <>
      <PageHeader
        title={t(`units.${unit.key}.title`)}
        lead={t(`units.${unit.key}.summary`)}
        back={{ href: "/belajar", label: t("nav.belajar") }}
      />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
        <NextIntlClientProvider messages={messages}>
          <UnitSteps unit={unit.slug} />
        </NextIntlClientProvider>
        <aside className="flex flex-col gap-4">
          <section aria-labelledby="tujuan-judul" className="rounded-panel border border-garis bg-permukaan p-5">
            <h2 id="tujuan-judul" className="text-[1.2rem] font-bold">
              {t("belajar.objectives")}
            </h2>
            <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5">
              {content.objectives.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </section>
          <LinkButton href={`/belajar/${unit.slug}/viewer`} variant="kedua" icon={<Orbit aria-hidden="true" className="size-5" />}>
            {t("belajar.free3d")}
          </LinkButton>
          <LinkButton href={`/belajar/${unit.slug}/kuis`} variant="kedua" icon={<ListChecks aria-hidden="true" className="size-5" />}>
            {t("belajar.quiz.open")}
          </LinkButton>
        </aside>
      </div>
    </>
  );
}
