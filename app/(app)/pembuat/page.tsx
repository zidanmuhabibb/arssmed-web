import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import profile from "@/content/profile.json";
import { CELESTIAL } from "@/lib/content/celestial";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pembuat");
  return { title: t("title") };
}

/**
 * FR-05: peneliti, pembimbing, institusi, tahun, atribusi. Data dari content/profile.json
 * (sumber: halaman judul dokumen instrumen). Kolom kosong ditampilkan jujur sebagai "belum diisi".
 */
export default async function PembuatPage() {
  const t = await getTranslations();
  const rows: [string, string | null][] = [
    [t("pembuat.researcher"), profile.researcher],
    [t("pembuat.program"), profile.program],
    [t("pembuat.institution"), profile.institution],
    [t("pembuat.year"), profile.year],
    [t("pembuat.supervisors"), profile.supervisors],
  ];
  return (
    <>
      <PageHeader title={t("pembuat.title")} back={{ href: "/", label: t("app.home") }} />
      <div className="flex flex-col gap-5">
        <dl className="divide-y divide-garis rounded-panel border border-garis bg-permukaan">
          {rows.map(([label, value]) => (
            <div key={label} className="px-5 py-4">
              <dt className="text-[0.875rem] font-semibold text-tinta-2">{label}</dt>
              <dd className={`mt-0.5 ${value ? "font-semibold" : "text-tinta-2 italic"}`}>{value ?? t("pembuat.notFilled")}</dd>
            </div>
          ))}
          <div className="px-5 py-4">
            <dt className="text-[0.875rem] font-semibold text-tinta-2">{t("pembuat.previous")}</dt>
            <dd className="mt-0.5 max-w-[60ch]">{profile.previous_version}</dd>
          </div>
        </dl>

        <section aria-labelledby="atribusi-judul" className="rounded-panel border border-garis bg-permukaan p-5">
          <h2 id="atribusi-judul" className="text-[1.3rem] font-bold">
            {t("pembuat.attribution")}
          </h2>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
            <li>{t("pembuat.textures")}</li>
            <li>{t("pembuat.science")}</li>
            <li>{t("pembuat.threeCredit")}</li>
            <li>{t("pembuat.fontsCredit")}</li>
            <li>{t("pembuat.iconsCredit")}</li>
          </ul>
          <h3 className="mt-4 text-[1.05rem] font-bold">{t("pembuat.sourcesTitle")}</h3>
          <ul className="mt-1 flex flex-col gap-1 text-[0.9rem]">
            {Object.values(CELESTIAL.sources).map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-laut-teks underline">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
        <p className="max-w-[60ch] text-[0.9rem] text-tinta-2">{t("pembuat.noCausal")}</p>
      </div>
    </>
  );
}
