/**
 * PDF ringkasan kelas (FR-53) dengan pdf-lib: tanpa nama/kode siswa, hanya angka agregat.
 * Teks diterjemahkan lewat `tr` (messages/id.json → hasil.pdf.*), bukan ditulis di sini.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { CATEGORIES, type Category } from "@/lib/classification";
import { PATTERNS } from "@/lib/transitions";
import type { ClassAnalysis } from "./analyze";
import type { ExportMeta } from "./export";
import type { AnalysisDataset } from "./types";

export type Translate = (key: string, values?: Record<string, string | number>) => string;

const INK = rgb(0.08, 0.16, 0.24);
const MUTED = rgb(0.27, 0.35, 0.43);
const LINE = rgb(0.8, 0.85, 0.88);
const CAT: Record<Category, [number, number, number]> = {
  SC: [0.12, 0.54, 0.44],
  M: [0.76, 0.23, 0.31],
  E: [0.72, 0.47, 0.12],
  LK: [0.36, 0.42, 0.5],
  LC: [0.48, 0.36, 0.71],
};

/** Font standar PDF memakai WinAnsi: ganti karakter di luar himpunan itu. */
const SAFE: Record<string, string> = { "→": "->", "≥": ">=", "≤": "<=", "−": "-", "×": "x", "…": "...", " ": " ", " ": " " };
export const pdfSafe = (s: string) => s.replace(/[→≥≤−×…  ]/g, (c) => SAFE[c] ?? "?").replace(/[^\x20-\x7e -ÿ–—‘’“”•±]/g, "?");

const nf = (x: number, d = 1) => (Number.isFinite(x) ? new Intl.NumberFormat("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d }).format(x) : "-");
const pf = (p: number) => (p < 0.001 ? "< 0,001" : nf(p, 3));

class Writer {
  page!: PDFPage;
  y = 0;
  readonly W = 595.28;
  readonly H = 841.89;
  readonly M = 48;
  constructor(
    private doc: PDFDocument,
    readonly font: PDFFont,
    readonly bold: PDFFont,
  ) {
    this.newPage();
  }
  newPage() {
    this.page = this.doc.addPage([this.W, this.H]);
    this.y = this.H - this.M;
  }
  ensure(h: number) {
    if (this.y - h < this.M) this.newPage();
  }
  text(s: string, o: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; x?: number; gap?: number } = {}) {
    const size = o.size ?? 10;
    const f = o.bold ? this.bold : this.font;
    const maxW = this.W - this.M - (o.x ?? this.M);
    const words = pdfSafe(s).split(" ");
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(next, size) > maxW && cur) {
        lines.push(cur);
        cur = w;
      } else cur = next;
    }
    if (cur) lines.push(cur);
    for (const l of lines) {
      this.ensure(size * 1.4);
      this.page.drawText(l, { x: o.x ?? this.M, y: this.y - size, size, font: f, color: o.color ?? INK });
      this.y -= size * 1.4;
    }
    this.y -= o.gap ?? 2;
  }
  heading(s: string) {
    this.y -= 8;
    this.ensure(40);
    this.text(s, { size: 13, bold: true, gap: 4 });
  }
  rule() {
    this.page.drawLine({ start: { x: this.M, y: this.y }, end: { x: this.W - this.M, y: this.y }, thickness: 0.5, color: LINE });
    this.y -= 6;
  }
  /** Tabel sederhana: kolom pertama lebar, sisanya rata. */
  table(head: string[], rows: string[][], firstW = 150) {
    const rest = (this.W - 2 * this.M - firstW) / Math.max(1, head.length - 1);
    const xs = head.map((_, i) => this.M + (i === 0 ? 0 : firstW + (i - 1) * rest));
    const row = (cells: string[], b: boolean) => {
      this.ensure(16);
      cells.forEach((c, i) => this.page.drawText(pdfSafe(c), { x: xs[i]!, y: this.y - 10, size: 9, font: b ? this.bold : this.font, color: INK }));
      this.y -= 15;
    };
    row(head, true);
    this.rule();
    for (const r of rows) row(r, false);
    this.y -= 4;
  }
}

export async function buildClassSummaryPdf(ds: AnalysisDataset, a: ClassAnalysis, meta: ExportMeta & { title: string }, tr: Translate): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(pdfSafe(meta.title));
  doc.setCreator("ARSSMED Web");
  doc.setProducer("ARSSMED Web (pdf-lib)");
  const w = new Writer(doc, await doc.embedFont(StandardFonts.Helvetica), await doc.embedFont(StandardFonts.HelveticaBold));
  const label = (d: string) => ds.domains.find((x) => x.id === d)?.label ?? d;
  const order = (d: string) => ds.domains.findIndex((x) => x.id === d);

  w.text(tr("brand"), { size: 9, color: MUTED });
  w.text(meta.title, { size: 18, bold: true, gap: 4 });
  w.text(tr("meta", { test: ds.testName, version: ds.testVersion, ruleSet: ds.ruleSetId, score: a.options.scoreMethod, transition: a.options.transitionMode, date: meta.exportedAt.slice(0, 10) }), { size: 9, color: MUTED, gap: 8 });
  w.text(tr("interpretation"), { size: 10, bold: true, gap: 8 });

  const p = a.participation;
  w.heading(tr("participation"));
  w.text(p.population === "paired" ? tr("paired", { n: p.paired.length }) : tr("perPhase", { pre: p.phaseStudents.pre.length, post: p.phaseStudents.post.length }));
  w.text(
    `${tr("excluded")}: ${Object.entries(p.excludedByReason)
      .map(([k, n]) => `${tr(`reason.${k}`)} ${n}`)
      .join(" · ")}`,
    { color: MUTED },
  );

  const s = a.statistics;
  w.heading(tr("stats"));
  const rows: string[][] = [];
  if (s.descriptive.ok) {
    rows.push([tr("scorePre"), `${nf(s.descriptive.value.preMean)} ± ${nf(s.descriptive.value.preSd)}`]);
    rows.push([tr("scorePost"), `${nf(s.descriptive.value.postMean)} ± ${nf(s.descriptive.value.postSd)}`]);
  }
  if (s.nGain.ok) {
    const g = s.nGain.value;
    rows.push([tr("ngain"), tr("ngainValue", { mean: nf(g.mean, 3), sd: nf(g.sd, 3), lower: nf(g.ci.lower, 3), upper: nf(g.ci.upper, 3), category: g.category, n: g.n })]);
    rows.push([tr("ngainCats"), `${tr("high")} ${s.nGainCategories.tinggi} · ${tr("medium")} ${s.nGainCategories.sedang} · ${tr("low")} ${s.nGainCategories.rendah}`]);
  }
  if (s.tTest.ok) {
    const t = s.tTest.value;
    rows.push([tr("ttest"), `t(${t.df}) = ${nf(t.t, 3)}; p ${t.p < 0.001 ? "" : "= "}${pf(t.p)}; ${tr("meanDiff")} ${nf(t.meanDiff, 2)} [${nf(t.ciDiff.lower, 2)}; ${nf(t.ciDiff.upper, 2)}]`]);
    rows.push([tr("effect"), `d_z = ${nf(t.cohenDz, 3)}; g_z = ${nf(t.hedgesGz, 3)}`]);
  }
  if (s.wilcoxon.ok) rows.push([tr("wilcoxon"), `W = ${nf(s.wilcoxon.value.W, 1)}; z = ${nf(s.wilcoxon.value.z, 3)}; p ${s.wilcoxon.value.p < 0.001 ? "" : "= "}${pf(s.wilcoxon.value.p)}`]);
  if (s.shapiro.ok) rows.push([tr("shapiro"), `W = ${nf(s.shapiro.value.W, 4)}; p ${s.shapiro.value.p < 0.001 ? "" : "= "}${pf(s.shapiro.value.p)}`]);
  if (s.kr20Pre.ok && s.kr20Post.ok) rows.push([tr("kr20"), `${tr("pre")} ${nf(s.kr20Pre.value.kr20, 3)} · ${tr("post")} ${nf(s.kr20Post.value.kr20, 3)}`]);
  if (rows.length === 0) w.text(tr("unavailable"), { color: MUTED });
  else w.table([tr("measure"), tr("value")], rows, 150);

  w.heading(tr("distribution"));
  const domainIds = [...new Set([...a.distribution.pre, ...a.distribution.post].map((d) => d.domain))].sort((x, y) => order(x) - order(y));
  for (const id of domainIds) {
    for (const phase of ["pre", "post"] as const) {
      const d = a.distribution[phase].find((x) => x.domain === id);
      if (!d) continue;
      w.ensure(34);
      w.text(`${label(d.domain)} · ${tr(phase)} (n = ${d.nResponses})`, { size: 9, bold: true, gap: 1 });
      // Batang bertumpuk + angka tertulis (warna bukan satu-satunya pembeda).
      let x = w.M;
      const width = w.W - 2 * w.M;
      for (const c of CATEGORIES) {
        const ww = (d.percent[c] / 100) * width;
        if (ww > 0) w.page.drawRectangle({ x, y: w.y - 9, width: ww, height: 9, color: rgb(...CAT[c]) });
        x += ww;
      }
      w.y -= 13;
      w.text(CATEGORIES.map((c) => `${c} ${nf(d.percent[c])}%`).join("   "), { size: 8, color: MUTED, gap: 4 });
    }
  }
  w.text(CATEGORIES.map((c) => `${c} = ${tr(`category.${c}`)}`).join(" · "), { size: 8, color: MUTED });

  if (a.discuss && a.discuss.rows.length) {
    w.heading(tr("discuss", { phase: tr(a.discuss.phase) }));
    for (const r of a.discuss.rows) {
      w.text(`${r.item.code} · ${r.item.indicator ?? ""} (M ${r.counts.M}/${r.n})`, { bold: true, size: 10, gap: 0 });
      if (r.item.alternativeConceptions) w.text(`${tr("alternative")}: ${r.item.alternativeConceptions}`, { size: 9, color: MUTED });
    }
  }

  if (a.transitions.length) {
    w.heading(tr("transitions", { mode: a.options.transitionMode }));
    w.table(
      [tr("domain"), ...PATTERNS.map((pp) => tr(`pattern.${pp}`)), "n"],
      [...a.transitions].sort((x, y) => order(x.domain) - order(y.domain)).map((t) => [label(t.domain), ...PATTERNS.map((pp) => String(t.patternCounts[pp])), String(t.nUnits)]),
      170,
    );
  }

  w.y -= 6;
  w.rule();
  w.text(tr("footer", { version: meta.appVersion }), { size: 8, color: MUTED });
  return doc.save({ useObjectStreams: true });
}
