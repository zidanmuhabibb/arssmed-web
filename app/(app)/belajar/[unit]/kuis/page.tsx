import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { PracticeQuiz } from "@/components/learning/PracticeQuiz";
import { PageHeader } from "@/components/ui/PageHeader";
import { findUnit, UNITS } from "@/content/units";
import { practiceFor } from "@/lib/learning/extras";
import { pickMessages } from "@/lib/i18n-pick";

export function generateStaticParams() {
  return UNITS.map((u) => ({ unit: u.slug }));
}

export async function generateMetadata({ params }: PageProps<"/belajar/[unit]/kuis">): Promise<Metadata> {
  const unit = findUnit((await params).unit);
  if (!unit) return {};
  const t = await getTranslations();
  return { title: `${t("belajar.quiz.title")} · ${t(`units.${unit.key}.title`)}` };
}

/** FR-26: kuis latihan per unit (statis; tanpa akun, tanpa penyimpanan). */
export default async function KuisPage({ params }: PageProps<"/belajar/[unit]/kuis">) {
  const unit = findUnit((await params).unit);
  const questions = unit ? practiceFor(unit.slug) : [];
  if (!unit || questions.length === 0) notFound();
  const t = await getTranslations();
  const messages = await pickMessages(["belajar"]);
  return (
    <>
      <PageHeader title={t("belajar.quiz.title")} lead={t("belajar.quiz.lead", { unit: t(`units.${unit.key}.title`) })} back={{ href: `/belajar/${unit.slug}`, label: t(`units.${unit.key}.title`) }} />
      <div className="max-w-[44rem]">
        <NextIntlClientProvider messages={messages}>
          <PracticeQuiz questions={questions} />
        </NextIntlClientProvider>
      </div>
    </>
  );
}
