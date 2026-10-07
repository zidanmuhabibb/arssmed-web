import { expect, expectNoA11yViolations, expectNoHorizontalScroll, test } from "./fixtures";
import type { Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

async function loginTeacher(page: Page, email = "guru@contoh.id") {
  await page.goto("/guru/masuk");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi").fill("rahasia123");
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/guru\/kelas$/);
}

/** Baris siswa (berlaku untuk tampilan tabel maupun kartu). */
const studentRow = (page: Page, code: string) => page.getByRole("combobox", { name: `Persetujuan orang tua untuk ${code}` });

async function createClass(page: Page, name: string) {
  await page.getByLabel("Nama kelas").fill(name);
  await page.getByRole("radio", { name: /Ikut penelitian/ }).check();
  await page.getByRole("button", { name: "Buat kelas" }).click();
  await expect(page).toHaveURL(/\/guru\/kelas\/[\w-]+$/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

test.describe("Dasbor guru: kelola kelas dan siswa (FR-40)", () => {
  test("daftar kelas hanya milik guru ini", async ({ page, consoleErrors }) => {
    void consoleErrors;
    await loginTeacher(page);
    await expect(page.getByRole("link", { name: /^6A/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /^6B/ })).toHaveCount(0); // milik guru lain
    await expectNoHorizontalScroll(page);
    await expectNoA11yViolations(page);
  });

  test("buat kelas → impor CSV → kartu PDF → siswa baru bisa masuk", async ({ page, browser, consoleErrors, isMobile }) => {
    void consoleErrors;
    await loginTeacher(page);
    const name = `Uji ${Date.now().toString(36)}`;
    await createClass(page, name);
    await expect(page.getByText("Belum ada siswa di kelas ini. Impor daftar siswa untuk mulai.")).toBeVisible();
    const joinCode = (await page.getByTestId("join-code").textContent())!.trim();

    // Pratinjau menangkap galat sebelum dikirim
    await page.getByLabel("Daftar siswa", { exact: true }).fill("kode;nama panggilan\nS01;Raka\ns01;Dobel\n");
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Baris 3: kode S01 sudah dipakai di baris 2.");
    await expect(page.getByRole("button", { name: /Simpan/ })).toBeDisabled();

    await page.getByLabel("Daftar siswa", { exact: true }).fill("kode;nama panggilan\n;Raka\nA-07;Sinta\n;Budi Santoso Putra\n");
    await expect(page.getByText("tampak seperti nama lengkap")).toBeVisible();
    await expect(page.getByText("3 siswa siap disimpan")).toBeVisible();
    await page.getByRole("button", { name: "Simpan 3 siswa" }).click();
    await expect(page.getByRole("heading", { name: "3 siswa tersimpan" })).toBeVisible();

    const line = await page.getByText(/^S01 · Raka · PIN \d{4}$/).textContent();
    const pin = line!.match(/PIN (\d{4})/)![1]!;

    // Unduhan blob tidak dipicu di emulasi HP Playwright; diuji di desktop (D-029).
    if (!isMobile) {
      const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Unduh kartu masuk (PDF)" }).click()]);
      expect(download.suggestedFilename()).toMatch(/^kartu-masuk-.*\.pdf$/);
      const pdf = await PDFDocument.load(await (await download.createReadStream()).toArray().then((c) => Buffer.concat(c)));
      expect(pdf.getPageCount()).toBe(1);
    }
    await expectNoHorizontalScroll(page);

    await page.getByRole("button", { name: "Selesai" }).click();
    await expect(studentRow(page, "A-07")).toBeVisible();
    await expect(studentRow(page, "S02")).toBeVisible(); // Budi: kode otomatis berikutnya

    // Siswa baru masuk di perangkat lain
    const student = await browser.newPage();
    await student.goto("/masuk");
    await student.getByLabel("Kode kelas").fill(joinCode);
    await student.getByLabel("Kode siswa").fill("S01");
    await student.getByLabel("PIN", { exact: true }).fill(pin);
    await student.getByRole("button", { name: "Masuk" }).click();
    await expect(student).toHaveURL(/\/belajar$/);
    await student.close();
  });

  test("persetujuan, PIN baru, dan hapus siswa", async ({ page, consoleErrors }) => {
    void consoleErrors;
    await loginTeacher(page);
    await createClass(page, `Persetujuan ${Date.now().toString(36)}`);
    await page.getByLabel("Daftar siswa", { exact: true }).fill("Raka\nSinta\n");
    await page.getByRole("button", { name: "Simpan 2 siswa" }).click();
    await page.getByRole("button", { name: "Selesai" }).click();

    const consent = page.getByLabel("Persetujuan orang tua untuk S01");
    await expect(consent).toHaveValue("pending");
    await consent.selectOption("granted");
    await page.reload();
    await expect(page.getByLabel("Persetujuan orang tua untuk S01")).toHaveValue("granted");

    await page.getByRole("button", { name: /Buat PIN baru.*S02/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Buat PIN baru" }).click();
    await expect(page.getByRole("dialog", { name: "PIN baru untuk S02" })).toBeVisible();
    await expect(page.getByRole("dialog").getByText(/^\d{4}$/)).toBeVisible();
    await page.getByRole("button", { name: "Selesai" }).click();

    await page.getByRole("button", { name: /Hapus.*S02/ }).click();
    await expect(page.getByRole("dialog")).toContainText("Hapus S02 beserta semua jawabannya?");
    await page.getByRole("dialog").getByRole("button", { name: "Hapus" }).click();
    await expect(studentRow(page, "S02")).toHaveCount(0);
    await expect(studentRow(page, "S01")).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test("guru lain tidak bisa membuka kelas ini", async ({ page }) => {
    await loginTeacher(page, "guru2@contoh.id");
    await page.goto("/guru/kelas/mem-class-6a");
    await expect(page.getByRole("heading", { name: /tidak ditemukan/i })).toBeVisible();
  });
});
