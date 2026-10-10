/**
 * Ekspor PRD §7.4 (murni). Hanya `student_pseudo_id` — tanpa kode siswa atau nama panggilan.
 * Hanya siswa dengan persetujuan `granted` (FR-61: `withdrawn` otomatis dikeluarkan).
 */
import { CATEGORIES } from "@/lib/classification";
import { PATTERNS, dominantCategory, transitionPattern } from "@/lib/transitions";
import type { Phase } from "@/lib/tes/types";
import { domainOf, studentScore, type AnalysisOptions, type ClassAnalysis, type Maybe } from "./analyze";
import type { AnalysisDataset } from "./types";

export type Cell = string | number | boolean | null;
export interface Table {
  name: string;
  columns: string[];
  rows: Cell[][];
}

export const LONG_COLUMNS = [
  "student_pseudo_id",
  "class_id",
  "phase",
  "item_id",
  "item_order",
  "concept_domain",
  "report_domain",
  "tier1_answer",
  "tier1_correct",
  "reason_answer",
  "reason_correct",
  // PRD menyebut satu `confidence_level`; instrumen four-tier punya dua tingkat keyakinan (D-055).
  "confidence_a_level",
  "confidence_r_level",
  "confident",
  "category",
  "rule_set_id",
  "answered_at",
  "response_time_ms",
  "answer_changes",
] as const;

const PHASE_ORDER: Record<Phase, number> = { pre: 0, post: 1 };

function exportable(ds: AnalysisDataset) {
  return ds.students.filter((s) => s.consent === "granted");
}

export function responsesLong(ds: AnalysisDataset): Table {
  const students = new Map(exportable(ds).map((s) => [s.id, s]));
  const items = new Map(ds.items.map((i) => [i.id, i]));
  const level = (levels: string[], i: number | null) => (i === null ? null : (levels[i] ?? String(i)));
  const rows = ds.responses
    .filter((r) => {
      const s = students.get(r.studentId);
      return s && (r.phase === "pre" ? s.preSubmitted : s.postSubmitted);
    })
    .map((r) => ({ r, s: students.get(r.studentId)!, it: items.get(r.itemId)! }))
    .sort((a, b) => a.s.pseudoId.localeCompare(b.s.pseudoId) || PHASE_ORDER[a.r.phase] - PHASE_ORDER[b.r.phase] || a.it.order - b.it.order)
    .map(({ r, s, it }) => [
      s.pseudoId,
      s.classId,
      r.phase,
      it.code,
      it.order,
      it.conceptDomain,
      it.reportDomain,
      r.tier1Key,
      r.aCorrect,
      r.reasonKey,
      r.rCorrect,
      level(it.confidenceLevels, r.confidenceA),
      level(it.confidenceLevels, r.confidenceR),
      r.confident,
      r.category,
      ds.ruleSetId,
      r.answeredAt,
      r.responseTimeMs,
      r.answerChanges,
    ]);
  return { name: "responses_long", columns: [...LONG_COLUMNS], rows };
}

/**
 * Satu baris per siswa. `transition_{domain}` = pola dari kategori dominan (modus) pre → post
 * pada domain itu (D-055), karena mode per_butir tidak menghasilkan satu nilai per siswa.
 */
export function scoresWide(ds: AnalysisDataset, opts: Pick<AnalysisOptions, "scoreMethod" | "taxonomy">): Table {
  const domains = [...new Set(ds.items.map((i) => domainOf(i, opts.taxonomy)))].sort();
  const items = new Map(ds.items.map((i) => [i.id, i]));
  const rows = exportable(ds)
    .filter((s) => s.preSubmitted || s.postSubmitted)
    .sort((a, b) => a.pseudoId.localeCompare(b.pseudoId))
    .map((s) => {
      const pre = studentScore(ds, s.id, "pre", opts.scoreMethod);
      const post = studentScore(ds, s.id, "post", opts.scoreMethod);
      const both = pre !== null && post !== null;
      const g = both && pre !== 100 ? (post - pre) / (100 - pre) : null;
      const rs = ds.responses.filter((r) => r.studentId === s.id);
      const trans = domains.map((d) => {
        if (!both) return null;
        const cats = (phase: Phase) => rs.filter((r) => r.phase === phase && domainOf(items.get(r.itemId)!, opts.taxonomy) === d).map((r) => r.category);
        return transitionPattern(dominantCategory(cats("pre")), dominantCategory(cats("post")));
      });
      return [s.pseudoId, pre, post, both ? post - pre : null, g, g === null ? null : g >= 0.7 ? "tinggi" : g >= 0.3 ? "sedang" : "rendah", ...trans];
    });
  return { name: "scores_wide", columns: ["student_pseudo_id", "score_pre", "score_post", "delta", "n_gain", "n_gain_category", ...domains.map((d) => `transition_${d}`)], rows };
}

export function distributionTable(a: ClassAnalysis): Table {
  const rows: Cell[][] = [];
  for (const phase of ["pre", "post"] as const)
    for (const d of a.distribution[phase])
      rows.push([phase, d.domain, d.nResponses, d.nStudents, d.nItems, ...CATEGORIES.map((c) => d.counts[c]), ...CATEGORIES.map((c) => d.percent[c])]);
  return {
    name: "domain_distribution",
    columns: ["phase", "domain", "n_responses", "n_students", "n_items", ...CATEGORIES.map((c) => `n_${c}`), ...CATEGORIES.map((c) => `pct_${c}`)],
    rows,
  };
}

export function transitionsTable(a: ClassAnalysis): Table {
  const rows: Cell[][] = [];
  for (const t of a.transitions) {
    for (const pre of CATEGORIES)
      for (const post of CATEGORIES) {
        const n = t.matrix[pre][post].length;
        if (n > 0) rows.push([t.domain, t.mode, pre, post, n, t.nUnits ? (n / t.nUnits) * 100 : 0, transitionPattern(pre, post)]);
      }
  }
  return { name: "transitions", columns: ["domain", "mode", "pre", "post", "n", "pct", "pola"], rows };
}

/** Tabel statistik sebagai pasangan nama–nilai (sheet `stats`). */
export function statsTable(a: ClassAnalysis): Table {
  const s = a.statistics;
  const rows: Cell[][] = [];
  const add = (k: string, v: Cell) => rows.push([k, v]);
  const block = <T>(prefix: string, m: Maybe<T>, f: (v: T) => [string, Cell][]) => {
    if (!m.ok) add(`${prefix}_unavailable`, m.reason);
    else for (const [k, v] of f(m.value)) add(`${prefix}_${k}`, v);
  };
  add("score_method", s.scoreMethod);
  add("n_paired", s.n);
  for (const [k, v] of Object.entries(a.participation.excludedByReason)) add(`excluded_${k}`, v);
  block("descriptive", s.descriptive, (v) => [["pre_mean", v.preMean], ["pre_sd", v.preSd], ["post_mean", v.postMean], ["post_sd", v.postSd]]);
  block("n_gain", s.nGain, (v) => [
    ["mean", v.mean], ["sd", v.sd], ["se", v.ci.se], ["ci95_low", v.ci.lower], ["ci95_high", v.ci.upper],
    ["n", v.n], ["excluded_pre_max", v.excludedPreMax], ["category", v.category],
  ]);
  for (const [k, v] of Object.entries(s.nGainCategories)) add(`n_gain_count_${k}`, v);
  block("ttest", s.tTest, (v) => [
    ["t", v.t], ["df", v.df], ["p", v.p], ["mean_diff", v.meanDiff], ["sd_diff", v.sdDiff],
    ["ci95_low", v.ciDiff.lower], ["ci95_high", v.ciDiff.upper], ["cohen_dz", v.cohenDz], ["hedges_gz", v.hedgesGz],
  ]);
  block("wilcoxon", s.wilcoxon, (v) => [["W", v.W], ["z", v.z], ["p", v.p], ["r", v.r], ["method", v.method], ["n_zero", v.nZero]]);
  block("shapiro_diff", s.shapiro, (v) => [["W", v.W], ["p", v.p]]);
  block("kr20_pre", s.kr20Pre, (v) => [["value", v.kr20], ["k", v.k], ["n", v.n]]);
  block("kr20_post", s.kr20Post, (v) => [["value", v.kr20], ["k", v.k], ["n", v.n]]);
  for (const t of a.transitions) for (const p of PATTERNS) add(`pattern_${t.domain}_${p}`, t.patternCounts[p]);
  return { name: "stats", columns: ["metric", "value"], rows };
}

export interface ExportMeta {
  appVersion: string;
  exportedAt: string;
  scope: string;
}

export function readmeTable(ds: AnalysisDataset, a: ClassAnalysis, meta: ExportMeta): Table {
  return {
    name: "README",
    columns: ["key", "value"],
    rows: [
      ["app", "ARSSMED Web"],
      ["app_version", meta.appVersion],
      ["test_name", ds.testName],
      ["test_version", ds.testVersion],
      ["rule_set_id", ds.ruleSetId],
      ["test_rule_set_id", ds.testRuleSetId],
      ["score_method", a.options.scoreMethod],
      ["transition_mode", a.options.transitionMode],
      ["domain_taxonomy", a.options.taxonomy],
      ["scope", meta.scope],
      ["exported_at", meta.exportedAt],
      ["students_included", "persetujuan granted; analisis berpasangan hanya siswa dengan pretest dan posttest selesai"],
      ["privacy", "hanya student_pseudo_id; tanpa nama atau kode siswa"],
      ["interpretation", "Desain satu kelompok tanpa pembanding: hasil menggambarkan perubahan yang teramati, bukan bukti sebab-akibat."],
    ],
  };
}

export function allTables(ds: AnalysisDataset, a: ClassAnalysis, meta: ExportMeta): Table[] {
  return [readmeTable(ds, a, meta), responsesLong(ds), scoresWide(ds, a.options), distributionTable(a), transitionsTable(a), statsTable(a)];
}

// ---------------------------------------------------------------------------- CSV

/** Sel teks yang diawali = + - @ (bukan angka) diberi awalan ' agar tidak dieksekusi spreadsheet. */
function csvCell(v: Cell): string {
  if (v === null) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "boolean") return v ? "true" : "false";
  let s = v;
  if (/^[=+\-@\t\r]/.test(s) && !/^[-+]?\d/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV RFC 4180 (koma, CRLF, UTF-8 tanpa BOM). */
export function toCsv(t: Table): string {
  return [t.columns, ...t.rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
