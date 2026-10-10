import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Download, Info } from "lucide-react";
import { CATEGORIES } from "@/lib/classification";
import type { ClassAnalysis, ItemMapRow } from "@/lib/analysis";
import type { Phase } from "@/lib/tes/types";
import { buttonClass } from "@/components/ui/Button";
import { CategoryIcon, Swatch } from "./CategoryBars";
import { fmt, fmtPct } from "./format";

/** FR-46: catatan interpretasi permanen. */
export async function InterpretationNote() {
  const t = await getTranslations("hasil");
  return (
    <aside role="note" aria-label={t("interpretationTitle")} className="flex gap-3 rounded-panel border-2 border-laut bg-permukaan p-4" data-testid="interpretation-note">
      <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-laut-teks" />
      <p>{t("interpretation")}</p>
    </aside>
  );
}

export async function ParticipationNote({ a }: { a: ClassAnalysis }) {
  const t = await getTranslations("hasil.population");
  const p = a.participation;
  const excluded = Object.entries(p.excludedByReason).filter(([, n]) => n > 0);
  return (
    <div className="flex flex-col gap-2" data-testid="participation">
      <p className="font-semibold">
        {p.population === "paired" ? t("paired", { n: p.paired.length }) : t("per_phase", { pre: p.phaseStudents.pre.length, post: p.phaseStudents.post.length })}
      </p>
      <div className="text-tinta-2">
        <span>{t("excludedTitle")}: </span>
        {excluded.length === 0 ? t("noneExcluded") : excluded.map(([k, n]) => t(`excluded.${k}` as "excluded.consent_pending", { n })).join(" · ")}
      </div>
    </div>
  );
}

/** FR-45: tiga butir dengan miskonsepsi terbanyak. */
export async function DiscussList({ a }: { a: ClassAnalysis }) {
  const t = await getTranslations("hasil");
  const d = a.discuss;
  if (!d) return null;
  return (
    <section aria-labelledby="dibahas" className="flex flex-col gap-3" data-testid="discuss">
      <h2 id="dibahas" className="text-[1.5rem] font-bold">{t("discuss.title")}</h2>
      <p className="text-tinta-2">{t("discuss.lead", { phase: t(`phase.${d.phase}`).toLowerCase() })}</p>
      {d.rows.length === 0 ? (
        <p>{t("discuss.none")}</p>
      ) : (
        <ol className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-3">
          {d.rows.map((r) => (
            <li key={r.item.id} className="flex flex-col gap-2 rounded-panel border border-garis bg-permukaan p-4">
              <div className="flex flex-col gap-1">
                <h3 className="text-[1.1rem] font-bold">{t("discuss.item", { code: r.item.code })}</h3>
                <span className="inline-flex items-center gap-1 text-[0.9rem] font-semibold">
                  <CategoryIcon c="M" className="size-4 text-m" />
                  {t("discuss.mCount", { n: r.counts.M, pct: fmtPct(r.percentM, 0) })}
                </span>
              </div>
              {r.item.indicator ? <p className="font-semibold">{r.item.indicator}</p> : null}
              {r.item.alternativeConceptions ? (
                <p className="text-[0.95rem]">
                  <span className="text-tinta-2">{t("discuss.alternative")}: </span>
                  {r.item.alternativeConceptions}
                </p>
              ) : null}
              {r.item.scientificConcept ? (
                <p className="text-[0.95rem]">
                  <span className="text-tinta-2">{t("discuss.scientific")}: </span>
                  {r.item.scientificConcept}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function CategoryStrip({ r }: { r: ItemMapRow }) {
  return (
    <span className="flex flex-wrap gap-x-2 gap-y-0.5 text-[0.8rem] tabular-nums text-tinta-2">
      {CATEGORIES.map((c) => (
        <span key={c} className="inline-flex items-center gap-1">
          <Swatch c={c} />
          {c} {r.counts[c]}
        </span>
      ))}
    </span>
  );
}

/** FR-43: peta butir; tes dipilih lewat tautan (?fase=). */
export async function ItemMap({ a, phase, hrefFor, domainLabel }: { a: ClassAnalysis; phase: Phase; hrefFor: (p: Phase) => string; domainLabel: (id: string) => string }) {
  const t = await getTranslations("hasil");
  const rows = a.itemMap[phase];
  const hasData = rows.some((r) => r.n > 0);
  return (
    <section aria-labelledby="peta-butir" className="flex flex-col gap-3" data-testid="item-map">
      <h2 id="peta-butir" className="text-[1.5rem] font-bold">{t("itemMap.title")}</h2>
      <p className="text-tinta-2">{t("itemMap.lead")}</p>
      <nav aria-label={t("itemMap.switchLabel")} className="flex gap-2">
        {(["pre", "post"] as const).map((p) => (
          <Link
            key={p}
            href={hrefFor(p)}
            scroll={false}
            aria-current={p === phase ? "page" : undefined}
            className={`inline-flex min-h-12 items-center rounded-full border-2 px-4 font-semibold no-underline ${p === phase ? "border-tinta bg-tinta text-permukaan" : "border-garis bg-permukaan text-tinta"}`}
          >
            {t(`phase.${p}`)}
          </Link>
        ))}
      </nav>
      {!hasData ? (
        <p>{t("itemMap.noData")}</p>
      ) : (
        <div tabIndex={0} role="region" aria-label={t("itemMap.title")} className="overflow-x-auto rounded-panel border border-garis bg-permukaan">
          <table className="w-full min-w-[52rem] border-collapse text-left text-[0.92rem]">
            <thead>
              <tr className="border-b border-garis bg-kertas">
                <th scope="col" className="p-3">{t("itemMap.code")}</th>
                <th scope="col" className="p-3">{t("itemMap.target")}</th>
                <th scope="col" className="p-3">{t("itemMap.m")}</th>
                <th scope="col" className="p-3">{t("itemMap.topTier1")}</th>
                <th scope="col" className="p-3">{t("itemMap.topReason")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.item.id} className="border-b border-garis align-top last:border-0" data-testid={`item-row-${r.item.code}`}>
                  <th scope="row" className="p-3">
                    <span className="block font-bold">{r.item.code}</span>
                    <span className="block text-[0.8rem] font-normal text-tinta-2">{domainLabel(r.item.conceptDomain)}</span>
                  </th>
                  <td className="max-w-[22rem] p-3">
                    {r.item.misconceptionCode ? <span className="block font-mono text-[0.8rem] text-tinta-2">{r.item.misconceptionCode}</span> : null}
                    {r.item.alternativeConceptions ?? r.item.indicator ?? "—"}
                  </td>
                  <td className="p-3 tabular-nums">
                    <span className="block font-bold">{fmtPct(r.percentM, 0)}</span>
                    <span className="block text-[0.8rem] text-tinta-2">
                      {r.counts.M}/{r.n}
                    </span>
                    <CategoryStrip r={r} />
                  </td>
                  <td className="max-w-[16rem] p-3">
                    {r.topTier1 ? (
                      <>
                        <span className="block">{r.topTier1.text}</span>
                        <span className="block text-[0.8rem] tabular-nums text-tinta-2">{t("itemMap.count", { key: r.topTier1.key, n: r.topTier1.count, pct: fmtPct(r.topTier1.percent, 0) })}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="max-w-[18rem] p-3">
                    {r.topReason ? (
                      <>
                        <span className="block">{r.topReason.text}</span>
                        <span className="block text-[0.8rem] tabular-nums text-tinta-2">{t("itemMap.count", { key: r.topReason.key, n: r.topReason.count, pct: fmtPct(r.topReason.percent, 0) })}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** FR-44: profil per siswa (kode + nama panggilan; hanya untuk guru kelas). */
export async function StudentProfiles({ a, domains: order }: { a: ClassAnalysis; domains: readonly { id: string; label: string }[] }) {
  const t = await getTranslations("hasil");
  const idx = (id: string) => order.findIndex((d) => d.id === id);
  const domains = (a.students[0]?.domains.map((d) => d.domain) ?? []).sort((x, y) => idx(x) - idx(y));
  const domainLabel = (id: string) => order.find((d) => d.id === id)?.label ?? id;
  const score = (x: number | null) => (x === null ? t("students.notYet") : fmt(x, 0));
  return (
    <section aria-labelledby="profil-siswa" className="flex flex-col gap-3" data-testid="student-profiles">
      <h2 id="profil-siswa" className="text-[1.5rem] font-bold">{t("students.title")}</h2>
      <p className="text-tinta-2">{t("students.lead")}</p>
      <div tabIndex={0} role="region" aria-label={t("students.title")} className="overflow-x-auto rounded-panel border border-garis bg-permukaan">
        <table className="w-full min-w-[48rem] border-collapse text-left text-[0.92rem] tabular-nums">
          <thead>
            <tr className="border-b border-garis bg-kertas">
              <th scope="col" className="p-3">{t("students.code")}</th>
              <th scope="col" className="p-3">{t("students.pre")}</th>
              <th scope="col" className="p-3">{t("students.post")}</th>
              <th scope="col" className="p-3">{t("students.ngain")}</th>
              {domains.map((d) => (
                <th key={d} scope="col" className="p-3">{domainLabel(d)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {a.students.map((s) => (
              <tr key={s.student.id} className="border-b border-garis align-top last:border-0" data-testid={`student-${s.student.code}`}>
                <th scope="row" className="p-3">
                  <span className="block font-bold">{s.student.code}</span>
                  {s.student.nickname ? <span className="block font-normal text-tinta-2">{s.student.nickname}</span> : null}
                  <details className="mt-1 font-normal">
                    <summary aria-label={t("students.details", { code: s.student.code })} className="min-h-12 cursor-pointer content-center text-laut-teks">
                      {t("students.detailsShort")}
                    </summary>
                    <ul className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-[0.85rem] sm:grid-cols-4">
                      {s.items.map((i) => (
                        <li key={i.item.id}>
                          <span className="font-semibold">{i.item.code}</span> {i.pre ?? "–"} → {i.post ?? "–"}
                        </li>
                      ))}
                    </ul>
                  </details>
                </th>
                <td className="p-3">{score(s.scorePre)}</td>
                <td className="p-3">{score(s.scorePost)}</td>
                <td className="p-3">{s.nGain === null ? "—" : `${fmt(s.nGain, 2)} (${t(`ngainCategory.${s.nGainCategory!}`)})`}</td>
                {[...s.domains].sort((x, y) => idx(x.domain) - idx(y.domain)).map((d) => (
                  <td key={d.domain} className="p-3">
                    {d.pre || d.post ? (
                      <>
                        <span className="block font-semibold">{t("students.transition", { pre: d.pre ?? "–", post: d.post ?? "–" })}</span>
                        {d.pattern ? <span className="block text-[0.8rem] text-tinta-2">{t(`pattern.${d.pattern}`)}</span> : null}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Tautan unduh (rute /api/riset/ekspor; otorisasi di server). */
export async function ExportLinks({ classId, json = false, query = "" }: { classId: string | null; json?: boolean; query?: string }) {
  const t = await getTranslations("hasil.export");
  const q = (extra: string) => `/api/riset/ekspor?${classId ? `kelas=${encodeURIComponent(classId)}&` : ""}${query ? `${query}&` : ""}${extra}`;
  const links: [string, string][] = [
    [q("format=csv&tabel=responses_long"), t("long")],
    [q("format=csv&tabel=scores_wide"), t("wide")],
    [q("format=xlsx"), t("xlsx")],
    ...(json ? ([[q("format=json"), t("json")]] as [string, string][]) : []),
  ];
  return (
    <ul className="flex flex-wrap gap-3">
      {links.map(([href, label]) => (
        <li key={href}>
          <a href={href} download className={buttonClass({ variant: "kedua", size: "kecil", block: false })}>
            <Download aria-hidden="true" className="size-5" />
            {label}
          </a>
        </li>
      ))}
    </ul>
  );
}
