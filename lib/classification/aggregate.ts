import { CATEGORIES, emptyCategoryCounts, type Category } from "./categories";

export interface CategorizedResponse {
  studentId: string;
  itemId: string;
  domain: string;
  category: Category;
}

export interface DomainDistribution {
  domain: string;
  counts: Record<Category, number>;
  /** Persentase 0–100 per kategori; penyebut = nResponses. */
  percent: Record<Category, number>;
  /** Penyebut yang ditampilkan di samping persentase (PRD §6.4). */
  nResponses: number;
  nStudents: number;
  nItems: number;
  /** Invarian: nResponses === nStudents × nItems (setiap siswa menjawab setiap butir domain). */
  denominatorConsistent: boolean;
}

/**
 * Distribusi kategori per domain (PRD §6.4).
 * persen = jumlah respons kategori ÷ (jumlah siswa × jumlah butir domain) × 100.
 * Bila ada respons hilang, penyebut memakai respons yang ada dan
 * `denominatorConsistent` = false agar dasbor menampilkan peringatan.
 */
export function domainDistribution(responses: readonly CategorizedResponse[]): DomainDistribution[] {
  const byDomain = new Map<string, CategorizedResponse[]>();
  for (const r of responses) {
    const list = byDomain.get(r.domain) ?? [];
    list.push(r);
    byDomain.set(r.domain, list);
  }

  const seen = new Set<string>();
  const out: DomainDistribution[] = [];
  for (const [domain, list] of byDomain) {
    const counts = emptyCategoryCounts();
    const students = new Set<string>();
    const items = new Set<string>();
    for (const r of list) {
      const key = `${r.studentId}\u0000${r.itemId}`;
      if (seen.has(key)) throw new Error(`Respons ganda untuk siswa ${r.studentId} butir ${r.itemId}`);
      seen.add(key);
      counts[r.category] += 1;
      students.add(r.studentId);
      items.add(r.itemId);
    }
    const nResponses = list.length;
    const percent = emptyCategoryCounts();
    for (const c of CATEGORIES) percent[c] = nResponses === 0 ? 0 : (counts[c] / nResponses) * 100;
    out.push({
      domain,
      counts,
      percent,
      nResponses,
      nStudents: students.size,
      nItems: items.size,
      denominatorConsistent: nResponses === students.size * items.size,
    });
  }
  return out.sort((a, b) => a.domain.localeCompare(b.domain));
}

export type ConsentStatus = "pending" | "granted" | "withdrawn";

export interface StudentPhaseStatus {
  studentId: string;
  consent: ConsentStatus;
  preComplete: boolean;
  postComplete: boolean;
}

export type ExclusionReason = "consent_withdrawn" | "consent_pending" | "pre_incomplete" | "post_incomplete";

/**
 * Siswa yang masuk analisis berpasangan (PRD §6.4, FR-60/61): persetujuan
 * `granted` dan menyelesaikan pretest DAN posttest. Yang dikeluarkan dilaporkan
 * beserta alasan pertama yang berlaku.
 */
export function selectPairedStudents(students: readonly StudentPhaseStatus[]) {
  const included: string[] = [];
  const excluded: { studentId: string; reason: ExclusionReason }[] = [];
  for (const s of students) {
    let reason: ExclusionReason | null = null;
    if (s.consent === "withdrawn") reason = "consent_withdrawn";
    else if (s.consent === "pending") reason = "consent_pending";
    else if (!s.preComplete) reason = "pre_incomplete";
    else if (!s.postComplete) reason = "post_incomplete";
    if (reason) excluded.push({ studentId: s.studentId, reason });
    else included.push(s.studentId);
  }
  const excludedByReason: Record<ExclusionReason, number> = {
    consent_withdrawn: 0,
    consent_pending: 0,
    pre_incomplete: 0,
    post_incomplete: 0,
  };
  for (const e of excluded) excludedByReason[e.reason] += 1;
  return { included, excluded, excludedByReason };
}
