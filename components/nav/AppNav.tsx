"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { BookOpen, ClipboardList, Compass, LogIn, type LucideIcon } from "lucide-react";
import { activeNavKey, PRIMARY_NAV, type NavKey } from "@/lib/nav/routes";
import { LogoMark } from "@/components/ui/Logo";

const ICONS: Record<NavKey, LucideIcon> = {
  belajar: BookOpen,
  tes: ClipboardList,
  panduan: Compass,
};

/**
 * Navigasi utama (FR-02).
 * - < 1024px: bilah atas ringkas (merek + Masuk) dan bilah tab bawah.
 * - ≥ 1024px: rel kiri.
 * Tab adalah tujuan setara: tanpa animasi geser antar-tab.
 */
export function AppNav() {
  const t = useTranslations();
  const pathname = usePathname();
  const active = activeNavKey(pathname);

  return (
    <>
      {/* Bilah atas (mobile/tablet) */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-garis bg-kertas/95 px-4 backdrop-blur-sm lg:hidden">
        <Link href="/" className="-ml-1 flex min-h-12 items-center gap-2 rounded-kontrol px-1 text-tinta no-underline">
          <LogoMark size={28} />
          <span className="font-judul text-[1.25rem] font-extrabold leading-none">{t("app.name")}</span>
          <span className="sr-only">{t("app.home")}</span>
        </Link>
        <Link
          href="/masuk"
          className="flex min-h-12 items-center gap-1.5 rounded-kontrol px-2 font-semibold text-laut-teks no-underline"
        >
          <LogIn aria-hidden="true" className="size-5" />
          {t("home.signIn")}
        </Link>
      </header>

      {/* Rel kiri (desktop) */}
      <nav
        aria-label={t("nav.label")}
        className="fixed inset-y-0 left-0 z-30 hidden w-(--rel-lebar) flex-col border-r border-garis bg-permukaan px-4 py-6 lg:flex"
      >
        <Link href="/" className="mb-8 flex min-h-12 items-center gap-3 rounded-kontrol px-2 text-tinta no-underline">
          <LogoMark size={36} />
          <span className="font-judul text-[1.5rem] font-extrabold leading-none">{t("app.name")}</span>
          <span className="sr-only">{t("app.home")}</span>
        </Link>
        <ul className="flex flex-col gap-1">
          {PRIMARY_NAV.map(({ key, href }) => {
            const Icon = ICONS[key];
            const isActive = active === key;
            return (
              <li key={key}>
                <Link
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex min-h-12 items-center gap-3 rounded-kontrol px-3 font-semibold no-underline transition-colors duration-100 ${
                    isActive ? "bg-matahari text-matahari-tinta" : "text-tinta-2 active:bg-kertas"
                  }`}
                >
                  <Icon aria-hidden="true" className="size-6" strokeWidth={isActive ? 2.4 : 2} />
                  {t(`nav.${key}`)}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mt-auto">
          <Link
            href="/masuk"
            className="flex min-h-12 items-center gap-3 rounded-kontrol px-3 font-semibold text-laut-teks no-underline"
          >
            <LogIn aria-hidden="true" className="size-6" />
            {t("home.signIn")}
          </Link>
        </div>
      </nav>

      {/* Bilah tab bawah (mobile/tablet) */}
      <nav
        aria-label={t("nav.label")}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-garis bg-permukaan pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="mx-auto grid h-(--tab-tinggi) max-w-xl grid-cols-3">
          {PRIMARY_NAV.map(({ key, href }) => {
            const Icon = ICONS[key];
            const isActive = active === key;
            return (
              <li key={key} className="flex">
                <Link
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[0.8rem] font-semibold no-underline ${
                    isActive ? "text-tinta" : "text-tinta-2"
                  }`}
                >
                  <span
                    className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-100 ${
                      isActive ? "bg-matahari text-matahari-tinta" : ""
                    }`}
                  >
                    <Icon aria-hidden="true" className="size-6" strokeWidth={isActive ? 2.4 : 2} />
                  </span>
                  {t(`nav.${key}`)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
