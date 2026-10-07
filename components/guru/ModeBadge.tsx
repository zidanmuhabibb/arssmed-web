import { getTranslations } from "next-intl/server";
import { FlaskConical, BookOpen } from "lucide-react";
import type { ClassMode } from "@/lib/backend/types";

export async function ModeBadge({ mode }: { mode: ClassMode }) {
  const t = await getTranslations("guru.mode");
  const Icon = mode === "research" ? FlaskConical : BookOpen;
  return (
    <span className="hidden shrink-0 items-center gap-1.5 rounded-kontrol border border-garis px-2.5 py-1 text-[0.8rem] font-semibold text-tinta-2 sm:inline-flex">
      <Icon aria-hidden="true" className="size-4" />
      {t(mode)}
    </span>
  );
}
