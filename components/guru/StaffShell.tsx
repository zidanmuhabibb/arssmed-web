import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { pickMessages } from "@/lib/i18n-pick";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { LogoMark } from "@/components/ui/Logo";
import { getViewer } from "@/lib/backend";

/** Kerangka area guru/peneliti: desktop/laptop & proyektor dulu, tetap layak di HP. */
export async function StaffShell({ children, extraMessages = [] }: { children: ReactNode; extraMessages?: string[] }) {
  const t = await getTranslations("guru");
  const messages = await pickMessages(["app", "nav", "masuk", "akun", "guru", ...extraMessages]);
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-garis bg-permukaan">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link href="/guru/kelas" className="flex min-h-12 items-center gap-2 rounded-kontrol text-tinta no-underline">
            <LogoMark size={30} />
            <span className="font-judul text-[1.2rem] font-extrabold leading-none">{t("brand")}</span>
          </Link>
          <nav aria-label={t("brand")} className="ml-2 hidden sm:block">
            <Link href="/guru/kelas" className="inline-flex min-h-12 items-center rounded-kontrol px-3 font-semibold text-tinta no-underline">
              {t("navClasses")}
            </Link>
            <Suspense fallback={null}>
              <ResearchLink label={t("navResearch")} />
            </Suspense>
          </nav>
          <div className="ml-auto">
            <Suspense fallback={null}>
              <StaffAccount />
            </Suspense>
          </div>
        </div>
      </header>
      <main id="isi" tabIndex={-1} className="mx-auto w-full max-w-6xl px-4 py-6 outline-none sm:px-6 lg:py-10">
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </main>
    </div>
  );
}

async function ResearchLink({ label }: { label: string }) {
  const viewer = await getViewer().catch(() => ({ kind: "anon" as const }));
  if (viewer.kind !== "staff" || viewer.role !== "admin") return null;
  return (
    <Link href="/riset" className="inline-flex min-h-12 items-center rounded-kontrol px-3 font-semibold text-tinta no-underline">
      {label}
    </Link>
  );
}

async function StaffAccount() {
  const t = await getTranslations("akun");
  const viewer = await getViewer().catch(() => ({ kind: "anon" as const }));
  if (viewer.kind !== "staff") return null;
  return (
    <div className="flex items-center gap-2">
      <span className="hidden max-w-[16rem] truncate text-tinta-2 md:inline">{viewer.fullName ?? viewer.email}</span>
      <SignOutButton label={t("signOut")} className="inline-flex min-h-12 items-center gap-2 rounded-kontrol px-2 font-semibold text-laut-teks" />
    </div>
  );
}
