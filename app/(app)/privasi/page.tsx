import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("privasi");
  return { title: t("title") };
}

export default async function Page() {
  const t = await getTranslations();
  return (
    <>
      <PageHeader title={t("privasi.title")} back={{ href: "/", label: t("app.home") }} />
      <EmptyState icon={<FileText className="size-7" />} title={t("privasi.title")} body={t("privasi.pending")} />
    </>
  );
}
