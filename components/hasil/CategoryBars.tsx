import { getTranslations } from "next-intl/server";
import { AlertTriangle, BadgeCheck, CircleDashed, CircleHelp, CircleSlash } from "lucide-react";
import { CATEGORIES, type Category, type DomainDistribution } from "@/lib/classification";
import type { Phase } from "@/lib/tes/types";
import { categoryStyle } from "./category-style";
import { fmtPct } from "./format";

const ICON: Record<Category, typeof BadgeCheck> = { SC: BadgeCheck, M: AlertTriangle, E: CircleSlash, LK: CircleHelp, LC: CircleDashed };

export function CategoryIcon({ c, className = "size-4" }: { c: Category; className?: string }) {
  const I = ICON[c];
  return <I aria-hidden="true" className={className} />;
}

export function Swatch({ c }: { c: Category }) {
  return <span aria-hidden="true" className="inline-block size-4 shrink-0 rounded-[4px] border border-garis" style={categoryStyle(c)} />;
}

/** Keterangan: warna + pola + ikon + kode + nama. */
export async function CategoryLegend() {
  const t = await getTranslations("hasil");
  return (
    <ul aria-label={t("profile.legend")} className="flex flex-wrap gap-x-5 gap-y-2 text-[0.95rem]">
      {CATEGORIES.map((c) => (
        <li key={c} className="flex items-center gap-2">
          <Swatch c={c} />
          <CategoryIcon c={c} />
          <span>
            <strong>{c}</strong> {t(`category.${c}`)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** FR-42 / PRD §7.3: batang bertumpuk 100% per domain, tes awal dan akhir berdampingan. */
export async function CategoryBars({ distribution, domains: order }: { distribution: Record<Phase, DomainDistribution[]>; domains: readonly { id: string; label: string }[] }) {
  const t = await getTranslations("hasil");
  const present = new Set([...distribution.pre, ...distribution.post].map((d) => d.domain));
  const domains = order.filter((d) => present.has(d.id)).map((d) => d.id);
  const domainLabel = (id: string) => order.find((d) => d.id === id)?.label ?? id;
  return (
    <div className="flex flex-col gap-6">
      <CategoryLegend />
      {domains.map((domain) => (
        <section key={domain} aria-label={domainLabel(domain)} className="flex flex-col gap-3" data-testid={`bars-${domain}`}>
          <h3 className="text-[1.1rem] font-bold">{domainLabel(domain)}</h3>
          {(["pre", "post"] as const).map((phase) => {
            const d = distribution[phase].find((x) => x.domain === domain);
            if (!d) return null;
            const parts = CATEGORIES.map((c) => `${c} ${fmtPct(d.percent[c])}`).join(", ");
            return (
              <div key={phase} className="grid grid-cols-[minmax(0,1fr)] gap-1 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:items-center sm:gap-3">
                <span className="text-[0.95rem] font-semibold text-tinta-2">{t(`phase.${phase}`)}</span>
                <div className="flex flex-col gap-1">
                  <div
                    role="img"
                    aria-label={t("profile.barLabel", { domain: domainLabel(domain), phase: t(`phase.${phase}`), parts })}
                    className="flex h-7 w-full overflow-hidden rounded-[8px] border border-garis"
                  >
                    {CATEGORIES.map((c) => (d.percent[c] > 0 ? <span key={c} style={{ ...categoryStyle(c), width: `${d.percent[c]}%` }} /> : null))}
                  </div>
                  <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-[0.85rem] tabular-nums text-tinta-2" data-testid={`bar-values-${domain}-${phase}`}>
                    {CATEGORIES.map((c) => (
                      <span key={c} className="inline-flex items-center gap-1">
                        <Swatch c={c} />
                        <span>
                          {c} {fmtPct(d.percent[c])}
                        </span>
                      </span>
                    ))}
                    <span>· {t("profile.nResponses", { n: d.nResponses })}</span>
                  </p>
                  {!d.denominatorConsistent ? <p className="text-[0.85rem] text-tinta-2">{t("profile.inconsistent")}</p> : null}
                </div>
              </div>
            );
          })}
        </section>
      ))}
      <details className="rounded-kontrol border border-garis bg-permukaan p-3">
        <summary className="min-h-12 cursor-pointer content-center font-semibold">{t("profile.asTable")}</summary>
        <div tabIndex={0} role="region" aria-label={t("profile.asTable")} className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-left text-[0.9rem] tabular-nums">
            <thead>
              <tr className="border-b border-garis">
                <th scope="col" className="p-2">{t("profile.domain")}</th>
                <th scope="col" className="p-2">{t("profile.phase")}</th>
                {CATEGORIES.map((c) => (
                  <th key={c} scope="col" className="p-2">{c}</th>
                ))}
                <th scope="col" className="p-2">n</th>
              </tr>
            </thead>
            <tbody>
              {domains.flatMap((domain) =>
                (["pre", "post"] as const).map((phase) => {
                  const d = distribution[phase].find((x) => x.domain === domain);
                  if (!d) return null;
                  return (
                    <tr key={`${domain}-${phase}`} className="border-b border-garis last:border-0">
                      <th scope="row" className="p-2 font-normal">{domainLabel(domain)}</th>
                      <td className="p-2">{t(`phase.${phase}`)}</td>
                      {CATEGORIES.map((c) => (
                        <td key={c} className="p-2">
                          {fmtPct(d.percent[c])} ({d.counts[c]})
                        </td>
                      ))}
                      <td className="p-2">{d.nResponses}</td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
