import { getTranslations } from "next-intl/server";
import { CATEGORIES, type Category } from "@/lib/classification";
import { PATTERNS, transitionPattern, type DomainTransitions } from "@/lib/transitions";
import { categoryColor } from "./category-style";
import { fmtPct } from "./format";

const W = 320;
const H = 260;
const NODE_W = 16;
const GAP = 10;
const LEFT = 58;
const RIGHT = W - 58 - NODE_W;

/** Tata letak simpul: tinggi sebanding jumlah, urutan CATEGORIES, celah tetap. */
function layout(counts: Record<Category, number>, total: number) {
  const present = CATEGORIES.filter((c) => counts[c] > 0);
  const usable = H - GAP * Math.max(0, present.length - 1);
  let y = 0;
  const pos = {} as Record<Category, { y: number; h: number }>;
  for (const c of CATEGORIES) {
    const h = total ? (counts[c] / total) * usable : 0;
    pos[c] = { y, h };
    if (counts[c] > 0) y += h + GAP;
  }
  return pos;
}

/**
 * FR-52 / PRD §7.3: diagram kotak-pita pre → post per domain. Padanan aksesibelnya adalah
 * tabel transisi di bawah diagram (angka yang sama).
 */
export async function TransitionDiagram({ t: tr, label, pseudo }: { t: DomainTransitions; label: string; pseudo: (studentId: string) => string }) {
  const t = await getTranslations("riset.transitions");
  const th = await getTranslations("hasil");
  const total = tr.nUnits;
  const preCounts = Object.fromEntries(CATEGORIES.map((c) => [c, CATEGORIES.reduce((s, d) => s + tr.matrix[c][d].length, 0)])) as Record<Category, number>;
  const postCounts = Object.fromEntries(CATEGORIES.map((c) => [c, CATEGORIES.reduce((s, d) => s + tr.matrix[d][c].length, 0)])) as Record<Category, number>;
  const L = layout(preCounts, total);
  const R = layout(postCounts, total);
  const leftOff = Object.fromEntries(CATEGORIES.map((c) => [c, L[c].y])) as Record<Category, number>;
  const rightOff = Object.fromEntries(CATEGORIES.map((c) => [c, R[c].y])) as Record<Category, number>;
  const bands: { d: string; c: Category; key: string }[] = [];
  for (const a of CATEGORIES)
    for (const b of CATEGORIES) {
      const n = tr.matrix[a][b].length;
      if (!n) continue;
      const h1 = L[a].h * (n / preCounts[a]);
      const h2 = R[b].h * (n / postCounts[b]);
      const y1 = leftOff[a];
      const y2 = rightOff[b];
      leftOff[a] += h1;
      rightOff[b] += h2;
      const x1 = LEFT + NODE_W;
      const x2 = RIGHT;
      const mx = (x1 + x2) / 2;
      bands.push({ key: `${a}${b}`, c: a, d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2} L${x2},${y2 + h2} C${mx},${y2 + h2} ${mx},${y1 + h1} ${x1},${y1 + h1} Z` });
    }
  const summary = PATTERNS.map((p) => `${th(`pattern.${p}`)} ${tr.patternCounts[p]}`).join(", ");
  const unitLabel = tr.mode === "per_butir" ? t("unit_per_butir", { n: total }) : t("unit_modus", { n: total });

  return (
    <figure className="flex flex-col gap-3 rounded-panel border border-garis bg-permukaan p-4" data-testid={`transition-${tr.domain}`}>
      <figcaption className="flex flex-col gap-0.5">
        <span className="text-[1.1rem] font-bold">{label}</span>
        <span className="text-[0.9rem] text-tinta-2">{unitLabel}</span>
      </figcaption>
      <svg viewBox={`-4 -4 ${W + 8} ${H + 8}`} role="img" aria-label={t("diagramLabel", { domain: label, summary })} className="h-auto w-full max-w-[28rem]">
        {bands.map((b) => (
          <path key={b.key} d={b.d} fill={categoryColor(b.c)} fillOpacity={0.35} stroke={categoryColor(b.c)} strokeOpacity={0.6} strokeWidth={0.5} />
        ))}
        {CATEGORIES.map((c) =>
          preCounts[c] ? (
            <g key={`l${c}`}>
              <rect x={LEFT} y={L[c].y} width={NODE_W} height={Math.max(L[c].h, 1)} fill={categoryColor(c)} rx={3} />
              <text x={LEFT - 6} y={L[c].y + L[c].h / 2} textAnchor="end" dominantBaseline="middle" className="fill-tinta text-[15px] font-semibold">
                {c} {preCounts[c]}
              </text>
            </g>
          ) : null,
        )}
        {CATEGORIES.map((c) =>
          postCounts[c] ? (
            <g key={`r${c}`}>
              <rect x={RIGHT} y={R[c].y} width={NODE_W} height={Math.max(R[c].h, 1)} fill={categoryColor(c)} rx={3} />
              <text x={RIGHT + NODE_W + 6} y={R[c].y + R[c].h / 2} dominantBaseline="middle" className="fill-tinta text-[15px] font-semibold">
                {c} {postCounts[c]}
              </text>
            </g>
          ) : null,
        )}
      </svg>

      <div className="flex flex-col gap-2">
        <h4 className="font-bold">{t("patterns")}</h4>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums" data-testid={`patterns-${tr.domain}`}>
          {PATTERNS.map((p) => (
            <li key={p}>
              {th(`pattern.${p}`)} <strong>{tr.patternCounts[p]}</strong> ({fmtPct(total ? (tr.patternCounts[p] / total) * 100 : 0)})
            </li>
          ))}
        </ul>
        <p className="text-[0.85rem] text-tinta-2">
          {t("invariant")}: {Object.values(tr.patternCounts).reduce((x, y) => x + y, 0)} = {total} {tr.invariantOk ? "✓" : "✗"}
        </p>
      </div>

      <details className="rounded-kontrol border border-garis p-3">
        <summary className="min-h-12 cursor-pointer content-center font-semibold">{t("matrix")}</summary>
        <div tabIndex={0} role="region" aria-label={`${t("matrix")} ${label}`} className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-left text-[0.88rem] tabular-nums">
            <thead>
              <tr className="border-b border-garis">
                <th scope="col" className="p-2">
                  {t("pre")} \ {t("post")}
                </th>
                {CATEGORIES.map((c) => (
                  <th key={c} scope="col" className="p-2">{c}</th>
                ))}
                <th scope="col" className="p-2">{t("total")}</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((a) => (
                <tr key={a} className="border-b border-garis last:border-0">
                  <th scope="row" className="p-2">{a}</th>
                  {CATEGORIES.map((b) => {
                    const n = tr.matrix[a][b].length;
                    return (
                      <td key={b} className="p-2" title={th(`pattern.${transitionPattern(a, b)}`)}>
                        {n ? (
                          <>
                            {n} <span className="text-tinta-2">({fmtPct((n / total) * 100)})</span>
                          </>
                        ) : (
                          "·"
                        )}
                      </td>
                    );
                  })}
                  <td className="p-2 font-semibold">{preCounts[a]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h5 className="mt-3 font-semibold">{t("members")}</h5>
          <ul className="mt-1 flex flex-col gap-1 text-[0.82rem]">
            {CATEGORIES.flatMap((a) =>
              CATEGORIES.map((b) => {
                const ids = [...new Set(tr.matrix[a][b].map((u) => pseudo(u.split("::")[0]!)))].sort();
                return ids.length ? (
                  <li key={`${a}${b}`}>
                    <strong>
                      {a} → {b}
                    </strong>{" "}
                    <span className="font-mono">{ids.join(", ")}</span>
                  </li>
                ) : null;
              }),
            )}
          </ul>
        </div>
      </details>
    </figure>
  );
}
