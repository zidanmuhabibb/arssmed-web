import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LayoutDashboard, LogIn } from "lucide-react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { getViewer } from "@/lib/backend";

const linkClass = "flex min-h-12 items-center gap-2 rounded-kontrol px-2 font-semibold text-laut-teks no-underline";

/** Status akun di bilah atas/rel (membaca sesi → selalu di dalam <Suspense>). */
export async function AccountSlot() {
  const t = await getTranslations("akun");
  const viewer = await getViewer().catch(() => ({ kind: "anon" as const }));

  if (viewer.kind === "student") {
    return (
      <div className="flex items-center gap-1">
        <span className="hidden max-w-[10rem] truncate font-semibold text-tinta sm:inline">
          {t("hello", { name: viewer.nickname ?? viewer.studentCode })}
        </span>
        <SignOutButton label={t("signOut")} className={linkClass} />
      </div>
    );
  }
  if (viewer.kind === "staff") {
    return (
      <Link href="/guru/kelas" className={linkClass}>
        <LayoutDashboard aria-hidden="true" className="size-5" />
        {t("teacherDashboard")}
      </Link>
    );
  }
  return <SignInLink label={t("signIn")} />;
}

export function SignInLink({ label }: { label: string }) {
  return (
    <Link href="/masuk" className={linkClass}>
      <LogIn aria-hidden="true" className="size-5" />
      {label}
    </Link>
  );
}

export async function AccountSlotFallback() {
  const t = await getTranslations("akun");
  return <SignInLink label={t("signIn")} />;
}
