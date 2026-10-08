import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { ViewerApp } from "@/components/viewer/ViewerApp";
import { findUnit, UNITS } from "@/content/units";
import { CELESTIAL, hasViewer, unitObjects } from "@/lib/content/celestial";
import { pickMessages } from "@/lib/i18n-pick";

export function generateStaticParams() {
  return UNITS.filter((u) => hasViewer(u.slug)).map((u) => ({ unit: u.slug }));
}

export async function generateMetadata({ params }: PageProps<"/belajar/[unit]/viewer">): Promise<Metadata> {
  const unit = findUnit((await params).unit);
  if (!unit) return {};
  const t = await getTranslations();
  return { title: `${t("viewer.open3d")} · ${t(`units.${unit.key}.title`)}` };
}

/** Viewer 3D (FR-10 … FR-13, FR-18). */
export default async function ViewerPage({ params }: PageProps<"/belajar/[unit]/viewer">) {
  const unit = findUnit((await params).unit);
  if (!unit || !hasViewer(unit.slug)) notFound();
  const t = await getTranslations();
  const messages = await pickMessages(["viewer"]);
  return (
    <NextIntlClientProvider messages={messages}>
      <ViewerApp
        unitSlug={unit.slug}
        unitTitle={t(`units.${unit.key}.title`)}
        objects={unitObjects(unit.slug)}
        sources={CELESTIAL.sources}
      />
    </NextIntlClientProvider>
  );
}
