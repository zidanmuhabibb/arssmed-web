import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Orbit, Telescope } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import { hasViewer } from "@/lib/content/celestial";
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
      {hasViewer(unit.slug) ? (
        <LinkButton href={`/belajar/${unit.slug}/viewer`} icon={<Orbit aria-hidden="true" className="size-5" />}>
          {t("viewer.open3d")}
        </LinkButton>
      ) : (
        <EmptyState
          icon={<Telescope className="size-7" />}
          title={t("belajar.unitLabel", { number: unit.number })}
          body={t("belajar.comingSoon")}
        />
      )}
    </>
  );
}
