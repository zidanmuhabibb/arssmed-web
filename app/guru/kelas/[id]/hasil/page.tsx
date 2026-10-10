import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { BarChart3 } from "lucide-react";
import { CategoryBars } from "@/components/hasil/CategoryBars";
import { DiscussList, ExportLinks, InterpretationNote, ItemMap, ParticipationNote, StudentProfiles } from "@/components/hasil/Sections";
import { fmt } from "@/components/hasil/format";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { analyze } from "@/lib/analysis";
import { ANALYSIS_CONFIG } from "@/lib/classification";
import { BackendError, getBackend, requireStaff } from "@/lib/backend";
import { isPhase } from "@/lib/tes/types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("hasil");
  return { title: t("metaTitle") };
}

export default function HasilPage({ params, searchParams }: PageProps<"/guru/kelas/[id]/hasil">) {
  return (
    <Suspense fallback={<ListSkeleton rows={5} />}>
      <Hasil params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Hasil({ params, searchParams }: Pick<PageProps<"/guru/kelas/[id]/hasil">, "params" | "searchParams">) {
  await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const t = await getTranslations("hasil");
  const backend = getBackend();
  const cls = await backend.getClass(id);
  if (!cls) notFound();
  const header = <PageHeader title={t("title", { name: cls.name })} lead={t("lead")} back={{ href: `/guru/kelas/${cls.id}`, label: t("back") }} />;
  if (cls.mode !== "research") {
    return (
      <>
        {header}
        <EmptyState icon={<BarChart3 className="size-7" />} title={t("empty.title")} body={t("learnOnly")} />
      </>
    );
  }
  const ds = await backend.analysisDataset(cls.id).catch((e: unknown) => {
    if (e instanceof BackendError && (e.code === "not_found" || e.code === "forbidden")) notFound();
    throw e;
  });
  const a = analyze(ds, { scoreMethod: ANALYSIS_CONFIG.score_method, transitionMode: ANALYSIS_CONFIG.transition_mode, taxonomy: ANALYSIS_CONFIG.domain_taxonomy });
  const label = (d: string) => ds.domains.find((x) => x.id === d)?.label ?? d;
  const faseParam = typeof sp.fase === "string" && isPhase(sp.fase) ? sp.fase : null;
  const phase = faseParam ?? (a.itemMap.post.some((r) => r.n > 0) ? "post" : "pre");

  if (a.participation.population === "none") {
    return (
      <>
        {header}
        <EmptyState icon={<BarChart3 className="size-7" />} title={t("empty.title")} body={t("empty.body")} />
      </>
    );
  }

  const s = a.statistics;
  const card = (label: string, value: string, note?: string, testId?: string) => (
    <div className="flex flex-col gap-1 rounded-panel border border-garis bg-permukaan p-4" data-testid={testId}>
      <span className="text-[0.9rem] text-tinta-2">{label}</span>
      <span className="font-judul text-[1.8rem] font-extrabold leading-tight tabular-nums">{value}</span>
      {note ? <span className="text-[0.85rem] text-tinta-2 tabular-nums">{note}</span> : null}
    </div>
  );

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        {header}
        <InterpretationNote />
        <ParticipationNote a={a} />
      </div>

      <section aria-labelledby="ringkasan" className="flex flex-col gap-3">
        <h2 id="ringkasan" className="text-[1.5rem] font-bold">{t("summary.title")}</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {card(t("summary.n"), String(s.n), undefined, "summary-n")}
          {card(t("summary.pre"), s.descriptive.ok ? fmt(s.descriptive.value.preMean) : t("summary.na"))}
          {card(t("summary.post"), s.descriptive.ok ? fmt(s.descriptive.value.postMean) : t("summary.na"))}
          {card(
            t("summary.ngain"),
            s.nGain.ok ? `${fmt(s.nGain.value.mean, 2)} (${t(`ngainCategory.${s.nGain.value.category}`)})` : t("summary.na"),
            s.nGain.ok ? t("summary.ngainCi", { lower: fmt(s.nGain.value.ci.lower, 2), upper: fmt(s.nGain.value.ci.upper, 2) }) : undefined,
            "summary-ngain",
          )}
        </div>
        <p className="text-[0.9rem] text-tinta-2">{a.options.scoreMethod === "score_sc" ? t("summary.scoreNote") : t("summary.scoreNoteTier1")}</p>
      </section>

      <DiscussList a={a} />

      <section aria-labelledby="profil-kelas" className="flex flex-col gap-3">
        <h2 id="profil-kelas" className="text-[1.5rem] font-bold">{t("profile.title")}</h2>
        <p className="text-tinta-2">{t("profile.lead")}</p>
        <CategoryBars distribution={a.distribution} domains={ds.domains} />
      </section>

      <ItemMap a={a} phase={phase} hrefFor={(p) => `/guru/kelas/${cls.id}/hasil?fase=${p}#peta-butir`} domainLabel={label} />

      <StudentProfiles a={a} domains={ds.domains} />

      <section aria-labelledby="unduh" className="flex flex-col gap-3">
        <h2 id="unduh" className="text-[1.5rem] font-bold">{t("export.title")}</h2>
        <p className="text-tinta-2">{t("export.lead")}</p>
        <ExportLinks classId={cls.id} />
      </section>
    </div>
  );
}
