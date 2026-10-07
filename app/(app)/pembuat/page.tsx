import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pembuat");
  return { title: t("title") };
}

/**
 * FR-05. Nama diambil dari referensi PRD §18. Institusi, tahun, dan daftar
 * pembimbing resmi menunggu konfirmasi peneliti (DECISIONS.md D-012).
 */
export default async function PembuatPage() {
  const t = await getTranslations();
  return (
    <>
      <PageHeader title={t("pembuat.title")} back={{ href: "/", label: t("app.home") }} />
      <dl className="divide-y divide-garis rounded-panel border border-garis bg-permukaan">
        <div className="px-5 py-4">
          <dt className="text-[0.875rem] font-semibold text-tinta-2">{t("pembuat.researcher")}</dt>
          <dd className="mt-0.5 font-semibold">Zidan Muhabib</dd>
        </div>
        <div className="px-5 py-4">
          <dt className="text-[0.875rem] font-semibold text-tinta-2">{t("pembuat.attribution")}</dt>
          <dd className="mt-0.5">
            <p className="text-tinta-2">{t("pembuat.attributionPending")}</p>
            <ul className="mt-2 flex flex-col gap-1">
              <li>{t("pembuat.fontsCredit")}</li>
              <li>{t("pembuat.iconsCredit")}</li>
            </ul>
          </dd>
        </div>
      </dl>
    </>
  );
}
