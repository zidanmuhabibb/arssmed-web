import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ArrowRight, KeyRound } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("masuk");
  return { title: t("title") };
}

/** Formulir masuk siswa (kode kelas + kode siswa + PIN) dibangun di M2. */
export default async function MasukPage() {
  const t = await getTranslations();
  return (
    <>
      <PageHeader title={t("masuk.title")} back={{ href: "/", label: t("app.home") }} />
      <EmptyState
        icon={<KeyRound className="size-7" />}
        title={t("masuk.title")}
        body={t("masuk.pending")}
        action={
          <LinkButton href="/belajar" icon={<ArrowRight aria-hidden="true" className="size-5" />}>
            {t("home.start")}
          </LinkButton>
        }
      />
    </>
  );
}
