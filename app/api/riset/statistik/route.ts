import { connection, NextResponse } from "next/server";
import { CATEGORIES } from "@/lib/classification";
import { loadAnalysis } from "@/lib/analysis/server";
import { errorResponse, NO_STORE } from "@/lib/tes/http";

/** GET /api/riset/statistik?kelas=&skor=&transisi= — hasil lib/stats (PRD §11). Tanpa id siswa. */
export async function GET(request: Request) {
  await connection();
  try {
    const { ds, analysis: a } = await loadAnalysis(new URL(request.url));
    const unwrap = <T,>(m: { ok: true; value: T } | { ok: false; reason: string }) => (m.ok ? m.value : { unavailable: m.reason });
    const s = a.statistics;
    return NextResponse.json(
      {
        test: { name: ds.testName, version: ds.testVersion, rule_set_id: ds.ruleSetId },
        options: a.options,
        participation: { n_paired: a.participation.paired.length, excluded_by_reason: a.participation.excludedByReason, population: a.participation.population },
        statistics: {
          score_method: s.scoreMethod,
          n: s.n,
          descriptive: unwrap(s.descriptive),
          n_gain: s.nGain.ok ? { ...s.nGain.value, individual: undefined } : { unavailable: s.nGain.reason },
          n_gain_categories: s.nGainCategories,
          t_test: unwrap(s.tTest),
          wilcoxon: unwrap(s.wilcoxon),
          shapiro_diff: unwrap(s.shapiro),
          kr20_pre: unwrap(s.kr20Pre),
          kr20_post: unwrap(s.kr20Post),
        },
        distribution: a.distribution,
        transitions: a.transitions.map((t) => ({
          domain: t.domain,
          mode: t.mode,
          n_units: t.nUnits,
          invariant_ok: t.invariantOk,
          pattern_counts: t.patternCounts,
          matrix: Object.fromEntries(CATEGORIES.map((x) => [x, Object.fromEntries(CATEGORIES.map((y) => [y, t.matrix[x][y].length]))])),
        })),
      },
      { headers: NO_STORE },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
