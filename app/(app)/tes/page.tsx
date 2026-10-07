import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("tes");
  return { title: t("title") };
}

/** Sampai M6, tes selalu tertutup (skenario penerimaan PRD §14). */
export default async function TesPage() {
  const t = await getTranslations();
  return (
    <>
      <PageHeader title={t("tes.title")} />
      <EmptyState
        icon={<LockKeyhole className="size-7" />}
        title={t("tes.closedTitle")}
        body={t("tes.closedBody")}
        action={
          <LinkButton href="/belajar" icon={<ArrowRight aria-hidden="true" className="size-5" />}>
            {t("home.start")}
          </LinkButton>
        }
      />
    </>
  );
}
