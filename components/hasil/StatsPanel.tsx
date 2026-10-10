import { getTranslations } from "next-intl/server";
import type { ClassStatistics, Maybe } from "@/lib/analysis";
import { fmt, fmtP } from "./format";

/** FR-51 / PRD §7.1, §7.3: kartu angka statistik berpasangan. */
export async function StatsPanel({ s }: { s: ClassStatistics }) {
  const t = await getTranslations("riset.stats");
  const th = await getTranslations("hasil");
  const p = (x: number) => (x < 0.001 ? th("pLess") : th("pValue", { p: fmtP(x) }));
  const card = <T,>(title: string, m: Maybe<T>, body: (v: T) => React.ReactNode, testId: string) => (
    <div className="flex flex-col gap-1 rounded-panel border border-garis bg-permukaan p-4" data-testid={testId}>
      <h3 className="text-[1rem] font-bold">{title}</h3>
      {m.ok ? <div className="flex flex-col gap-0.5 tabular-nums">{body(m.value)}</div> : <p className="text-tinta-2">{t("unavailable")}</p>}
    </div>
  );
  const big = (x: string) => <span className="font-judul text-[1.4rem] font-extrabold leading-tight">{x}</span>;
  const note = (x: string) => <span className="text-[0.88rem] text-tinta-2">{x}</span>;
  const kr = s.kr20Pre.ok && s.kr20Post.ok ? ({ ok: true, value: { pre: s.kr20Pre.value.kr20, post: s.kr20Post.value.kr20 } } as const) : ({ ok: false, reason: "kr20" } as const);
  return (
    <div className="flex flex-col gap-3">
      <p className="font-semibold">{t("n", { n: s.n })}</p>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {card(t("ngain"), s.nGain, (v) => (
          <>
            {big(`${fmt(v.mean, 2)} · ${th(`ngainCategory.${v.category}`)}`)}
            {note(t("ngainValue", { mean: fmt(v.mean, 4), sd: fmt(v.sd, 4) }))}
            {note(t("ci", { lower: fmt(v.ci.lower, 4), upper: fmt(v.ci.upper, 4) }))}
            {note(t("ngainCats", { tinggi: s.nGainCategories.tinggi, sedang: s.nGainCategories.sedang, rendah: s.nGainCategories.rendah }))}
            {note(t("ngainExcluded", { n: v.excludedPreMax }))}
          </>
        ), "stat-ngain")}
        {card(t("ttest"), s.tTest, (v) => (
          <>
            {big(t("ttestValue", { df: v.df, t: fmt(v.t, 3) }))}
            {note(p(v.p))}
            {note(t("meanDiff", { d: fmt(v.meanDiff, 2), lower: fmt(v.ciDiff.lower, 2), upper: fmt(v.ciDiff.upper, 2) }))}
          </>
        ), "stat-ttest")}
        {card(t("effect"), s.tTest, (v) => (
          <>
            {big(`d_z = ${fmt(v.cohenDz, 3)}`)}
            {note(t("effectValue", { g: fmt(v.hedgesGz, 3) }))}
            {s.wilcoxon.ok ? note(t("wilcoxonR", { r: fmt(s.wilcoxon.value.r, 3) })) : null}
          </>
        ), "stat-effect")}
        {card(t("wilcoxon"), s.wilcoxon, (v) => (
          <>
            {big(t("wilcoxonValue", { w: fmt(v.W, 1), z: fmt(v.z, 3) }))}
            {note(`${p(v.p)} · ${t(`method.${v.method}`)}`)}
          </>
        ), "stat-wilcoxon")}
        {card(t("shapiro"), s.shapiro, (v) => (
          <>
            {big(t("shapiroValue", { w: fmt(v.W, 4) }))}
            {note(p(v.p))}
          </>
        ), "stat-shapiro")}
        {card(t("kr20"), kr, (v) => (
          <>
            {big(t("kr20Value", { pre: fmt(v.pre, 3), post: fmt(v.post, 3) }))}
            {note(t("kr20Note"))}
          </>
        ), "stat-kr20")}
        {card(t("descriptive"), s.descriptive, (v) => (
          <>{big(t("descriptiveValue", { pre: fmt(v.preMean, 1), preSd: fmt(v.preSd, 1), post: fmt(v.postMean, 1), postSd: fmt(v.postSd, 1) }))}</>
        ), "stat-descriptive")}
      </div>
    </div>
  );
}
