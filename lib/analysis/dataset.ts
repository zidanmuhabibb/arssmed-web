/**
 * Pembentuk AnalysisDataset (murni): butir dari bank soal + metadata data/items.json,
 * dan dataset sintetis (jawaban mentah → klasifikasi lewat lib/classification).
 */
import { classifyResponse, TestItemContent, type Category, type ConsentStatus, type ItemsFile, type RuleSet } from "@/lib/classification";
import type { StoredItem } from "@/lib/tes/deliver";
import type { Phase } from "@/lib/tes/types";
import type { AnalysisDataset, AnalysisItem, AnalysisResponse, AnalysisStudent } from "./types";

/** Butir analisis dari butir tersimpan; metadata kisi-kisi diambil dari items.json bila versinya sama. */
export function analysisItems(stored: readonly StoredItem[], file: ItemsFile | null): AnalysisItem[] {
  return [...stored]
    .sort((a, b) => a.order - b.order)
    .map((s) => {
      const c = TestItemContent.parse(s.content);
      const f = file?.items.find((i) => i.item_order === s.order);
      return {
        id: s.id,
        order: s.order,
        code: f?.item_code ?? `B${String(s.order).padStart(2, "0")}`,
        conceptDomain: c.concept_domain,
        reportDomain: c.report_domain,
        misconceptionCode: c.misconception_target,
        indicator: f?.meta?.indicator ?? null,
        alternativeConceptions: f?.meta?.alternative_conceptions ?? null,
        scientificConcept: f?.meta?.scientific_concept ?? null,
        tier1Options: c.tier1.options.map((o) => ({ key: o.key, text: o.text })),
        reasonOptions: c.reason.options.map((o) => ({ key: o.key, text: o.text })),
        confidenceLevels: [...c.confidence.levels],
      };
    });
}

/** Label domain dari items.json, berurutan seperti instrumen (butir terkecil); yang tidak terdaftar memakai id-nya. */
export function domainLabels(items: readonly AnalysisItem[], file: ItemsFile | null) {
  const sorted = [...items].sort((a, b) => a.order - b.order);
  const ids = [...new Set([...sorted.map((i) => i.conceptDomain), ...sorted.map((i) => i.reportDomain)])];
  return ids.map((id) => ({ id, label: file?.domains?.find((d) => d.id === id)?.label ?? id }));
}

/** Bentuk berkas tests/fixtures/analysis-synthetic.json. */
export interface SyntheticRaw {
  test_name: string;
  test_version: number;
  classes: { id: string; name: string }[];
  students: { id: string; pseudo_id: string; code: string; nickname: string | null; class_id: string; consent: ConsentStatus; pre_submitted: boolean; post_submitted: boolean }[];
  responses: { student_id: string; phase: Phase; item_order: number; tier1: string; reason: string; conf_a: number; conf_r: number; answered_at: string; response_time_ms: number; answer_changes: number }[];
}

/**
 * Dataset dari jawaban mentah: klasifikasi dihitung dengan aturan yang sama seperti server
 * (classifyResponse). Dipakai uji M7 dan kelas contoh di backend memori.
 */
export function datasetFromRaw(raw: SyntheticRaw, stored: readonly StoredItem[], file: ItemsFile | null, ruleSet: RuleSet): AnalysisDataset {
  const items = analysisItems(stored, file);
  const byOrder = new Map(stored.map((s) => [s.order, s]));
  const students: AnalysisStudent[] = raw.students.map((s) => ({
    id: s.id,
    pseudoId: s.pseudo_id,
    code: s.code,
    nickname: s.nickname,
    classId: s.class_id,
    consent: s.consent,
    preSubmitted: s.pre_submitted,
    postSubmitted: s.post_submitted,
  }));
  const responses: AnalysisResponse[] = raw.responses.map((r) => {
    const it = byOrder.get(r.item_order);
    if (!it) throw new Error(`Butir ${r.item_order} tidak ada di bank soal`);
    const c = classifyResponse(TestItemContent.parse(it.content), { tier1Key: r.tier1, reasonKey: r.reason, confidenceA: r.conf_a, confidenceR: r.conf_r }, ruleSet);
    if (c.status !== "classified") throw new Error(`Respons ${r.student_id}/${r.phase}/${r.item_order} tidak terklasifikasi`);
    return {
      studentId: r.student_id,
      phase: r.phase,
      itemId: it.id,
      tier1Key: r.tier1,
      reasonKey: r.reason,
      confidenceA: r.conf_a,
      confidenceR: r.conf_r,
      aCorrect: c.aCorrect,
      rCorrect: c.rCorrect,
      confident: c.confident,
      category: c.category,
      answeredAt: r.answered_at,
      responseTimeMs: r.response_time_ms,
      answerChanges: r.answer_changes,
    };
  });
  return {
    testName: raw.test_name,
    testVersion: raw.test_version,
    ruleSetId: ruleSet.rule_set_id,
    testRuleSetId: ruleSet.rule_set_id,
    unclassified: 0,
    classes: raw.classes,
    domains: domainLabels(items, file),
    items,
    students,
    responses,
  };
}

/** Batasi dataset ke kelas tertentu (null = semua kelas dalam dataset). */
export function scopeDataset(ds: AnalysisDataset, classId: string | null): AnalysisDataset {
  if (!classId) return ds;
  const students = ds.students.filter((s) => s.classId === classId);
  const ids = new Set(students.map((s) => s.id));
  return { ...ds, classes: ds.classes.filter((c) => c.id === classId), students, responses: ds.responses.filter((r) => ids.has(r.studentId)) };
}

/** Keluaran fungsi DB `analysis_dataset` (supabase/migrations/*_analysis.sql). */
export type DatasetRpcRow = {
  test_id: string;
  test_name: string;
  test_version: number;
  rule_set_id: string;
  test_rule_set_id?: string;
  unclassified?: number;
  classes: { id: string; name: string }[];
  students: { id: string; pseudo_id: string; code: string; nickname: string | null; class_id: string; consent: ConsentStatus; pre_submitted: boolean; post_submitted: boolean }[];
  responses: {
    student_id: string;
    phase: Phase;
    item_id: string;
    tier1: string | null;
    reason: string | null;
    conf_a: number | null;
    conf_r: number | null;
    a_correct: boolean;
    r_correct: boolean;
    confident: boolean;
    category: Category;
    answered_at: string | null;
    response_time_ms: number | null;
    answer_changes: number;
  }[];
};

/** Bentuk RPC → AnalysisDataset. Metadata kisi-kisi hanya dipakai bila nama dan versi tes sama dengan items.json. */
export function datasetFromRpc(d: DatasetRpcRow, stored: readonly StoredItem[], file: ItemsFile | null): AnalysisDataset {
  const same = file && d.test_name === file.test_name && d.test_version === file.test_version ? file : null;
  const items = analysisItems(stored, same);
  return {
    testName: d.test_name,
    testVersion: d.test_version,
    ruleSetId: d.rule_set_id,
    testRuleSetId: d.test_rule_set_id ?? d.rule_set_id,
    unclassified: Number(d.unclassified ?? 0),
    classes: d.classes,
    domains: domainLabels(items, file && d.test_name === file.test_name ? file : null),
    items,
    students: d.students.map((s) => ({ id: s.id, pseudoId: s.pseudo_id, code: s.code, nickname: s.nickname, classId: s.class_id, consent: s.consent, preSubmitted: s.pre_submitted, postSubmitted: s.post_submitted })),
    responses: d.responses.map((r) => ({
      studentId: r.student_id,
      phase: r.phase,
      itemId: r.item_id,
      tier1Key: r.tier1,
      reasonKey: r.reason,
      confidenceA: r.conf_a,
      confidenceR: r.conf_r,
      aCorrect: r.a_correct,
      rCorrect: r.r_correct,
      confident: r.confident,
      category: r.category,
      answeredAt: r.answered_at,
      responseTimeMs: r.response_time_ms,
      answerChanges: r.answer_changes,
    })),
  };
}
