/**
 * Analisis kelas (M7) dari AnalysisDataset — fungsi murni, diuji terhadap hitungan
 * rujukan pandas/SciPy (tests/fixtures/analysis-reference.json).
 *
 * Aturan populasi (PRD §6.4, FR-61, DECISIONS D-054):
 *  - Hanya siswa dengan persetujuan `granted`.
 *  - Bila ada siswa yang menyelesaikan pretest DAN posttest, semua tampilan memakai
 *    kelompok berpasangan itu ("paired"). Bila belum ada, tiap fase memakai siswa yang
 *    sudah menyelesaikan fase tersebut ("per_phase") — agar profil pretest bisa dibaca
 *    sebelum posttest.
 */
import {
  CATEGORIES,
  computeScore,
  domainDistribution,
  emptyCategoryCounts,
  selectPairedStudents,
  type Category,
  type DomainDistribution,
  type ExclusionReason,
  type ScoreMethod,
} from "@/lib/classification";
import { kr20, mean, nGainCategory, pairedTTest, sd, shapiroWilk, summarizeNGain, wilcoxonSignedRank, individualNGain } from "@/lib/stats";
import type { NGainCategory, NGainSummary, PairedTTestResult, ShapiroResult, WilcoxonResult } from "@/lib/stats";
import { computeTransitions, dominantCategory, transitionPattern, type DomainTransitions, type Pattern, type TransitionMode } from "@/lib/transitions";
import type { Phase } from "@/lib/tes/types";
import type { AnalysisDataset, AnalysisItem, AnalysisResponse, AnalysisStudent } from "./types";

export type Taxonomy = "concept_domain" | "report_domain";

export interface AnalysisOptions {
  scoreMethod: ScoreMethod;
  transitionMode: TransitionMode;
  taxonomy: Taxonomy;
}

export const domainOf = (item: AnalysisItem, taxonomy: Taxonomy) => (taxonomy === "concept_domain" ? item.conceptDomain : item.reportDomain);

// ---------------------------------------------------------------------------- populasi

export interface Participation {
  nScope: number;
  paired: string[];
  excluded: { studentId: string; reason: ExclusionReason }[];
  excludedByReason: Record<ExclusionReason, number>;
  population: "paired" | "per_phase" | "none";
  /** Siswa per fase yang dipakai tampilan kelas. */
  phaseStudents: Record<Phase, string[]>;
}

export function participation(ds: AnalysisDataset): Participation {
  const sel = selectPairedStudents(ds.students.map((s) => ({ studentId: s.id, consent: s.consent, preComplete: s.preSubmitted, postComplete: s.postSubmitted })));
  const granted = ds.students.filter((s) => s.consent === "granted");
  const population = sel.included.length > 0 ? "paired" : granted.some((s) => s.preSubmitted || s.postSubmitted) ? "per_phase" : "none";
  const phaseStudents =
    population === "paired"
      ? { pre: sel.included, post: sel.included }
      : { pre: granted.filter((s) => s.preSubmitted).map((s) => s.id), post: granted.filter((s) => s.postSubmitted).map((s) => s.id) };
  return { nScope: ds.students.length, paired: sel.included, excluded: sel.excluded, excludedByReason: sel.excludedByReason, population, phaseStudents };
}

function responsesOf(ds: AnalysisDataset, phase: Phase, studentIds: readonly string[]) {
  const ids = new Set(studentIds);
  return ds.responses.filter((r) => r.phase === phase && ids.has(r.studentId));
}

// ---------------------------------------------------------------------------- FR-42 profil kelas

export function classDistribution(ds: AnalysisDataset, p: Participation, taxonomy: Taxonomy): Record<Phase, DomainDistribution[]> {
  const items = new Map(ds.items.map((i) => [i.id, i]));
  const of = (phase: Phase) =>
    domainDistribution(
      responsesOf(ds, phase, p.phaseStudents[phase]).map((r) => ({ studentId: r.studentId, itemId: r.itemId, domain: domainOf(items.get(r.itemId)!, taxonomy), category: r.category })),
    );
  return { pre: of("pre"), post: of("post") };
}

// ---------------------------------------------------------------------------- FR-43 peta butir

export interface TopOption {
  key: string;
  text: string;
  count: number;
  percent: number;
}

export interface ItemMapRow {
  item: AnalysisItem;
  n: number;
  counts: Record<Category, number>;
  /** Persentase M dari n. */
  percentM: number;
  topTier1: TopOption | null;
  topReason: TopOption | null;
}

/** Opsi yang paling sering dipilih; seri → kunci terkecil secara abjad. */
function topOption(keys: readonly (string | null)[], options: AnalysisItem["tier1Options"], n: number): TopOption | null {
  const counts = new Map<string, number>();
  for (const k of keys) if (k != null) counts.set(k, (counts.get(k) ?? 0) + 1);
  if (counts.size === 0) return null;
  const [key, count] = [...counts].sort(([ka, a], [kb, b]) => b - a || ka.localeCompare(kb))[0]!;
  return { key, text: options.find((o) => o.key === key)?.text ?? key, count, percent: (count / n) * 100 };
}

/** 20 butir diurutkan dari M terbanyak (seri → nomor butir). */
export function itemMap(ds: AnalysisDataset, phase: Phase, studentIds: readonly string[]): ItemMapRow[] {
  const resp = responsesOf(ds, phase, studentIds);
  const rows = ds.items.map((item) => {
    const mine = resp.filter((r) => r.itemId === item.id);
    const counts = emptyCategoryCounts();
    for (const r of mine) counts[r.category] += 1;
    const n = mine.length;
    return {
      item,
      n,
      counts,
      percentM: n === 0 ? 0 : (counts.M / n) * 100,
      topTier1: topOption(mine.map((r) => r.tier1Key), item.tier1Options, n),
      topReason: topOption(mine.map((r) => r.reasonKey), item.reasonOptions, n),
    };
  });
  return rows.sort((a, b) => b.counts.M - a.counts.M || a.item.order - b.item.order);
}

/** FR-45: tiga butir dengan miskonsepsi terbanyak pada fase terakhir yang sudah ada datanya. */
export function toDiscuss(map: Record<Phase, ItemMapRow[]>, n = 3): { phase: Phase; rows: ItemMapRow[] } | null {
  const phase: Phase | null = map.post.some((r) => r.n > 0) ? "post" : map.pre.some((r) => r.n > 0) ? "pre" : null;
  if (!phase) return null;
  return { phase, rows: map[phase].filter((r) => r.counts.M > 0).slice(0, n) };
}

// ---------------------------------------------------------------------------- FR-44 profil siswa

export interface StudentProfile {
  student: AnalysisStudent;
  scorePre: number | null;
  scorePost: number | null;
  delta: number | null;
  nGain: number | null;
  nGainCategory: NGainCategory | null;
  /** Kategori dominan (modus) per domain; pola dihitung dari keduanya. */
  domains: { domain: string; pre: Category | null; post: Category | null; pattern: Pattern | null }[];
  items: { item: AnalysisItem; pre: Category | null; post: Category | null; pattern: Pattern | null }[];
}

export function studentScore(ds: AnalysisDataset, studentId: string, phase: Phase, method: ScoreMethod): number | null {
  const s = ds.students.find((x) => x.id === studentId);
  if (!s || !(phase === "pre" ? s.preSubmitted : s.postSubmitted)) return null;
  const rs = ds.responses.filter((r) => r.studentId === studentId && r.phase === phase);
  return computeScore(rs.map((r) => ({ category: r.category, aCorrect: r.aCorrect })), ds.items.length, method);
}

function domainList(ds: AnalysisDataset, taxonomy: Taxonomy) {
  return [...new Set(ds.items.map((i) => domainOf(i, taxonomy)))].sort();
}

/** Profil siswa yang sudah menyelesaikan minimal satu fase (persetujuan `granted`). */
export function studentProfiles(ds: AnalysisDataset, opts: Pick<AnalysisOptions, "scoreMethod" | "taxonomy">): StudentProfile[] {
  const domains = domainList(ds, opts.taxonomy);
  const byStudent = new Map<string, AnalysisResponse[]>();
  for (const r of ds.responses) (byStudent.get(r.studentId) ?? byStudent.set(r.studentId, []).get(r.studentId)!).push(r);
  return ds.students
    .filter((s) => s.consent === "granted" && (s.preSubmitted || s.postSubmitted))
    .sort((a, b) => a.code.localeCompare(b.code) || a.pseudoId.localeCompare(b.pseudoId))
    .map((student) => {
      const rs = byStudent.get(student.id) ?? [];
      const cat = (phase: Phase, itemId: string) => rs.find((r) => r.phase === phase && r.itemId === itemId)?.category ?? null;
      const scorePre = studentScore(ds, student.id, "pre", opts.scoreMethod);
      const scorePost = studentScore(ds, student.id, "post", opts.scoreMethod);
      const both = scorePre !== null && scorePost !== null;
      const nGain = both ? individualNGain(scorePre, scorePost) : null;
      const dom = (phase: Phase, d: string) => {
        if (!(phase === "pre" ? student.preSubmitted : student.postSubmitted)) return null;
        const cats = rs.filter((r) => r.phase === phase && domainOf(ds.items.find((i) => i.id === r.itemId)!, opts.taxonomy) === d).map((r) => r.category);
        return cats.length ? dominantCategory(cats) : null;
      };
      return {
        student,
        scorePre,
        scorePost,
        delta: both ? scorePost - scorePre : null,
        nGain,
        nGainCategory: nGain === null ? null : nGainCategory(nGain),
        domains: domains.map((d) => {
          const pre = dom("pre", d);
          const post = dom("post", d);
          return { domain: d, pre, post, pattern: pre && post ? transitionPattern(pre, post) : null };
        }),
        items: ds.items.map((item) => {
          const pre = student.preSubmitted ? cat("pre", item.id) : null;
          const post = student.postSubmitted ? cat("post", item.id) : null;
          return { item, pre, post, pattern: pre && post ? transitionPattern(pre, post) : null };
        }),
      };
    });
}

// ---------------------------------------------------------------------------- FR-51 statistik

export type Maybe<T> = { ok: true; value: T } | { ok: false; reason: string };

function attempt<T>(fn: () => T): Maybe<T> {
  try {
    const value = fn();
    if (typeof value === "object" && value !== null && Object.values(value).some((v) => typeof v === "number" && Number.isNaN(v))) {
      return { ok: false, reason: "undefined" };
    }
    return { ok: true, value };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

export interface ClassStatistics {
  scoreMethod: ScoreMethod;
  n: number;
  /** Urutan sama dengan `participation.paired`. */
  pre: number[];
  post: number[];
  descriptive: Maybe<{ preMean: number; preSd: number; postMean: number; postSd: number }>;
  nGain: Maybe<NGainSummary>;
  nGainCategories: Record<NGainCategory, number>;
  tTest: Maybe<PairedTTestResult>;
  wilcoxon: Maybe<WilcoxonResult>;
  /** Shapiro–Wilk pada selisih post − pre. */
  shapiro: Maybe<ShapiroResult>;
  kr20Pre: Maybe<ReturnType<typeof kr20>>;
  kr20Post: Maybe<ReturnType<typeof kr20>>;
}

function hitMatrix(ds: AnalysisDataset, phase: Phase, studentIds: readonly string[], method: ScoreMethod): (0 | 1)[][] {
  return studentIds.map((sid) =>
    ds.items.map((it) => {
      const r = ds.responses.find((x) => x.studentId === sid && x.phase === phase && x.itemId === it.id);
      return r && (method === "score_sc" ? r.category === "SC" : r.aCorrect) ? 1 : 0;
    }),
  );
}

export function classStatistics(ds: AnalysisDataset, p: Participation, method: ScoreMethod): ClassStatistics {
  const ids = p.paired;
  const pre = ids.map((id) => studentScore(ds, id, "pre", method)!);
  const post = ids.map((id) => studentScore(ds, id, "post", method)!);
  const nGain = attempt(() => summarizeNGain(pre, post));
  const nGainCategories: Record<NGainCategory, number> = { tinggi: 0, sedang: 0, rendah: 0 };
  if (nGain.ok) for (const x of nGain.value.individual) if (x.category) nGainCategories[x.category] += 1;
  const diff = post.map((v, i) => v - pre[i]!);
  return {
    scoreMethod: method,
    n: ids.length,
    pre,
    post,
    descriptive: attempt(() => {
      if (ids.length < 2) throw new Error("n < 2");
      return { preMean: mean(pre), preSd: sd(pre), postMean: mean(post), postSd: sd(post) };
    }),
    nGain,
    nGainCategories,
    tTest: attempt(() => {
      const t = pairedTTest(pre, post);
      if (t.degenerate) throw new Error("degenerate");
      return t;
    }),
    wilcoxon: attempt(() => {
      if (diff.every((d) => d === 0)) throw new Error("all_zero");
      return wilcoxonSignedRank(pre, post);
    }),
    shapiro: attempt(() => {
      if (new Set(diff).size < 2) throw new Error("constant");
      return shapiroWilk(diff);
    }),
    kr20Pre: attempt(() => kr20(hitMatrix(ds, "pre", ids, method))),
    kr20Post: attempt(() => kr20(hitMatrix(ds, "post", ids, method))),
  };
}

// ---------------------------------------------------------------------------- FR-52 transisi

export function classTransitions(ds: AnalysisDataset, p: Participation, opts: Pick<AnalysisOptions, "transitionMode" | "taxonomy">): DomainTransitions[] {
  const items = new Map(ds.items.map((i) => [i.id, i]));
  return computeTransitions(
    ds.responses.map((r) => ({ studentId: r.studentId, itemId: r.itemId, phase: r.phase, category: r.category, domain: domainOf(items.get(r.itemId)!, opts.taxonomy) })),
    opts.transitionMode,
    p.paired,
  );
}

// ---------------------------------------------------------------------------- semua

export interface ClassAnalysis {
  options: AnalysisOptions;
  participation: Participation;
  distribution: Record<Phase, DomainDistribution[]>;
  itemMap: Record<Phase, ItemMapRow[]>;
  discuss: ReturnType<typeof toDiscuss>;
  students: StudentProfile[];
  statistics: ClassStatistics;
  transitions: DomainTransitions[];
}

export function analyze(ds: AnalysisDataset, options: AnalysisOptions): ClassAnalysis {
  const p = participation(ds);
  const map = { pre: itemMap(ds, "pre", p.phaseStudents.pre), post: itemMap(ds, "post", p.phaseStudents.post) };
  return {
    options,
    participation: p,
    distribution: classDistribution(ds, p, options.taxonomy),
    itemMap: map,
    discuss: toDiscuss(map),
    students: studentProfiles(ds, options),
    statistics: classStatistics(ds, p, options.scoreMethod),
    transitions: classTransitions(ds, p, options),
  };
}

export { CATEGORIES };
