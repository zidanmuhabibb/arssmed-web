import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { School } from "lucide-react";
import { CreateClassForm } from "@/components/guru/CreateClassForm";
import { ModeBadge } from "@/components/guru/ModeBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { PageHeader } from "@/components/ui/PageHeader";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { getBackend, requireStaff } from "@/lib/backend";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("guru.classes");
  return { title: t("title") };
}

export default async function KelasPage() {
  const t = await getTranslations("guru");
  return (
    <>
      <PageHeader title={t("classes.title")} lead={t("classes.lead")} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
        <Suspense fallback={<ListSkeleton rows={3} />}>
          <ClassList />
        </Suspense>
        <section aria-labelledby="buat-kelas" className="rounded-panel border border-garis bg-permukaan p-5 sm:p-6">
          <h2 id="buat-kelas" className="mb-4 text-[1.4rem] font-bold">
            {t("classes.create.title")}
          </h2>
          <CreateClassForm />
        </section>
      </div>
    </>
  );
}

async function ClassList() {
  await requireStaff();
  const t = await getTranslations("guru");
  const classes = await getBackend().listClasses();
  if (classes.length === 0) {
    return <EmptyState icon={<School className="size-7" />} title={t("classes.title")} body={t("classes.empty")} />;
  }
  return (
    <ListGroup>
      {classes.map((c) => (
        <ListRow
          key={c.id}
          href={`/guru/kelas/${c.id}`}
          title={c.name}
          hint={`${t("classes.joinCode")} ${c.joinCode} · ${t("classes.students", { count: c.studentCount })}`}
          trailing={<ModeBadge mode={c.mode} />}
        />
      ))}
    </ListGroup>
  );
}
