import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { GuideIllustration, type GuideKind } from "@/components/guide/GuideIllustration";
import { PageHeader } from "@/components/ui/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("panduan");
  return { title: t("title") };
}

const STEPS: GuideKind[] = ["masuk", "belajar", "tigaD", "titik", "ar", "kamera"];

/** FR-03: cara masuk, belajar, memakai 3D, memulai AR, dan bila kamera tidak mau hidup — tiap langkah berilustrasi. */
export default async function PanduanPage() {
  const t = await getTranslations("panduan");
  return (
    <>
      <PageHeader title={t("title")} lead={t("lead")} />
      <ol className="flex flex-col gap-3">
        {STEPS.map((key, i) => (
          <li key={key} className="flex flex-col gap-4 rounded-panel border border-garis bg-permukaan p-5 sm:flex-row sm:items-center">
            <GuideIllustration kind={key} label={t(`illustrations.${key}`)} />
            <div className="flex gap-4">
              {/* Langkah berurutan: penomoran memang bermakna di sini (PRD §8.3) */}
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-matahari font-judul text-[1.15rem] font-extrabold text-matahari-tinta tabular-nums"
              >
                {i + 1}
              </span>
              <div>
                <h2 className="text-[1.3rem] font-bold">{t(`steps.${key}.title`)}</h2>
                <p className="mt-1 max-w-[60ch] text-tinta-2">{t(`steps.${key}.body`)}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
