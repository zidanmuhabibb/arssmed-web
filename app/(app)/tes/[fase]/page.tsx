import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { TestRunner } from "@/components/tes/TestRunner";
import { PageHeader } from "@/components/ui/PageHeader";
import { pickMessages } from "@/lib/i18n-pick";
import { isPhase, PHASES } from "@/lib/tes/types";

export function generateStaticParams() {
  return PHASES.map((fase) => ({ fase }));
}

export async function generateMetadata({ params }: PageProps<"/tes/[fase]">): Promise<Metadata> {
  const { fase } = await params;
  if (!isPhase(fase)) return {};
  const t = await getTranslations("tes");
  return { title: t(`phase.${fase}`) };
}

/** Tes four-tier (FR-31…FR-36). Halaman statis; butir dimuat klien tanpa kunci jawaban. */
export default async function TesFasePage({ params }: PageProps<"/tes/[fase]">) {
  const { fase } = await params;
  if (!isPhase(fase)) notFound();
  const t = await getTranslations();
  const messages = await pickMessages(["tes"]);
  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader title={t(`tes.phase.${fase}`)} back={{ href: "/tes", label: t("tes.title") }} />
      <NextIntlClientProvider messages={messages}>
        <TestRunner phase={fase} />
      </NextIntlClientProvider>
    </div>
  );
}
