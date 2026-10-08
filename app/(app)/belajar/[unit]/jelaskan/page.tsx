import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { MessagesSquare } from "lucide-react";
import { ExplainActions } from "@/components/learning/ExplainActions";
import { StepGate, StepProgress } from "@/components/learning/StepGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { findUnit, UNITS } from "@/content/units";
import { CELESTIAL } from "@/lib/content/celestial";
import { unitLearning } from "@/lib/learning/content";
import { pickMessages } from "@/lib/i18n-pick";

export function generateStaticParams() {
  return UNITS.map((u) => ({ unit: u.slug }));
}

export async function generateMetadata({ params }: PageProps<"/belajar/[unit]/jelaskan">): Promise<Metadata> {
  const unit = findUnit((await params).unit);
  if (!unit) return {};
  const t = await getTranslations();
  return { title: `${t("belajar.jelaskan.title")} · ${t(`units.${unit.key}.title`)}` };
}

/** FR-24: penjelasan ilmiah (maks. 3 kalimat), satu pertanyaan refleksi, penanda diskusi. */
export default async function JelaskanPage({ params }: PageProps<"/belajar/[unit]/jelaskan">) {
  const unit = findUnit((await params).unit);
  const content = unit && unitLearning(unit.slug);
  if (!unit || !content) notFound();
  const t = await getTranslations();
  const messages = await pickMessages(["belajar"]);
  const i = UNITS.findIndex((u) => u.slug === unit.slug);
  const next = UNITS[i + 1];
  return (
    <NextIntlClientProvider messages={messages}>
      <StepProgress unit={unit.slug} step="jelaskan" />
      <PageHeader title={t("belajar.jelaskan.title")} lead={t("belajar.jelaskan.lead")} back={{ href: `/belajar/${unit.slug}`, label: t(`units.${unit.key}.title`) }} />
      <StepGate unit={unit.slug} step="jelaskan" hideUntilReady>
        <div className="flex flex-col gap-5">
          <section aria-labelledby="penjelasan-judul" className="rounded-panel border border-garis bg-permukaan p-5">
            <h2 id="penjelasan-judul" className="text-[1.3rem] font-bold">
              {t("belajar.jelaskan.explanation")}
            </h2>
            <p className="mt-2 max-w-[60ch] text-[1.05rem]">{content.explanation.text}</p>
            <p className="mt-3 text-[0.8rem] text-tinta-2">
              {t("belajar.jelaskan.sources")}:{" "}
              {content.explanation.sources.map((s, k) => (
                <span key={s}>
                  {k > 0 ? "; " : ""}
                  <a href={CELESTIAL.sources[s]!.url} target="_blank" rel="noopener noreferrer" className="text-laut-teks underline">
                    {CELESTIAL.sources[s]!.label}
                  </a>
                </span>
              ))}
            </p>
          </section>
          <section aria-labelledby="refleksi-judul" className="rounded-panel border-2 border-matahari bg-permukaan p-5">
            <h2 id="refleksi-judul" className="flex items-center gap-2 text-[1.3rem] font-bold">
              <MessagesSquare aria-hidden="true" className="size-6" />
              {t("belajar.jelaskan.reflection")}
            </h2>
            <p className="mt-2 max-w-[60ch] text-[1.05rem]">{content.reflection}</p>
          </section>
          <ExplainActions unit={unit.slug} number={unit.number} nextUnit={next ? { slug: next.slug, number: next.number } : null} />
        </div>
      </StepGate>
    </NextIntlClientProvider>
  );
}
