import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Telescope } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { findUnit, UNITS } from "@/content/units";

export function generateStaticParams() {
  return UNITS.map((u) => ({ unit: u.slug }));
}

export async function generateMetadata({ params }: PageProps<"/belajar/[unit]">): Promise<Metadata> {
  const unit = findUnit((await params).unit);
  if (!unit) return {};
  const t = await getTranslations("units");
  return { title: t(`${unit.key}.title`) };
}

export default async function UnitPage({ params }: PageProps<"/belajar/[unit]">) {
  const unit = findUnit((await params).unit);
  if (!unit) notFound();
  const t = await getTranslations();
  return (
    <>
      <PageHeader
        title={t(`units.${unit.key}.title`)}
        lead={t(`units.${unit.key}.summary`)}
        back={{ href: "/belajar", label: t("nav.belajar") }}
      />
      <EmptyState
        icon={<Telescope className="size-7" />}
        title={t("belajar.unitLabel", { number: unit.number })}
        body={t("belajar.comingSoon")}
      />
    </>
  );
}
