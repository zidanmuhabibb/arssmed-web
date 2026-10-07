import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { TeacherLoginForm } from "@/components/auth/TeacherLoginForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("guru.login");
  return { title: t("title") };
}

export default async function GuruMasukPage() {
  const t = await getTranslations("guru.login");
  return (
    <div className="mx-auto w-full max-w-md pt-4 lg:pt-10">
      <h1 className="text-[2rem] font-extrabold">{t("title")}</h1>
      <p className="mt-2 mb-6 text-tinta-2">{t("lead")}</p>
      <TeacherLoginForm />
      <p className="mt-6">
        <Link href="/masuk" className="inline-flex min-h-12 items-center font-semibold text-laut-teks">
          {t("studentLink")}
        </Link>
      </p>
    </div>
  );
}
