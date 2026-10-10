/**
 * Kriteria selesai M7 (PRD §15): hasil aplikasi = hasil hitung rujukan pada dataset sintetis.
 * Rujukan: tests/fixtures/generate_analysis_reference.py (pandas/NumPy/SciPy, ditulis ulang dari PRD).
 */
import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import ref from "../../tests/fixtures/analysis-reference.json";
import { PATTERNS } from "@/lib/transitions";
import { CATEGORIES } from "@/lib/classification";
import { analyze, type AnalysisOptions } from "./analyze";
import { scopeDataset } from "./dataset";
import { allTables, responsesLong, scoresWide, toCsv } from "./export";
import { syntheticDataset } from "./synthetic";
import { buildXlsx } from "./xlsx";

function close(actual: number | null | undefined, expected: number | null, rel = 1e-9, abs = 1e-12) {
  if (expected === null) return expect(actual ?? null).toBeNull();
  expect(actual, `aktual ${actual}, rujukan ${expected}`).not.toBeNull();
  expect(Math.abs(actual! - expected), `aktual ${actual}, rujukan ${expected}`).toBeLessThanOrEqual(Math.max(abs, rel * Math.abs(expected)));
}

const full = syntheticDataset();
const OPTS: AnalysisOptions = { scoreMethod: "score_sc", transitionMode: "per_butir", taxonomy: "concept_domain" };
type Scope = (typeof ref.scopes)["all"];

describe.each([
  ["all", null],
  ["syn-class-a", "syn-class-a"],
] as const)("dataset sintetis — cakupan %s", (key, classId) => {
  const R = ref.scopes[key] as Scope;
  const ds = scopeDataset(full, classId);
  const a = analyze(ds, OPTS);

  it("populasi: siswa berpasangan dan alasan dikeluarkan (FR-61, §6.4)", () => {
    expect(ds.students).toHaveLength(R.n_scope);
    expect([...a.participation.paired].sort()).toEqual(R.paired);
    expect(a.participation.excludedByReason).toEqual(R.excluded_by_reason);
    expect(a.participation.population).toBe("paired");
  });

  it("FR-42: distribusi kategori per domain, pre dan post", () => {
    for (const phase of ["pre", "post"] as const) {
      const got = a.distribution[phase];
      expect(got.map((d) => d.domain)).toEqual(R.distribution[phase].map((d) => d.domain));
      got.forEach((d, i) => {
        const e = R.distribution[phase][i]!;
        expect([d.nResponses, d.nStudents, d.nItems, d.denominatorConsistent]).toEqual([e.n_responses, e.n_students, e.n_items, true]);
        expect(d.counts).toEqual(e.counts);
        for (const c of CATEGORIES) close(d.percent[c], e.percent[c]);
      });
    }
  });

  it("FR-43: peta butir — urutan M terbanyak, opsi tier 1 dan alasan terpopuler", () => {
    for (const phase of ["pre", "post"] as const) {
      const got = a.itemMap[phase].map((r) => ({
        item_order: r.item.order,
        n: r.n,
        m_count: r.counts.M,
        counts: r.counts,
        top_tier1: { key: r.topTier1!.key, count: r.topTier1!.count },
        top_reason: { key: r.topReason!.key, count: r.topReason!.count },
      }));
      expect(got).toEqual(R.item_map[phase]);
    }
    expect(a.discuss!.phase).toBe("post");
    expect(a.discuss!.rows.map((r) => r.item.order)).toEqual(R.item_map.post.slice(0, 3).map((r) => r.item_order));
  });

  it.each(["score_sc", "score_tier1"] as const)("FR-51 (%s): skor, N-Gain, uji-t, Wilcoxon, Shapiro, efek, KR-20", (method) => {
    const S = R.stats[method];
    const st = analyze(ds, { ...OPTS, scoreMethod: method }).statistics;
    const byId = new Map(a.participation.paired.map((id, i) => [id, i]));
    for (const e of S.students) {
      const i = byId.get(e.id)!;
      expect([st.pre[i], st.post[i]]).toEqual([e.pre, e.post]);
    }
    if (!st.descriptive.ok || !st.nGain.ok || !st.tTest.ok || !st.wilcoxon.ok || !st.shapiro.ok || !st.kr20Pre.ok || !st.kr20Post.ok) throw new Error("statistik tidak lengkap");
    close(st.descriptive.value.preMean, S.pre_mean);
    close(st.descriptive.value.preSd, S.pre_sd);
    close(st.descriptive.value.postMean, S.post_mean);
    close(st.descriptive.value.postSd, S.post_sd);

    const g = st.nGain.value;
    close(g.mean, S.ngain.mean);
    close(g.sd, S.ngain.sd);
    close(g.ci.lower, S.ngain.ci_low, 1e-9);
    close(g.ci.upper, S.ngain.ci_high, 1e-9);
    expect([g.n, g.excludedPreMax, g.category]).toEqual([S.ngain.n, S.ngain.excluded_pre_max, S.ngain.category]);
    expect(st.nGainCategories).toEqual(S.ngain.categories);
    for (const e of S.students) close(g.individual[byId.get(e.id)!]!.g, e.n_gain);

    const t = st.tTest.value;
    close(t.t, S.ttest.t);
    close(t.p, S.ttest.p, 1e-8, 1e-300);
    expect(t.df).toBe(S.ttest.df);
    close(t.ciDiff.lower, S.ttest.ci_low);
    close(t.ciDiff.upper, S.ttest.ci_high);
    close(t.meanDiff, S.ttest.mean_diff);
    close(t.sdDiff, S.ttest.sd_diff);
    close(t.cohenDz, S.ttest.cohen_dz);
    close(t.hedgesGz, S.ttest.hedges_gz);

    const w = st.wilcoxon.value;
    close(w.W, S.wilcoxon.W);
    close(w.p, S.wilcoxon.p, 1e-7, 1e-300);
    close(w.z, S.wilcoxon.z, 1e-9);
    expect(w.nZero).toBe(S.wilcoxon.n_zero);

    close(st.shapiro.value.W, S.shapiro.W, 1e-6);
    close(st.shapiro.value.p, S.shapiro.p, 1e-4, 1e-300);

    for (const [mine, e] of [
      [st.kr20Pre.value, S.kr20_pre],
      [st.kr20Post.value, S.kr20_post],
    ] as const) {
      close(mine.kr20, e.kr20);
      expect([mine.k, mine.n]).toEqual([e.k, e.n]);
    }
  });

  it.each(["per_butir", "modus"] as const)("FR-52: transisi %s — pola dan matriks; jumlah pola = jumlah unit", (mode) => {
    const tr = analyze(ds, { ...OPTS, transitionMode: mode }).transitions;
    const E = R.transitions[mode];
    expect(tr.map((t) => t.domain)).toEqual(E.map((t) => t.domain));
    tr.forEach((t, i) => {
      const e = E[i]!;
      expect(t.invariantOk).toBe(true);
      expect(t.nUnits).toBe(e.n_units);
      expect(Object.values(t.patternCounts).reduce((x, y) => x + y, 0)).toBe(e.n_units);
      expect(Object.fromEntries(PATTERNS.map((p) => [p, t.patternCounts[p]]))).toEqual(e.pattern_counts);
      for (const pre of CATEGORIES) for (const post of CATEGORIES) expect(t.matrix[pre][post].length, `${pre}→${post}`).toBe(e.matrix[pre][post]);
    });
  });

  it("§7.4 responses_long: baris, urutan, kategori; tanpa siswa withdrawn/pending", () => {
    const t = responsesLong(ds);
    expect(t.rows).toHaveLength(R.export.long_count);
    const col = (n: string) => t.columns.indexOf(n);
    const keys = t.rows.map((r) =>
      [r[col("student_pseudo_id")], r[col("phase")], r[col("item_id")], r[col("category")], r[col("tier1_correct")], r[col("reason_correct")], r[col("confident")]].join("|"),
    );
    expect(keys).toEqual(R.export.long_keys);
    const withdrawn = ds.students.filter((s) => s.consent !== "granted").map((s) => s.pseudoId);
    expect(t.rows.some((r) => withdrawn.includes(r[0] as string))).toBe(false);
  });

  it("§7.4 scores_wide: skor, delta, N-Gain, kategori, transisi per domain", () => {
    const t = scoresWide(ds, OPTS);
    const rows = t.rows.map((r) => Object.fromEntries(t.columns.map((c, i) => [c, r[i]])));
    expect(rows.map((r) => r.student_pseudo_id)).toEqual(R.export.wide.map((r) => r.student_pseudo_id));
    rows.forEach((r, i) => {
      const e = R.export.wide[i] as Record<string, string | number | null>;
      expect(Object.keys(r)).toEqual(Object.keys(e));
      for (const k of Object.keys(e)) {
        if (typeof e[k] === "number") close(r[k] as number, e[k] as number);
        else expect(r[k], `${e.student_pseudo_id} ${k}`).toBe(e[k]);
      }
    });
  });
});

describe("ekspor: privasi dan format berkas", () => {
  const a = analyze(full, OPTS);
  const tables = allTables(full, a, { appVersion: "test", exportedAt: "2026-10-08T00:00:00Z", scope: "all" });

  it("tidak memuat kode siswa, nama panggilan, atau id internal siswa", () => {
    const text = tables.map(toCsv).join("\n");
    for (const s of full.students) {
      expect(text).not.toContain(s.id);
      if (s.nickname) expect(text).not.toContain(s.nickname);
    }
    expect(tables.map((t) => t.name)).toEqual(["README", "responses_long", "scores_wide", "domain_distribution", "transitions", "stats"]);
  });

  it("CSV: RFC 4180, kutip, dan penangkal formula", () => {
    const csv = toCsv({ name: "x", columns: ["a", "b", "c", "d"], rows: [["=SUM(A1)", 'kata "kutip", koma', -5, null], [true, "-3.5", "@x", 0.5]] });
    expect(csv).toBe('a,b,c,d\r\n\'=SUM(A1),"kata ""kutip"", koma",-5,\r\ntrue,-3.5,\'@x,0.5\r\n');
    expect(toCsv(responsesLong(full)).split("\r\n")[0]).toBe(
      "student_pseudo_id,class_id,phase,item_id,item_order,concept_domain,report_domain,tier1_answer,tier1_correct,reason_answer,reason_correct,confidence_a_level,confidence_r_level,confident,category,rule_set_id,answered_at,response_time_ms,answer_changes",
    );
  });

  it("XLSX: arsip ZIP sah dengan enam sheet dan isi yang sama", () => {
    const buf = buildXlsx(tables);
    // baca ulang direktori pusat ZIP
    const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    const count = buf.readUInt16LE(eocd + 10);
    let p = buf.readUInt32LE(eocd + 16);
    const files = new Map<string, string>();
    for (let i = 0; i < count; i++) {
      const csize = buf.readUInt32LE(p + 20);
      const nlen = buf.readUInt16LE(p + 28);
      const off = buf.readUInt32LE(p + 42);
      const name = buf.subarray(p + 46, p + 46 + nlen).toString();
      const lnlen = buf.readUInt16LE(off + 26);
      const data = buf.subarray(off + 30 + lnlen, off + 30 + lnlen + csize);
      files.set(name, inflateRawSync(data).toString("utf8"));
      p += 46 + nlen;
    }
    expect([...files.keys()]).toContain("xl/workbook.xml");
    for (const n of ["README", "responses_long", "scores_wide", "domain_distribution", "transitions", "stats"]) expect(files.get("xl/workbook.xml")).toContain(`name="${n}"`);
    const long = files.get("xl/worksheets/sheet2.xml")!;
    expect(long.match(/<row /g)).toHaveLength(responsesLong(full).rows.length + 1);
    expect(buildXlsx(tables).equals(buf)).toBe(true);
  });
});

describe("PDF ringkasan kelas (FR-53)", () => {
  it("dibuat tanpa galat, tanpa kode samaran/kode siswa, teks aman WinAnsi", async () => {
    const { buildClassSummaryPdf, pdfSafe } = await import("./pdf");
    const msgs = (await import("@/messages/id.json")).default.hasil.pdf as Record<string, unknown>;
    const tr = (key: string, v: Record<string, string | number> = {}) => {
      const raw = key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], msgs) as string;
      return raw.replace(/\{(\w+)\}/g, (_, k) => String(v[k]));
    };
    const a = analyze(full, OPTS);
    const pdf = Buffer.from(await buildClassSummaryPdf(full, a, { appVersion: "t", exportedAt: "2026-10-10T00:00:00Z", scope: "all", title: "Ringkasan" }, tr));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const text = pdf.toString("latin1");
    for (const s of full.students) {
      expect(text).not.toContain(s.pseudoId);
      expect(text).not.toContain(s.id);
    }
    expect(pdfSafe("a → b ≥ 1 × 2")).toBe("a -> b >= 1 x 2");
  });
});
