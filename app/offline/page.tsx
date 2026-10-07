import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { WifiOff } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("offline");
  return { title: t("title") };
}

/** Halaman cadangan saat offline (di-precache oleh service worker). */
export default async function OfflinePage() {
  const t = await getTranslations("offline");
  return (
    <main id="isi" className="mx-auto max-w-xl px-4 py-12">
      <EmptyState
        icon={<WifiOff className="size-7" />}
        title={t("title")}
        body={t("body")}
        action={
          // Tautan biasa (bukan <Link>) agar memuat ulang penuh saat koneksi kembali.
          // eslint-disable-next-line @next/next/no-html-link-for-pages
          <a
            href="/"
            className="tekan inline-flex min-h-14 w-full items-center justify-center rounded-full bg-matahari px-7 font-semibold text-matahari-tinta no-underline sm:w-auto"
          >
            {t("action")}
          </a>
        }
      />
    </main>
  );
}
