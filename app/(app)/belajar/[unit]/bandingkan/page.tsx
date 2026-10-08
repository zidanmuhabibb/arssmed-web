import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { CompareList } from "@/components/learning/CompareList";
import { StepGate, StepProgress } from "@/components/learning/StepGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { findUnit, UNITS } from "@/content/units";
import { unitLearning } from "@/lib/learning/content";
import { pickMessages } from "@/lib/i18n-pick";

export function generateStaticParams() {
  return UNITS.map((u) => ({ unit: u.slug }));
}

export async function generateMetadata({ params }: PageProps<"/belajar/[unit]/bandingkan">): Promise<Metadata> {
  const unit = findUnit((await params).unit);
  if (!unit) return {};
  const t = await getTranslations();
  return { title: `${t("belajar.bandingkan.title")} · ${t(`units.${unit.key}.title`)}` };
}

/** FR-23. */
export default async function BandingkanPage({ params }: PageProps<"/belajar/[unit]/bandingkan">) {
  const unit = findUnit((await params).unit);
  const content = unit && unitLearning(unit.slug);
  if (!unit || !content) notFound();
  const t = await getTranslations();
  const messages = await pickMessages(["belajar"]);
  const items = content.predictions.map((p) => ({ key: p.key, stem: p.stem, options: p.options, correct: p.correct, reveal: p.reveal, observe: p.observe }));
  return (
    <NextIntlClientProvider messages={messages}>
      <StepProgress unit={unit.slug} step="bandingkan" />
      <PageHeader title={t("belajar.bandingkan.title")} lead={t("belajar.bandingkan.lead")} back={{ href: `/belajar/${unit.slug}`, label: t(`units.${unit.key}.title`) }} />
      <StepGate unit={unit.slug} step="bandingkan" hideUntilReady>
        <CompareList unit={unit.slug} items={items} />
      </StepGate>
    </NextIntlClientProvider>
  );
}
