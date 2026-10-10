import type { Page } from "@playwright/test";
import ref from "../fixtures/analysis-reference.json";
import synthetic from "../fixtures/analysis-synthetic.json";
import { expect, expectNoA11yViolations, expectNoHorizontalScroll, isDesktop, test } from "./fixtures";

/**
 * M7 · Dasbor guru, statistik peneliti, ekspor (FR-42…FR-46, FR-51…FR-53, FR-61).
 * Backend memori memuat kelas contoh dari dataset SINTETIS yang sama dengan hitungan rujukan
 * pandas/SciPy, sehingga angka di layar bisa dibandingkan langsung (kriteria M7).
 */

const nf = (x: number, d: number) => new Intl.NumberFormat("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d }).format(x);
const A = ref.scopes["syn-class-a"];
const ALL = ref.scopes.all;
const code = (order: number) => `B${String(order).padStart(2, "0")}`;

async function signIn(page: Page, email: string) {
  await page.goto("/guru/masuk");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi").fill("rahasia123");
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/guru\/kelas$/);
}

test.describe("Dasbor dan statistik (M7)", () => {
  test("guru: profil konsepsi, yang perlu dibahas, peta butir, profil siswa = rujukan", async ({ page, consoleErrors }) => {
    void consoleErrors;
    await signIn(page, "guru3@contoh.id");
    await page.getByRole("link", { name: /6A \(sintetis\)/ }).click();
    await page.getByRole("link", { name: "Lihat hasil kelas" }).click();
    await expect(page).toHaveURL(/\/guru\/kelas\/syn-class-a\/hasil$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hasil kelas 6A (sintetis)");

    // FR-46
    await expect(page.getByTestId("interpretation-note")).toHaveText("Desain satu kelompok tanpa pembanding: hasil menggambarkan perubahan yang teramati, bukan bukti sebab-akibat.");
    // §6.4: populasi berpasangan + alasan dikeluarkan
    await expect(page.getByTestId("participation")).toContainText(`Dianalisis: ${A.paired.length} siswa`);
    await expect(page.getByTestId("participation")).toContainText("Persetujuan ditarik: 1");
    await expect(page.getByTestId("summary-n")).toContainText(String(A.paired.length));
    const g = A.stats.score_sc.ngain;
    await expect(page.getByTestId("summary-ngain")).toContainText(`${nf(g.mean, 2)} (${g.category})`);
    await expect(page.getByTestId("summary-ngain")).toContainText(`CI 95%: ${nf(g.ci_low, 2)}–${nf(g.ci_high, 2)}`);

    // FR-45: tiga butir dengan M terbanyak pada tes akhir
    const discuss = page.getByTestId("discuss").getByRole("listitem");
    await expect(discuss).toHaveCount(3);
    for (const [i, r] of A.item_map.post.slice(0, 3).entries()) await expect(discuss.nth(i)).toContainText(`Butir ${code(r.item_order)}`);

    // FR-42: persentase per domain sama dengan rujukan
    for (const phase of ["pre", "post"] as const)
      for (const d of A.distribution[phase]) {
        const line = page.getByTestId(`bar-values-${d.domain}-${phase}`);
        await expect(line).toContainText(`SC ${nf(d.percent.SC, 1)}%`);
        await expect(line).toContainText(`M ${nf(d.percent.M, 1)}%`);
        await expect(line).toContainText(`n = ${d.n_responses}`);
      }

    // FR-43: urutan peta butir (tes akhir) dan jawaban terbanyak
    const rows = page.getByTestId("item-map").locator("tbody tr");
    await expect(rows).toHaveCount(20);
    const first = A.item_map.post[0]!;
    await expect(rows.first()).toHaveAttribute("data-testid", `item-row-${code(first.item_order)}`);
    await expect(rows.first()).toContainText(`${first.top_tier1.key} · ${first.top_tier1.count} siswa`);
    await page.getByRole("link", { name: "Tes awal", exact: true }).click();
    await expect(page).toHaveURL(/fase=pre/);
    await expect(rows.first()).toHaveAttribute("data-testid", `item-row-${code(A.item_map.pre[0]!.item_order)}`);

    // FR-44: siswa dengan skor awal 100 → N-Gain tak terdefinisi; siswa tanpa persetujuan tidak tampil
    await expect(page.getByTestId("student-S05")).toContainText("100");
    await expect(page.getByTestId("student-S19")).toHaveCount(0);
    await expect(page.getByTestId("student-S20")).toHaveCount(0);
    await expect(page.getByTestId("student-S18")).toContainText("belum");

    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
  });

  test("guru: ekspor CSV/XLSX kelasnya — hanya kode samaran, tanpa siswa withdrawn (FR-53, FR-61)", async ({ page }) => {
    await signIn(page, "guru3@contoh.id");
    const long = await page.request.get("/api/riset/ekspor?kelas=syn-class-a&format=csv&tabel=responses_long");
    expect(long.status()).toBe(200);
    expect(long.headers()["content-type"]).toContain("text/csv");
    expect(long.headers()["content-disposition"]).toMatch(/attachment; filename="arssmed_syn-class-a_\d{4}-\d{2}-\d{2}_responses_long\.csv"/);
    const lines = (await long.text()).trimEnd().split("\r\n");
    expect(lines[0]).toBe(
      "student_pseudo_id,class_id,phase,item_id,item_order,concept_domain,report_domain,tier1_answer,tier1_correct,reason_answer,reason_correct,confidence_a_level,confidence_r_level,confident,category,rule_set_id,answered_at,response_time_ms,answer_changes",
    );
    expect(lines).toHaveLength(A.export.long_count + 1);
    const body = lines.join("\n");
    for (const s of synthetic.students.filter((x) => x.class_id === "syn-class-a")) {
      expect(body).not.toContain(s.id);
      if (s.consent !== "granted") expect(body).not.toContain(s.pseudo_id);
    }

    const wide = await page.request.get("/api/riset/ekspor?kelas=syn-class-a&format=csv&tabel=scores_wide");
    expect((await wide.text()).trimEnd().split("\r\n")).toHaveLength(A.export.wide.length + 1);

    const xlsx = await page.request.get("/api/riset/ekspor?kelas=syn-class-a&format=xlsx");
    expect(xlsx.headers()["content-type"]).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect((await xlsx.body()).subarray(0, 2).toString()).toBe("PK");

    // Tombol unduh di halaman memakai rute yang sama
    await page.goto("/guru/kelas/syn-class-a/hasil");
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "CSV respons (format panjang)" }).click()]);
    expect(download.suggestedFilename()).toMatch(/_responses_long\.csv$/);
  });

  test("guru lain dan tamu tidak bisa membuka hasil atau ekspor kelas ini", async ({ page }) => {
    const anon = await page.request.get("/api/riset/ekspor?kelas=syn-class-a&format=csv");
    expect(anon.status()).toBe(401);
    await signIn(page, "guru@contoh.id");
    // Halaman dialirkan (PPR) sehingga status HTTP sudah 200; yang diuji: isi 404, bukan data kelas.
    await page.goto("/guru/kelas/syn-class-a/hasil");
    await expect(page.getByRole("heading", { name: "Halaman tidak ditemukan" })).toBeVisible();
    await expect(page.getByTestId("item-map")).toHaveCount(0);
    expect((await page.request.get("/api/riset/ekspor?kelas=syn-class-a&format=csv")).status()).toBe(404);
    // semua kelas = admin saja
    expect((await page.request.get("/api/riset/ekspor?format=csv")).status()).toBe(401);
    await page.goto("/riset");
    await expect(page.getByText("Halaman ini hanya untuk akun peneliti.")).toBeVisible();
  });

  test("peneliti: statistik, transisi, ganti skor & kelas, API statistik = rujukan", async ({ page }) => {
    await signIn(page, "peneliti@contoh.id");
    if (isDesktop(page)) await page.getByRole("link", { name: "Riset" }).click();
    else await page.goto("/riset");
    await expect(page).toHaveURL(/\/riset$/);
    await expect(page.getByTestId("interpretation-note")).toBeVisible();

    const S = ALL.stats.score_sc;
    await expect(page.getByTestId("stat-ngain")).toContainText(`${nf(S.ngain.mean, 2)} · ${S.ngain.category}`);
    await expect(page.getByTestId("stat-ngain")).toContainText(`CI 95% ${nf(S.ngain.ci_low, 4)} sampai ${nf(S.ngain.ci_high, 4)}`);
    await expect(page.getByTestId("stat-ttest")).toContainText(`t(${S.ttest.df}) = ${nf(S.ttest.t, 3)}`);
    await expect(page.getByTestId("stat-effect")).toContainText(`d_z = ${nf(S.ttest.cohen_dz, 3)}`);
    await expect(page.getByTestId("stat-wilcoxon")).toContainText(`W = ${nf(S.wilcoxon.W, 1)}`);
    await expect(page.getByTestId("stat-shapiro")).toContainText(`W = ${nf(S.shapiro.W, 4)}`);
    await expect(page.getByTestId("stat-kr20")).toContainText(`Awal ${nf(S.kr20_pre.kr20, 3)} · akhir ${nf(S.kr20_post.kr20, 3)}`);

    // FR-52: pola transisi per domain (per butir) dan invarian
    for (const tr of ALL.transitions.per_butir) {
      const box = page.getByTestId(`patterns-${tr.domain}`);
      await expect(box).toContainText(`Retensi ${tr.pattern_counts.retention}`);
      await expect(box).toContainText(`Lainnya ${tr.pattern_counts.other}`);
      await expect(page.getByTestId(`transition-${tr.domain}`)).toContainText(`${tr.n_units} = ${tr.n_units} ✓`);
    }
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);

    // Pengaturan: kelas A + score_tier1 + modus
    const form = page.locator('form[action="/riset"]');
    await form.getByRole("combobox", { name: "Kelas" }).selectOption({ label: "6A (sintetis)" });
    await form.getByRole("combobox", { name: "Skor" }).selectOption("score_tier1");
    await form.getByRole("combobox", { name: "Transisi" }).selectOption("modus");
    await page.getByRole("button", { name: "Terapkan" }).click();
    await expect(page).toHaveURL(/kelas=syn-class-a.*skor=score_tier1.*transisi=modus/);
    await expect(page.getByTestId("stat-ngain")).toContainText(`${nf(A.stats.score_tier1.ngain.mean, 2)} · ${A.stats.score_tier1.ngain.category}`);
    for (const tr of A.transitions.modus) await expect(page.getByTestId(`patterns-${tr.domain}`)).toContainText(`Revisi ${tr.pattern_counts.revision}`);

    // GET /api/riset/statistik
    const api = await (await page.request.get("/api/riset/statistik?kelas=syn-class-a&skor=score_tier1&transisi=modus")).json();
    const T = A.stats.score_tier1;
    expect(api.statistics.n).toBe(A.paired.length);
    expect(api.statistics.n_gain.mean).toBeCloseTo(T.ngain.mean, 12);
    expect(api.statistics.t_test.t).toBeCloseTo(T.ttest.t, 10);
    expect(api.statistics.wilcoxon.p).toBeCloseTo(T.wilcoxon.p, 12);
    expect(api.transitions.map((x: { pattern_counts: unknown }) => x.pattern_counts)).toEqual(A.transitions.modus.map((x) => x.pattern_counts));
    expect(JSON.stringify(api)).not.toContain("syn-class-a-s");

    // JSON mentah semua kelas (uji e2e lain bisa menambah respons di kelas barunya → minimal rujukan)
    const json = await (await page.request.get("/api/riset/ekspor?format=json")).json();
    expect(json.readme.rule_set_id).toBe("pedoman-v1");
    expect(json.responses_long.length).toBeGreaterThanOrEqual(ALL.export.long_count);
  });

  test("mode gelap: dasbor dan halaman riset tetap lolos axe (kontras)", async ({ browser, page }) => {
    test.skip(!isDesktop(page), "cukup sekali di desktop");
    const ctx = await browser.newContext({ colorScheme: "dark" });
    const dark = await ctx.newPage();
    await signIn(dark, "peneliti@contoh.id");
    await dark.goto("/guru/kelas/syn-class-a/hasil");
    await expect(dark.getByTestId("student-profiles")).toBeVisible();
    await expectNoA11yViolations(dark);
    await dark.goto("/riset");
    await expect(dark.getByTestId("stat-ngain")).toBeVisible();
    await expectNoA11yViolations(dark);
    await ctx.close();
  });

  test("ringkasan PDF kelas (FR-53) dan reklasifikasi dengan aturan lain (admin, PRD §11)", async ({ page }) => {
    await signIn(page, "guru3@contoh.id");
    const pdf = await page.request.get("/api/riset/ekspor?kelas=syn-class-a&format=pdf");
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
    // Guru tidak boleh menghitung ulang klasifikasi
    expect((await page.request.post("/api/riset/reklasifikasi", { data: { aturan: "default-v1", kelas: "syn-class-b" } })).status()).toBe(401);

    await signIn(page, "peneliti@contoh.id");
    await page.goto("/riset?kelas=syn-class-b&aturan=default-v1");
    const form = page.getByTestId("reclassify");
    await expect(form).toBeVisible();
    await form.getByRole("button", { name: "Hitung ulang klasifikasi" }).click();
    await expect(page).toHaveURL(/aturan=default-v1.*reklasifikasi=\d+/);
    await expect(page.getByTestId("reclassified")).toContainText("dengan aturan default-v1");
    await expect(page.getByTestId("reclassify")).toContainText("bukan aturan tes");
    const api = await (await page.request.get("/api/riset/statistik?kelas=syn-class-b&aturan=default-v1")).json();
    expect(api.test.rule_set_id).toBe("default-v1");
    expect(api.statistics.n).toBe(11);
  });
});
