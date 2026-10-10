import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { FlaskConical } from "lucide-react";
import { CategoryBars } from "@/components/hasil/CategoryBars";
import { ExportLinks, InterpretationNote, ParticipationNote } from "@/components/hasil/Sections";
import { StatsPanel } from "@/components/hasil/StatsPanel";
import { TransitionDiagram } from "@/components/hasil/TransitionDiagram";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { analyze } from "@/lib/analysis";
import { RULE_SETS } from "@/lib/classification";
import { NAME_MAP_CONFIRMATION, parseAnalysisQuery } from "@/lib/analysis/options";
import { BackendError, getBackend, requireStaff } from "@/lib/backend";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("riset");
  return { title: t("metaTitle") };
}

export default function RisetPage({ searchParams }: PageProps<"/riset">) {
  return (
    <Suspense fallback={<ListSkeleton rows={5} />}>
      <Riset searchParams={searchParams} />
    </Suspense>
  );
}

const selectClass =
  "min-h-12 w-full rounded-kontrol border-2 border-garis bg-permukaan px-3 text-tinta focus-visible:border-laut sm:w-auto";

async function Riset({ searchParams }: Pick<PageProps<"/riset">, "searchParams">) {
  const viewer = await requireStaff();
  const t = await getTranslations("riset");
  const th = await getTranslations("hasil");
  if (viewer.role !== "admin") {
    return (
      <>
        <PageHeader title={t("title")} />
        <EmptyState icon={<FlaskConical className="size-7" />} title={t("title")} body={t("adminOnly")} />
      </>
    );
  }
  const sp = await searchParams;
  const { classId, ruleSetId, options } = parseAnalysisQuery(sp);
  const backend = getBackend();
  const classes = (await backend.listClasses()).filter((c) => c.mode === "research");
  const ds = await backend.analysisDataset(classId, ruleSetId).catch((e: unknown) => {
    if (e instanceof BackendError && (e.code === "not_found" || e.code === "forbidden")) notFound();
    throw e;
  });
  const a = analyze(ds, options);
  const label = (d: string) => ds.domains.find((x) => x.id === d)?.label ?? d;
  const pseudo = new Map(ds.students.map((s) => [s.id, s.pseudoId]));

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <PageHeader title={t("title")} lead={t("lead")} />
        <InterpretationNote />
      </div>

      <form method="get" action="/riset" className="flex flex-col gap-4 rounded-panel border border-garis bg-permukaan p-4" aria-labelledby="pengaturan">
        <h2 id="pengaturan" className="text-[1.2rem] font-bold">{t("filters.title")}</h2>
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="flex flex-col gap-1">
            <span className="font-semibold">{t("filters.scope")}</span>
            <select name="kelas" defaultValue={classId ?? ""} className={selectClass}>
              <option value="">{t("filters.all")}</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold">{t("filters.score")}</span>
            <select name="skor" defaultValue={options.scoreMethod} className={selectClass}>
              <option value="score_sc">{t("filters.score_sc")}</option>
              <option value="score_tier1">{t("filters.score_tier1")}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold">{t("filters.transition")}</span>
            <select name="transisi" defaultValue={options.transitionMode} className={selectClass}>
              <option value="per_butir">{t("filters.per_butir")}</option>
              <option value="modus">{t("filters.modus")}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold">{t("filters.ruleSet")}</span>
            <select name="aturan" defaultValue={ds.ruleSetId} className={selectClass}>
              {Object.keys(RULE_SETS).map((id) => (
                <option key={id} value={id}>
                  {id === ds.testRuleSetId ? t("filters.ruleSetDefault", { id }) : id}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={buttonClass({ variant: "utama", size: "kecil", block: false })}>
            {t("filters.apply")}
          </button>
        </div>
        <p className="text-[0.9rem] text-tinta-2">{t("config", { ruleSet: ds.ruleSetId, test: ds.testName, version: ds.testVersion })}</p>
      </form>

      {typeof sp.reklasifikasi === "string" ? (
        <p role="status" className="rounded-kontrol border-2 border-sc bg-permukaan p-3 font-semibold" data-testid="reclassified">
          {t("reclassify.done", { n: Number(sp.reklasifikasi) || 0, ruleSet: ds.ruleSetId })}
        </p>
      ) : null}
      {ds.unclassified > 0 || ds.ruleSetId !== ds.testRuleSetId ? (
        <form method="post" action="/api/riset/reklasifikasi" className="flex flex-col gap-3 rounded-panel border border-garis bg-permukaan p-4 sm:flex-row sm:items-center" data-testid="reclassify">
          <input type="hidden" name="aturan" value={ds.ruleSetId} />
          <input type="hidden" name="kelas" value={classId ?? ""} />
          <input type="hidden" name="skor" value={options.scoreMethod} />
          <input type="hidden" name="transisi" value={options.transitionMode} />
          <p className="flex-1">{ds.unclassified > 0 ? t("reclassify.needed", { n: ds.unclassified, ruleSet: ds.ruleSetId }) : t("reclassify.again", { ruleSet: ds.ruleSetId })}</p>
          <button type="submit" className={buttonClass({ variant: "kedua", size: "kecil", block: false })}>
            {t("reclassify.submit")}
          </button>
        </form>
      ) : null}

      <ParticipationNote a={a} />

      <section aria-labelledby="statistik" className="flex flex-col gap-3">
        <h2 id="statistik" className="text-[1.5rem] font-bold">{t("stats.title")}</h2>
        <StatsPanel s={a.statistics} />
      </section>

      <section aria-labelledby="transisi" className="flex flex-col gap-3">
        <h2 id="transisi" className="text-[1.5rem] font-bold">{t("transitions.title")}</h2>
        <p className="text-tinta-2">{t("transitions.lead")}</p>
        {a.transitions.length === 0 ? (
          <p>{t("transitions.none")}</p>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-2">
            {[...a.transitions].sort((x, y) => ds.domains.findIndex((d) => d.id === x.domain) - ds.domains.findIndex((d) => d.id === y.domain)).map((tr) => (
              <TransitionDiagram key={tr.domain} t={tr} label={label(tr.domain)} pseudo={(id) => pseudo.get(id) ?? "?"} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="distribusi" className="flex flex-col gap-3">
        <h2 id="distribusi" className="text-[1.5rem] font-bold">{t("distribution.title")}</h2>
        <p className="text-tinta-2">{th("profile.lead")}</p>
        <CategoryBars distribution={a.distribution} domains={ds.domains} />
      </section>

      <section aria-labelledby="ekspor" className="flex flex-col gap-3">
        <h2 id="ekspor" className="text-[1.5rem] font-bold">{t("export.title")}</h2>
        <p className="text-tinta-2">{t("export.lead")}</p>
        <ExportLinks classId={classId} json query={`skor=${options.scoreMethod}&transisi=${options.transitionMode}${ruleSetId ? `&aturan=${ruleSetId}` : ""}`} />
      </section>

      <section aria-labelledby="pemetaan" className="flex flex-col gap-3 rounded-panel border-2 border-m bg-permukaan p-5" data-testid="name-map">
        <h2 id="pemetaan" className="text-[1.3rem] font-bold">{t("nameMap.title")}</h2>
        <p className="max-w-[65ch]">{t("nameMap.lead")}</p>
        <form method="post" action="/api/riset/pemetaan" className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <input type="hidden" name="kelas" value={classId ?? ""} />
          <label className="flex flex-1 flex-col gap-1">
            <span className="font-semibold">{t("nameMap.confirmLabel", { phrase: NAME_MAP_CONFIRMATION })}</span>
            <input name="confirm" required autoComplete="off" pattern={NAME_MAP_CONFIRMATION} className="min-h-12 rounded-kontrol border-2 border-garis bg-permukaan px-3 text-tinta focus-visible:border-laut" />
          </label>
          <button type="submit" className={buttonClass({ variant: "bahaya", size: "kecil", block: false })}>
            {t("nameMap.submit")}
          </button>
        </form>
      </section>
    </div>
  );
}
