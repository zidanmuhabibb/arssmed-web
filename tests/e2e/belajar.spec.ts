import type { Browser, Page } from "@playwright/test";
import { expect, expectNoA11yViolations, expectNoHorizontalScroll, test } from "./fixtures";

/**
 * M4 · Alur belajar Tebak → Amati → Bandingkan → Jelaskan (FR-20…24, PRD §14 E2E).
 * Setiap uji memakai kelas & siswa baru agar tidak saling memengaruhi (proyek berjalan paralel).
 */

async function freshStudent(browser: Browser, opts: { free?: boolean } = {}) {
  const t = await browser.newPage();
  await t.goto("/guru/masuk");
  await t.getByLabel("Email").fill("guru@contoh.id");
  await t.getByLabel("Kata sandi").fill("rahasia123");
  await t.getByRole("button", { name: "Masuk" }).click();
  await expect(t).toHaveURL(/\/guru\/kelas$/);
  await t.getByLabel("Nama kelas").fill(`Belajar ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`);
  await t.getByRole("button", { name: "Buat kelas" }).click();
  await expect(t).toHaveURL(/\/guru\/kelas\/[\w-]+$/);
  const joinCode = (await t.getByTestId("join-code").textContent())!.trim();
  await t.getByLabel("Daftar siswa", { exact: true }).fill("kode;nama panggilan\nS01;Rani\n");
  await t.getByRole("button", { name: "Simpan 1 siswa" }).click();
  const line = await t.getByText(/^S01 · Rani · PIN \d{4}$/).textContent();
  const pin = line!.match(/PIN (\d{4})/)![1]!;
  await t.getByRole("button", { name: "Selesai" }).click();
  if (opts.free) {
    const sw = t.getByRole("switch", { name: "Mode bebas" });
    await sw.check();
    await expect(t.getByText("Aktif", { exact: true })).toBeVisible();
    await expect(sw).toBeEnabled(); // aksi server selesai
    await t.reload();
    await expect(t.getByRole("switch", { name: "Mode bebas" })).toBeChecked();
  }
  await t.close();
  return { joinCode, pin };
}

async function login(page: Page, s: { joinCode: string; pin: string }) {
  await page.goto("/masuk");
  await page.getByLabel("Kode kelas").fill(s.joinCode);
  await page.getByLabel("Kode siswa").fill("S01");
  await page.getByLabel("PIN", { exact: true }).fill(s.pin);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/belajar$/);
}

const rail = (page: Page) => page.getByRole("navigation", { name: "Rel Orbit" });

async function viewAll(page: Page) {
  const buttons = rail(page).getByRole("button");
  const n = await buttons.count();
  for (let i = 0; i < n; i++) await buttons.nth(i).click();
  await expect(rail(page).getByText("Semua sudah dilihat")).toBeVisible();
}

test.describe("Alur belajar (FR-20 … FR-24)", () => {
  test("siswa menamatkan satu unit end-to-end; kemajuan tersimpan di server", async ({ page, browser, consoleErrors }) => {
    void consoleErrors;
    test.slow();
    const s = await freshStudent(browser);
    await login(page, s);

    // FR-20: halaman unit — tujuan, urutan langkah, status
    await page.goto("/belajar/u1");
    await expect(page.getByRole("heading", { name: "Tujuan belajar" })).toBeVisible();
    await expect(page.getByTestId("status-tebak")).toHaveText("Bisa dikerjakan");
    await expect(page.getByTestId("status-amati")).toHaveText("Terkunci");
    await expectNoA11yViolations(page);
    await page.getByRole("link", { name: "Mulai: Tebak dulu" }).click();

    // FR-21: Tebak — tanpa skor, jawaban pertama tersimpan
    await expect(page).toHaveURL(/\/belajar\/u1\/tebak$/);
    await page.getByRole("button", { name: "Simpan tebakan" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Pilih satu jawaban di setiap pertanyaan.");
    await page.getByRole("radio", { name: "Bulan membuat cahayanya sendiri." }).check();
    await page.getByRole("radio", { name: "Sangat besar dan terang, seperti Matahari." }).check();
    await expectNoA11yViolations(page);
    await page.getByRole("button", { name: "Simpan tebakan" }).click();
    await expect(page.getByText("Tersimpan", { exact: true })).toHaveCount(2);
    await expect(page.getByRole("radio", { name: "Bulan memantulkan cahaya Matahari." })).toBeDisabled();
    await expect(page.getByRole("main")).not.toContainText(/\b(salah|benar)\b/i);
    await page.getByRole("button", { name: "Lanjut ke Amati" }).click();

    // FR-22: Amati — tombol lanjut aktif setelah semua objek wajib dibuka
    await expect(page).toHaveURL(/\/belajar\/u1\/viewer$/);
    const next = page.getByRole("button", { name: "Lanjut ke Bandingkan" });
    await expect(page.getByText("Lihat 5 benda lagi di Rel Orbit untuk lanjut.")).toBeVisible();
    await expect(next).toBeDisabled();
    await viewAll(page);
    await expect(next).toBeEnabled();
    await next.click();

    // FR-23: Bandingkan — tebakan di samping yang diamati, bahasa netral
    await expect(page).toHaveURL(/\/belajar\/u1\/bandingkan$/);
    const moon = page.getByTestId("compare-u1-cahaya-bulan");
    await expect(moon).toContainText("Bulan membuat cahayanya sendiri.");
    await expect(moon).toContainText("Bulan memantulkan cahaya Matahari.");
    await expect(moon.getByTestId("compare-tone")).toHaveText("Bandingkan dengan tebakanmu.");
    await expect(page.getByTestId("compare-u1-bintang-dekat").getByTestId("compare-tone")).toHaveText("Tebakanmu sama dengan yang kamu lihat.");
    await expect(page.getByRole("main")).not.toContainText(/\bsalah\b/i);
    await expectNoA11yViolations(page);
    await page.getByRole("button", { name: "Lanjut ke Jelaskan" }).click();

    // FR-24: Jelaskan — penjelasan, refleksi, penanda diskusi
    await expect(page).toHaveURL(/\/belajar\/u1\/jelaskan$/);
    await expect(page.getByRole("heading", { name: "Diskusikan dengan teman" })).toBeVisible();
    await page.getByRole("button", { name: "Sudah kudiskusikan" }).click();
    await expect(page.getByTestId("unit-complete")).toContainText("Unit 1 selesai");
    await expectNoHorizontalScroll(page);
    await page.getByRole("link", { name: "Kembali ke daftar unit" }).click();
    await expect(page.getByTestId("unit-status-u1")).toHaveText("Selesai");

    // Tersimpan di server: perangkat lain (tanpa simpanan lokal) melihat status yang sama
    const other = await browser.newContext({ ...test.info().project.use });
    const p2 = await other.newPage();
    await login(p2, s);
    await p2.goto("/belajar/u1");
    for (const step of ["tebak", "amati", "bandingkan", "jelaskan"]) await expect(p2.getByTestId(`status-${step}`)).toHaveText("Selesai");
    await p2.goto("/belajar/u1/tebak");
    await expect(p2.getByRole("radio", { name: "Bulan membuat cahayanya sendiri." })).toBeChecked();
    await other.close();
  });

  test("langkah terkunci sampai langkah sebelumnya selesai", async ({ page, consoleErrors }) => {
    void consoleErrors;
    await page.goto("/belajar/u2/bandingkan");
    await expect(page.getByTestId("step-locked")).toContainText("Langkah sebelumnya belum selesai: Tebak dulu.");
    await page.getByRole("link", { name: "Ke langkah Tebak dulu" }).click();
    await expect(page).toHaveURL(/\/belajar\/u2\/tebak$/);
    // Penjelasan ilmiah tidak tampil sebelum menebak
    await page.goto("/belajar/u2/jelaskan");
    await expect(page.getByTestId("step-locked")).toBeVisible();
    await expect(page.getByText("Venus punya atmosfer karbon dioksida")).toHaveCount(0);
  });

  test("tamu: kemajuan tersimpan di perangkat ini", async ({ page, consoleErrors }) => {
    void consoleErrors;
    await page.goto("/belajar/u3");
    await expect(page.getByText("Kamu belum masuk. Kemajuanmu hanya tersimpan di perangkat ini.")).toBeVisible();
    await page.goto("/belajar/u3/tebak");
    await page.getByRole("radio", { name: "Tanah berbatu yang keras, seperti di Bumi." }).check();
    await page.getByRole("radio", { name: "lebih kecil." }).check();
    await page.getByRole("button", { name: "Simpan tebakan" }).click();
    await expect(page.getByRole("button", { name: "Lanjut ke Amati" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("radio", { name: "Tanah berbatu yang keras, seperti di Bumi." })).toBeChecked();
    await page.goto("/belajar/u3");
    await expect(page.getByTestId("status-tebak")).toHaveText("Selesai");
    await expect(page.getByTestId("status-amati")).toHaveText("Bisa dikerjakan");
  });

  test("mode bebas dari guru: lanjut dari Amati tanpa membuka semua objek", async ({ page, browser, consoleErrors }) => {
    void consoleErrors;
    test.slow();
    const s = await freshStudent(browser, { free: true });
    await login(page, s);
    await page.goto("/belajar/u4/tebak");
    await page.getByRole("radio", { name: "Semuanya jatuh ke tanah." }).check();
    await page.getByRole("button", { name: "Simpan tebakan" }).click();
    await page.getByRole("button", { name: "Lanjut ke Amati" }).click();
    await expect(page.getByText("Gurumu mengaktifkan mode bebas. Kamu boleh lanjut kapan saja.")).toBeVisible();
    await page.getByRole("button", { name: "Lanjut ke Bandingkan" }).click();
    await expect(page).toHaveURL(/\/belajar\/u4\/bandingkan$/);
  });
});

test.describe("Viewer U3–U6 (FR-13)", () => {
  test("meteor: langkah animasi menggerakkan Rel Orbit meteoroid → meteor → meteorit", async ({ page, consoleErrors }) => {
    void consoleErrors;
    await page.goto("/belajar/u4/viewer");
    await expect(page.getByRole("heading", { level: 1, name: "Meteoroid" })).toBeVisible();
    const controls = page.getByRole("group", { name: "Kontrol animasi" });
    await controls.getByRole("button", { name: "Langkah berikutnya" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Meteor" })).toBeVisible();
    await expect(page.getByText("Meteor: batuan masuk atmosfer, terbakar, dan bercahaya terang.")).toBeVisible();
    await controls.getByRole("button", { name: "Langkah berikutnya" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Meteorit" })).toBeVisible();
    await expect(rail(page).getByText("Semua sudah dilihat")).toBeVisible();
    await rail(page).getByRole("button", { name: /Meteoroid$/ }).click();
    await expect(page.getByText("Meteoroid: batuan kecil melayang di luar angkasa menuju Bumi.")).toBeVisible();
    await page.getByRole("checkbox", { name: "Tampilkan atmosfer" }).uncheck();
  });

  test("rotasi: empat langkah pagi–malam dan sakelar sumbu", async ({ page, consoleErrors }) => {
    void consoleErrors;
    await page.goto("/belajar/u5/viewer");
    const controls = page.getByRole("group", { name: "Kontrol animasi" });
    await expect(page.getByText(/Pagi: titik/)).toBeVisible();
    for (const s of [/Siang: titik/, /Sore: titik/, /Malam: titik/]) {
      await controls.getByRole("button", { name: "Langkah berikutnya" }).click();
      await expect(page.getByText(s)).toBeVisible();
    }
    await page.getByRole("checkbox", { name: "Sumbu miring" }).uncheck();
    await page.getByRole("checkbox", { name: "Tampilkan sumbu" }).uncheck();
    await page.getByRole("group", { name: "Titik info" }).getByRole("button", { name: /Titik tempatmu/ }).click();
    await expect(page.getByRole("heading", { name: "Titik tempatmu" })).toBeFocused();
  });

  test("gerhana: semua adegan U3 dan U6 dirender tanpa galat, lolos axe", async ({ page, consoleErrors }) => {
    void consoleErrors;
    for (const u of ["u3", "u6"]) {
      await page.goto(`/belajar/${u}/viewer`);
      await expect(page.locator("canvas")).toBeVisible();
      await viewAll(page);
    }
    await page.getByRole("checkbox", { name: "Tampilkan bayangan" }).uncheck();
    await expectNoHorizontalScroll(page);
    await expectNoA11yViolations(page);
  });
});

test.describe("Halaman Panduan, Materi, Pembuat (FR-03 … FR-05)", () => {
  test("Panduan: enam langkah berilustrasi", async ({ page }) => {
    await page.goto("/panduan");
    await expect(page.getByRole("img")).toHaveCount(6);
    await expect(page.getByRole("heading", { name: "Kamera tidak mau hidup?" })).toBeVisible();
  });
  test("Materi: capaian pembelajaran dan tujuan keenam unit", async ({ page }) => {
    await page.goto("/materi");
    await expect(page.getByText("mendemonstrasikan bagaimana sistem tata surya bekerja", { exact: false })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(6);
  });
  test("Pembuat: peneliti, institusi, dan kolom yang belum diisi ditandai jujur", async ({ page }) => {
    await page.goto("/pembuat");
    await expect(page.getByText("Zidan Muhabib")).toBeVisible();
    await expect(page.getByText("Universitas Muhammadiyah Purwokerto")).toBeVisible();
    await expect(page.getByText("Belum diisi peneliti")).toBeVisible();
  });
});
