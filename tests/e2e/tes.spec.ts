import type { Browser, Page } from "@playwright/test";
import { expect, expectNoA11yViolations, expectNoHorizontalScroll, test } from "./fixtures";

/**
 * M6 · Mesin tes diagnostik (FR-30…FR-36, FR-41, FR-60) dan skenario penerimaan PRD §14:
 * pretest 20 butir selesai walau jaringan putus di tengah; tes tertutup tidak mengirim butir.
 */

async function teacherWithClass(browser: Browser, opts: { consent?: boolean; open?: boolean } = {}) {
  const t = await browser.newPage();
  await t.goto("/guru/masuk");
  await t.getByLabel("Email").fill("guru@contoh.id");
  await t.getByLabel("Kata sandi").fill("rahasia123");
  await t.getByRole("button", { name: "Masuk" }).click();
  await expect(t).toHaveURL(/\/guru\/kelas$/);
  await t.getByLabel("Nama kelas").fill(`Tes ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`);
  await t.getByRole("radio", { name: /Ikut penelitian/ }).check();
  await t.getByRole("button", { name: "Buat kelas" }).click();
  await expect(t).toHaveURL(/\/guru\/kelas\/[\w-]+$/);
  const joinCode = (await t.getByTestId("join-code").textContent())!.trim();
  await t.getByLabel("Daftar siswa", { exact: true }).fill("kode;nama panggilan\nS01;Tari\n");
  await t.getByRole("button", { name: "Simpan 1 siswa" }).click();
  const pin = (await t.getByText(/^S01 · Tari · PIN \d{4}$/).textContent())!.match(/PIN (\d{4})/)![1]!;
  await t.getByRole("button", { name: "Selesai" }).click();
  if (opts.consent !== false) {
    await t.getByLabel("Persetujuan orang tua untuk S01").selectOption("granted");
    await expect(t.getByLabel("Persetujuan orang tua untuk S01")).toHaveValue("granted");
  }
  if (opts.open !== false) await openTest(t, "pre");
  return { t, joinCode, pin };
}

async function openTest(t: Page, phase: "pre" | "post") {
  await t.getByTestId(`control-${phase}`).getByRole("button", { name: /Buka/ }).click();
  await t.getByRole("dialog").getByRole("button", { name: "Buka tes" }).click();
  await expect(t.getByTestId(`status-${phase}`)).toHaveText("Dibuka — siswa bisa mengerjakan");
}

async function login(page: Page, joinCode: string, pin: string) {
  await page.goto("/masuk");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Kode kelas").fill(joinCode);
  await page.getByLabel("Kode siswa").fill("S01");
  await page.getByLabel("PIN", { exact: true }).fill(pin);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/belajar$/);
}

/** Jawab butir yang tampil: tier muncul bertahap, pilih opsi pertama / "Yakin". */
async function answerCurrent(page: Page) {
  for (const tier of ["tier1", "confidenceA", "reason", "confidenceR"]) {
    const group = page.getByTestId(`tier-${tier}`);
    await expect(group).toBeVisible();
    await group.locator("label").first().click();
  }
}

test.describe("Tes diagnostik (FR-30 … FR-36)", () => {
  test("tamu diminta masuk; tes tertutup → pesan dan tidak ada butir terkirim (PRD §14)", async ({ page, browser, consoleErrors }) => {
    void consoleErrors;
    await page.goto("/tes");
    await expect(page.getByText("Masuk dulu untuk mengerjakan tes")).toBeVisible();
    const { t, joinCode, pin } = await teacherWithClass(browser, { open: false });
    await t.close();
    await login(page, joinCode, pin);
    await page.goto("/tes");
    await expect(page.getByRole("heading", { name: "Tes belum dibuka" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Kerjakan tes" })).toHaveCount(0);
    const items: string[] = [];
    page.on("response", async (r) => {
      if (r.url().includes("/api/tes/pre/mulai")) items.push(await r.text());
    });
    await page.goto("/tes/pre");
    await expect(page.getByRole("heading", { name: "Tes belum dibuka" })).toBeVisible();
    await expect(page.getByText("Tanyakan ke gurumu.", { exact: false })).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(0);
    expect(items.join("")).not.toContain("stem");
  });

  test("FR-60: siswa tanpa persetujuan tidak bisa mengerjakan", async ({ page, browser }) => {
    const { t, joinCode, pin } = await teacherWithClass(browser, { consent: false });
    await t.close();
    await login(page, joinCode, pin);
    await page.goto("/tes");
    await expect(page.getByTestId("test-card-pre")).toContainText("Gurumu perlu mencatat persetujuan orang tuamu dulu.");
    await expect(page.getByRole("link", { name: "Mulai tes" })).toHaveCount(0);
  });

  test("pretest 20 butir selesai walau jaringan putus di butir 12–15; guru melihat Selesai", async ({ page, browser }) => {
    test.setTimeout(180_000);
    // Saat luring, browser wajar mencatat "ERR_INTERNET_DISCONNECTED"; galat lain tetap tidak boleh ada.
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && !m.text().includes("ERR_INTERNET_DISCONNECTED") && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    const { t, joinCode, pin } = await teacherWithClass(browser);
    await login(page, joinCode, pin);

    // FR-01: tombol "Kerjakan tes" muncul di Beranda saat tes dibuka
    await page.goto("/");
    await page.getByRole("link", { name: "Kerjakan tes" }).click();
    await expect(page).toHaveURL(/\/tes\/pre$/);
    await expect(page.getByText("Soal 1 dari 20", { exact: true })).toBeVisible();

    // FR-32: tier tampil bertahap, tidak bisa dilewati; "Lanjut" aktif setelah semua bagian
    await expect(page.getByTestId("tier-confidenceA")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Lanjut" })).toBeDisabled();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);

    for (let n = 1; n <= 20; n++) {
      await expect(page.getByTestId("test-item")).toHaveAttribute("data-item-order", String(n));
      if (n === 12) await page.context().setOffline(true);
      await answerCurrent(page);
      if (n >= 12 && n <= 15) await expect(page.getByTestId("sync-status")).toHaveAttribute("data-sync", "waiting");
      if (n === 15) {
        await expect(page.getByTestId("sync-status")).toContainText("Menunggu internet");
        await page.context().setOffline(false);
        await expect(page.getByTestId("sync-status")).toHaveAttribute("data-sync", "saved", { timeout: 40_000 });
      }
      if (n === 3) {
        // FR-33: kembali ke butir sebelumnya; jawaban tetap ada
        await page.getByRole("button", { name: "Sebelumnya" }).click();
        await expect(page.getByTestId("test-item")).toHaveAttribute("data-item-order", "2");
        await expect(page.getByTestId("tier-confidenceR")).toBeVisible();
        await page.getByRole("button", { name: "Lanjut" }).click();
      }
      await page.getByRole("button", { name: n === 20 ? "Periksa jawaban" : "Lanjut" }).click();
    }

    await expect(page.getByTestId("test-review")).toContainText("Sudah 20 dari 20 soal terjawab lengkap");
    await expect(page.getByTestId("sync-status")).toHaveAttribute("data-sync", "saved", { timeout: 20_000 });
    await page.getByRole("button", { name: "Selesaikan tes" }).click();

    // FR-36: layar penutup netral, tanpa hasil
    const done = page.getByTestId("test-done");
    await expect(done).toContainText("Tes selesai");
    await expect(page.getByRole("main")).not.toContainText(/\b(SC|Miskonsepsi|benar|salah|skor)\b/i);
    await page.goto("/tes");
    await expect(page.getByTestId("test-card-pre")).toContainText("Sudah kamu selesaikan");

    // FR-41: guru melihat siswa selesai, 20 butir masuk tanpa duplikat
    await t.reload();
    await expect(t.getByTestId("row-pre-S01")).toContainText("Selesai");
    await expect(t.getByTestId("done-pre")).toHaveText("Selesai: 1 dari 1 siswa yang sudah ada persetujuan");
    await t.close();
    expect(errors).toEqual([]);
  });

  test("melanjutkan setelah memuat ulang; guru melihat kemajuan; tes ditutup → siswa tidak bisa lanjut", async ({ page, browser }) => {
    test.setTimeout(120_000);
    const { t, joinCode, pin } = await teacherWithClass(browser);
    await login(page, joinCode, pin);
    await page.goto("/tes/pre");
    for (let n = 1; n <= 3; n++) {
      await answerCurrent(page);
      await expect(page.getByTestId("sync-status")).toHaveAttribute("data-sync", "saved");
      await page.getByRole("button", { name: "Lanjut" }).click();
    }
    await page.reload();
    await expect(page.getByText("Soal 4 dari 20", { exact: true })).toBeVisible();
    await t.reload();
    await expect(t.getByTestId("row-pre-S01")).toContainText("Mengerjakan (3/20)");
    await t.getByTestId("control-pre").getByRole("button", { name: "Tutup tes" }).click();
    await t.getByRole("dialog").getByRole("button", { name: "Tutup tes" }).click();
    await expect(t.getByTestId("status-pre")).toHaveText("Ditutup");
    await t.close();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Tes belum dibuka" })).toBeVisible();
  });
});
