import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { TestList } from "@/components/tes/TestList";
import { PageHeader } from "@/components/ui/PageHeader";
import { pickMessages } from "@/lib/i18n-pick";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("tes");
  return { title: t("title") };
}

/** FR-30: tes hanya bisa dikerjakan bila guru membukanya untuk kelas siswa. */
export default async function TesPage() {
  const t = await getTranslations();
  const messages = await pickMessages(["tes"]);
  return (
    <>
      <PageHeader title={t("tes.title")} lead={t("tes.lead")} />
      <NextIntlClientProvider messages={messages}>
        <TestList />
      </NextIntlClientProvider>
    </>
  );
}
