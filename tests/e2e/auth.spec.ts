import { expect, expectNoA11yViolations, expectNoHorizontalScroll, test } from "./fixtures";

const rand = () => Math.random().toString(36).slice(2, 8).toUpperCase();

test.describe("Masuk siswa", () => {
  test("formulir bisa diakses dan lolos axe", async ({ page, consoleErrors }) => {
    void consoleErrors;
    await page.goto("/masuk");
    await expect(page.getByLabel("Kode kelas")).toBeVisible();
    await expect(page.getByLabel("Kode siswa")).toBeVisible();
    const pin = page.getByLabel("PIN", { exact: true });
    await expect(pin).toHaveAttribute("inputmode", "numeric");
    await expect(pin).toHaveAttribute("type", "password");
    await expectNoHorizontalScroll(page);
    await expectNoA11yViolations(page);
  });

  test("isian kosong → pesan ramah, tanpa kata 'salah'", async ({ page }) => {
    await page.goto("/masuk");
    await page.getByRole("button", { name: "Masuk" }).click();
    const alert = page.getByRole("main").getByRole("alert");
    await expect(alert).toHaveText("Isi ketiga kotak dulu. PIN berisi 4 angka.");
    await expect(alert).not.toContainText("salah");
  });

  test("PIN belum cocok lalu dibatasi setelah 5 percobaan", async ({ page }) => {
    await page.goto("/masuk");
    await page.waitForLoadState("networkidle"); // tunggu skrip siap agar setiap kiriman lewat JSON
    await page.locator("form[data-ready]").waitFor();
    const code = `X${rand()}`;
    for (let i = 0; i < 5; i++) {
      await page.getByLabel("Kode kelas").fill("K7M2QX");
      await page.getByLabel("Kode siswa").fill(code);
      await page.getByLabel("PIN", { exact: true }).fill("0000");
      await page.getByRole("button", { name: "Masuk" }).click();
      await expect(page.getByRole("main").getByRole("alert")).toContainText("belum cocok");
    }
    await page.getByRole("button", { name: "Masuk" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Terlalu banyak percobaan. Coba lagi dalam 10 menit");
  });

  test("tombol ditekan sebelum skrip siap: PIN tidak masuk alamat, galat tetap tampil", async ({ browser, page }, info) => {
    const ctx = await browser.newContext({ ...info.project.use, javaScriptEnabled: false });
    const p = await ctx.newPage();
    await p.goto("/masuk");
    await p.getByLabel("Kode kelas").fill("K7M2QX");
    await p.getByLabel("Kode siswa").fill(`Y${rand()}`);
    await p.getByLabel("PIN", { exact: true }).fill("9999");
    await p.getByLabel("PIN", { exact: true }).press("Enter"); // kiriman formulir biasa
    await expect(p).toHaveURL(/\/masuk\?galat=invalid_credentials$/);
    expect(p.url()).not.toContain("9999");
    // Siswa contoh berhasil masuk tanpa skrip
    await p.getByLabel("Kode kelas").fill("K7M2QX");
    await p.getByLabel("Kode siswa").fill("S02");
    await p.getByLabel("PIN", { exact: true }).fill("5678");
    await p.getByLabel("PIN", { exact: true }).press("Enter");
    await expect(p).toHaveURL(/\/belajar$/);
    await ctx.close();
    // Dengan skrip, galat dari alamat ditampilkan
    await page.goto("/masuk?galat=invalid_credentials");
    await expect(page.getByRole("main").getByRole("alert")).toContainText("belum cocok");
  });

  test("siswa contoh bisa masuk, melihat namanya, lalu keluar", async ({ page }) => {
    await page.goto("/masuk");
    await page.getByLabel("Kode kelas").fill("k7m2qx");
    await page.getByLabel("Kode siswa").fill("s01");
    await page.getByLabel("PIN", { exact: true }).fill("1234");
    await page.getByRole("button", { name: "Masuk" }).click();
    await expect(page).toHaveURL(/\/belajar$/);
    await expect(page.getByText("Halo, Raka").first()).toBeAttached();
    // Pintu satu arah: kembali tidak membuka formulir masuk
    await page.goBack();
    await expect(page).not.toHaveURL(/\/masuk$/);
    await page.goto("/belajar");
    await page.getByRole("button", { name: "Keluar" }).first().click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("link", { name: "Masuk" }).first()).toBeVisible();
  });
});

test.describe("Masuk guru", () => {
  test("halaman guru tanpa sesi diarahkan ke formulir masuk", async ({ page }) => {
    await page.goto("/guru/kelas");
    await expect(page).toHaveURL(/\/guru\/masuk$/);
    await expectNoA11yViolations(page);
  });

  test("email/kata sandi belum cocok", async ({ page }) => {
    await page.goto("/guru/masuk");
    await page.getByLabel("Email").fill("guru@contoh.id");
    await page.getByLabel("Kata sandi").fill("keliru");
    await page.getByRole("button", { name: "Masuk" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Email atau kata sandi belum cocok.");
  });

  test("kartu siswa tidak bisa dipakai untuk area guru", async ({ page }) => {
    await page.goto("/masuk");
    await page.getByLabel("Kode kelas").fill("K7M2QX");
    await page.getByLabel("Kode siswa").fill("S02");
    await page.getByLabel("PIN", { exact: true }).fill("5678");
    await page.getByRole("button", { name: "Masuk" }).click();
    await expect(page).toHaveURL(/\/belajar$/);
    await page.goto("/guru/kelas");
    await expect(page).toHaveURL(/\/guru\/masuk$/);
  });
});
