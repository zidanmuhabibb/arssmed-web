import { getTranslations } from "next-intl/server";
import { Orbit } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";

export async function NotFoundContent() {
  const t = await getTranslations("notFound");
  return (
    <EmptyState
      icon={<Orbit className="size-7" />}
      title={t("title")}
      body={t("body")}
      action={<LinkButton href="/">{t("action")}</LinkButton>}
    />
  );
}
