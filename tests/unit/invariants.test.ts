/**
 * Pemeriksaan invarian pada data acak (seed tetap) — PRD §6.5 dan §16.3:
 * jumlah pola transisi = jumlah unit; jumlah kategori per domain = penyebut.
 */
import { describe, expect, it } from "vitest";
import { CATEGORIES, type Category } from "@/lib/classification/categories";
import { domainDistribution } from "@/lib/classification/aggregate";
import { computeTransitions, type PhaseResponse } from "@/lib/transitions";

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

const DOMAINS = { benda_langit: 5, planet: 6, zona: 4, meteor: 5 } as const;

function synthetic(seed: number, nStudents: number): PhaseResponse[] {
  const rand = lcg(seed);
  const out: PhaseResponse[] = [];
  for (let s = 0; s < nStudents; s++)
    for (const [domain, nItems] of Object.entries(DOMAINS))
      for (let i = 0; i < nItems; i++)
        for (const phase of ["pre", "post"] as const)
          out.push({
            studentId: `S${String(s).padStart(2, "0")}`,
            itemId: `${domain}-${i}`,
            domain,
            phase,
            category: CATEGORIES[Math.floor(rand() * 5)] as Category,
          });
  return out;
}

describe.each([1, 7, 42, 2026])("data sintetis seed %i (36 siswa × 20 butir)", (seed) => {
  const data = synthetic(seed, 36);
  const students = [...new Set(data.map((r) => r.studentId))];

  it.each(["modus", "per_butir"] as const)("transisi %s: Σ pola = jumlah unit", (mode) => {
    for (const d of computeTransitions(data, mode, students)) {
      const sum = Object.values(d.patternCounts).reduce((a, b) => a + b, 0);
      expect(d.invariantOk).toBe(true);
      expect(sum).toBe(d.nUnits);
      const expectedUnits = mode === "modus" ? 36 : 36 * DOMAINS[d.domain as keyof typeof DOMAINS];
      expect(d.nUnits).toBe(expectedUnits);
      const cells = CATEGORIES.flatMap((a) => CATEGORIES.map((b) => d.matrix[a][b].length));
      expect(cells.reduce((a, b) => a + b, 0)).toBe(d.nUnits);
    }
  });

  it.each(["pre", "post"] as const)("distribusi %s: Σ kategori = siswa × butir domain", (phase) => {
    for (const d of domainDistribution(data.filter((r) => r.phase === phase))) {
      expect(d.denominatorConsistent).toBe(true);
      expect(d.nResponses).toBe(36 * DOMAINS[d.domain as keyof typeof DOMAINS]);
      expect(Object.values(d.counts).reduce((a, b) => a + b, 0)).toBe(d.nResponses);
    }
  });
});
