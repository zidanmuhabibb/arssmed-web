import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { GuideIllustration, type GuideKind } from "@/components/guide/GuideIllustration";
import { PageHeader } from "@/components/ui/PageHeader";
import { Download, ScanLine } from "lucide-react";
import { MARKER_PDF } from "@/lib/ar/marker";
import { buttonClass } from "@/components/ui/Button";

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
      <section aria-labelledby="kartu-penanda" className="mt-6 flex flex-col gap-3 rounded-panel border border-garis bg-permukaan p-5" data-testid="marker-guide">
        <h2 id="kartu-penanda" className="flex items-center gap-2 text-[1.3rem] font-bold">
          <ScanLine aria-hidden="true" className="size-6 text-laut-teks" />
          {t("markers.title")}
        </h2>
        <p className="max-w-[60ch] text-tinta-2">{t("markers.body")}</p>
        <a href={MARKER_PDF} download className={`${buttonClass({ variant: "kedua", size: "kecil", block: false })} self-start`}>
          <Download aria-hidden="true" className="size-5" />
          {t("markers.download")}
        </a>
      </section>
    </>
  );
}
