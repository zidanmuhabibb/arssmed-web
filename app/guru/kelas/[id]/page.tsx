import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Users } from "lucide-react";
import { ImportPanel } from "@/components/guru/ImportPanel";
import { StudentTable } from "@/components/guru/StudentTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { getBackend, requireStaff } from "@/lib/backend";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("guru.class");
  return { title: t("studentsTitle") };
}

export default function KelasDetailPage({ params }: PageProps<"/guru/kelas/[id]">) {
  return (
    <Suspense fallback={<ListSkeleton rows={4} />}>
      <ClassDetail params={params} />
    </Suspense>
  );
}

async function ClassDetail({ params }: { params: PageProps<"/guru/kelas/[id]">["params"] }) {
  await requireStaff();
  const { id } = await params;
  const t = await getTranslations("guru");
  const backend = getBackend();
  const cls = await backend.getClass(id);
  if (!cls) notFound();
  const students = await backend.listStudents(cls.id);

  return (
    <>
      <PageHeader title={cls.name} lead={`${t(`mode.${cls.mode}`)} — ${t(`mode.${cls.mode}Hint`)}`} back={{ href: "/guru/kelas", label: t("class.back") }} />
      <div className="mb-8 inline-flex flex-col rounded-panel bg-panggung px-6 py-4 text-panggung-tinta">
        <span className="text-[0.875rem] text-panggung-tinta-2">{t("class.joinCodeLabel")}</span>
        <span className="font-mono text-[2rem] font-bold tracking-[0.2em]" data-testid="join-code">
          {cls.joinCode}
        </span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] xl:items-start">
        <section aria-labelledby="daftar-siswa" className="flex min-w-0 flex-col gap-4">
          <h2 id="daftar-siswa" className="text-[1.5rem] font-bold">
            {t("class.studentsTitle")} <span className="text-tinta-2 tabular-nums">({students.length})</span>
          </h2>
          {students.length === 0 ? (
            <EmptyState icon={<Users className="size-7" />} title={t("class.studentsTitle")} body={t("class.empty")} />
          ) : (
            <StudentTable students={students} className={cls.name} joinCode={cls.joinCode} />
          )}
        </section>
        <ImportPanel classId={cls.id} className={cls.name} joinCode={cls.joinCode} />
      </div>
    </>
  );
}
