import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { UNITS } from "@/content/units";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("belajar");
  return { title: t("title") };
}

export default async function BelajarPage() {
  const t = await getTranslations();
  return (
    <>
      <PageHeader title={t("belajar.title")} lead={t("belajar.lead")} />
      <ListGroup>
        {UNITS.map((u) => (
          <ListRow
            key={u.slug}
            href={`/belajar/${u.slug}`}
            title={t(`units.${u.key}.title`)}
            hint={t(`units.${u.key}.summary`)}
            leading={
              <span
                className="flex size-11 items-center justify-center rounded-full bg-panggung font-judul text-[1.2rem] font-extrabold text-panggung-tinta tabular-nums"
                aria-label={t("belajar.unitLabel", { number: u.number })}
              >
                {u.number}
              </span>
            }
          />
        ))}
      </ListGroup>
    </>
  );
}
