import type { Category } from "../classification/categories";
import { dominantCategory, emptyMatrix, PATTERNS, transitionPattern, type Pattern } from "./patterns";

export type TransitionMode = "modus" | "per_butir";

export interface PhaseResponse {
  studentId: string;
  itemId: string;
  domain: string;
  phase: "pre" | "post";
  category: Category;
}

export interface TransitionUnit {
  /** studentId (modus) atau `studentId::itemId` (per_butir). */
  unitId: string;
  studentId: string;
  itemId: string | null;
  pre: Category;
  post: Category;
  pattern: Pattern;
}

export interface DomainTransitions {
  domain: string;
  mode: TransitionMode;
  units: TransitionUnit[];
  /** matrix[pre][post] = daftar unitId (untuk diagram alur dan daftar kode siswa). */
  matrix: Record<Category, Record<Category, string[]>>;
  patternCounts: Record<Pattern, number>;
  nUnits: number;
  excluded: { unitId: string; reason: "missing_pre" | "missing_post" }[];
  /** Invarian PRD §6.5: jumlah semua pola = jumlah unit (siswa untuk modus). */
  invariantOk: boolean;
}

/**
 * Transisi pretest → posttest per domain.
 * @param pairedStudentIds siswa yang lolos `selectPairedStudents` — siswa lain diabaikan.
 */
export function computeTransitions(
  responses: readonly PhaseResponse[],
  mode: TransitionMode,
  pairedStudentIds: readonly string[],
): DomainTransitions[] {
  const paired = new Set(pairedStudentIds);
  const byDomain = new Map<string, PhaseResponse[]>();
  for (const r of responses) {
    if (!paired.has(r.studentId)) continue;
    const list = byDomain.get(r.domain) ?? [];
    list.push(r);
    byDomain.set(r.domain, list);
  }

  const result: DomainTransitions[] = [];
  for (const [domain, list] of byDomain) {
    // kunci unit → { pre: Category[], post: Category[] }
    const groups = new Map<string, { studentId: string; itemId: string | null; pre: Category[]; post: Category[] }>();
    const seen = new Set<string>();
    for (const r of list) {
      const dupKey = `${r.studentId}\u0000${r.itemId}\u0000${r.phase}`;
      if (seen.has(dupKey)) throw new Error(`Respons ganda: ${r.studentId} ${r.itemId} ${r.phase}`);
      seen.add(dupKey);
      const unitId = mode === "modus" ? r.studentId : `${r.studentId}::${r.itemId}`;
      const g = groups.get(unitId) ?? { studentId: r.studentId, itemId: mode === "modus" ? null : r.itemId, pre: [], post: [] };
      g[r.phase].push(r.category);
      groups.set(unitId, g);
    }

    const units: TransitionUnit[] = [];
    const excluded: DomainTransitions["excluded"] = [];
    const matrix = emptyMatrix();
    const patternCounts = Object.fromEntries(PATTERNS.map((p) => [p, 0])) as Record<Pattern, number>;

    for (const [unitId, g] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
      if (g.pre.length === 0) {
        excluded.push({ unitId, reason: "missing_pre" });
        continue;
      }
      if (g.post.length === 0) {
        excluded.push({ unitId, reason: "missing_post" });
        continue;
      }
      const pre = dominantCategory(g.pre);
      const post = dominantCategory(g.post);
      const pattern = transitionPattern(pre, post);
      units.push({ unitId, studentId: g.studentId, itemId: g.itemId, pre, post, pattern });
      matrix[pre][post].push(unitId);
      patternCounts[pattern] += 1;
    }

    const total = Object.values(patternCounts).reduce((a, b) => a + b, 0);
    result.push({
      domain,
      mode,
      units,
      matrix,
      patternCounts,
      nUnits: units.length,
      excluded,
      invariantOk: total === units.length,
    });
  }
  return result.sort((a, b) => a.domain.localeCompare(b.domain));
}
