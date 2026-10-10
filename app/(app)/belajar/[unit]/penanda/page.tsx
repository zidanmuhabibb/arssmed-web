import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { MarkerAR } from "@/components/viewer/MarkerAR";
import { PageHeader } from "@/components/ui/PageHeader";
import { findUnit, UNITS } from "@/content/units";
import { arModelUrls } from "@/lib/ar/spec";
import { hasViewer, unitObjects } from "@/lib/content/celestial";
import { pickMessages } from "@/lib/i18n-pick";

export function generateStaticParams() {
  return UNITS.filter((u) => hasViewer(u.slug)).map((u) => ({ unit: u.slug }));
}

export async function generateMetadata({ params }: PageProps<"/belajar/[unit]/penanda">): Promise<Metadata> {
  const unit = findUnit((await params).unit);
  if (!unit) return {};
  const t = await getTranslations();
  return { title: `${t("viewer.marker.title")} · ${t(`units.${unit.key}.title`)}` };
}

/** FR-15: AR dengan kartu penanda. Benda dipilih lewat ?objek= (bawaan: benda pertama unit). */
export default async function PenandaPage({ params, searchParams }: PageProps<"/belajar/[unit]/penanda">) {
  const unit = findUnit((await params).unit);
  if (!unit || !hasViewer(unit.slug)) notFound();
  const t = await getTranslations();
  const messages = await pickMessages(["viewer"]);
  return (
    <>
      <PageHeader title={t("viewer.marker.title")} lead={t("viewer.marker.lead")} back={{ href: `/belajar/${unit.slug}/viewer`, label: t(`units.${unit.key}.title`) }} />
      <Suspense fallback={null}>
        <Stage unitSlug={unit.slug} unitNumber={unit.number} searchParams={searchParams} messages={messages} />
      </Suspense>
    </>
  );
}

async function Stage({ unitSlug, unitNumber, searchParams, messages }: { unitSlug: string; unitNumber: number; searchParams: PageProps<"/belajar/[unit]/penanda">["searchParams"]; messages: Record<string, unknown> }) {
  const sp = await searchParams;
  const objects = unitObjects(unitSlug);
  const obj = objects.find((o) => o.id === sp.objek) ?? objects[0]!;
  return (
    <NextIntlClientProvider messages={messages}>
      <MarkerAR unit={unitSlug} unitNumber={unitNumber} objectId={obj.id} objectName={obj.name} glb={arModelUrls(obj).glb} viewerHref={`/belajar/${unitSlug}/viewer`} />
    </NextIntlClientProvider>
  );
}
