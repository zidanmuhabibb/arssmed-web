import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { StudentLoginForm } from "@/components/auth/StudentLoginForm";
import { PageHeader } from "@/components/ui/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("masuk");
  return { title: t("title") };
}

/** Masuk siswa: kode kelas + kode siswa + PIN (PRD §3, FR-01). */
export default async function MasukPage() {
  const t = await getTranslations();
  return (
    <div className="mx-auto w-full max-w-md">
      <PageHeader title={t("masuk.title")} lead={t("masuk.lead")} back={{ href: "/", label: t("app.home") }} />
      <StudentLoginForm />
      <p className="mt-6 text-tinta-2">{t("masuk.noCard")}</p>
      <p className="mt-2">
        <Link href="/guru/masuk" className="inline-flex min-h-12 items-center font-semibold text-laut-teks">
          {t("masuk.teacherLink")}
        </Link>
      </p>
    </div>
  );
}
