import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { StepGate, StepProgress } from "@/components/learning/StepGate";
import { TebakForm } from "@/components/learning/TebakForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { findUnit, UNITS } from "@/content/units";
import { unitLearning } from "@/lib/learning/content";
import { pickMessages } from "@/lib/i18n-pick";

export function generateStaticParams() {
  return UNITS.map((u) => ({ unit: u.slug }));
}

export async function generateMetadata({ params }: PageProps<"/belajar/[unit]/tebak">): Promise<Metadata> {
  const unit = findUnit((await params).unit);
  if (!unit) return {};
  const t = await getTranslations();
  return { title: `${t("belajar.tebak.title")} · ${t(`units.${unit.key}.title`)}` };
}

/** FR-21. Kunci jawaban tidak dikirim ke halaman ini (hanya soal dan opsi). */
export default async function TebakPage({ params }: PageProps<"/belajar/[unit]/tebak">) {
  const unit = findUnit((await params).unit);
  const content = unit && unitLearning(unit.slug);
  if (!unit || !content) notFound();
  const t = await getTranslations();
  const messages = await pickMessages(["belajar"]);
  const questions = content.predictions.map((p) => ({ key: p.key, stem: p.stem, options: p.options }));
  return (
    <NextIntlClientProvider messages={messages}>
      <StepProgress unit={unit.slug} step="tebak" />
      <PageHeader title={t("belajar.tebak.title")} lead={t("belajar.tebak.lead")} back={{ href: `/belajar/${unit.slug}`, label: t(`units.${unit.key}.title`) }} />
      <StepGate unit={unit.slug} step="tebak">
        <TebakForm unit={unit.slug} questions={questions} />
      </StepGate>
    </NextIntlClientProvider>
  );
}
