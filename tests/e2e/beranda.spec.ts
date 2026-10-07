import { expect, expectNoA11yViolations, expectNoHorizontalScroll, isDesktop, test } from "./fixtures";

test.describe("Beranda (FR-01)", () => {
  test("menampilkan sapaan, tombol utama, dan tautan pendukung", async ({ page, consoleErrors }) => {
    void consoleErrors;
    await page.goto("/");
    await expect(page).toHaveTitle(/ARSSMED/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Halo! Siap menjelajah tata surya?");
    await expect(page.getByRole("link", { name: "Mulai belajar" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Panduan.*Cara memakai/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Profil pembuat/ })).toBeVisible();
    await expect(page.getByText("Ukuran dan jarak tidak sesuai skala")).toBeVisible();
    // Tes belum dibuka guru → tombol tes tidak tampil
    await expect(page.getByRole("link", { name: "Kerjakan tes" })).toHaveCount(0);
  });

  test("Mulai belajar membuka daftar unit", async ({ page, consoleErrors }) => {
    void consoleErrors;
    await page.goto("/");
    await page.getByRole("link", { name: "Mulai belajar" }).click();
    await expect(page).toHaveURL(/\/belajar$/);
    await expect(page.getByRole("heading", { level: 1, name: "Belajar" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Benda langit/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Gerhana/ })).toBeVisible();
  });

  test("tanpa geser horizontal dan tombol utama cukup besar", async ({ page }) => {
    await page.goto("/");
    await expectNoHorizontalScroll(page);
    const box = await page.getByRole("link", { name: "Mulai belajar" }).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(48);
    if (!isDesktop(page)) {
      // Lebar penuh di mobile (PRD §8.4): selebar kolom isi
      const contentWidth = await page.locator("main").evaluate((el) => {
        const s = getComputedStyle(el);
        return el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
      });
      expect(Math.abs(box!.width - contentWidth)).toBeLessThanOrEqual(1);
    }
  });

  test("lolos axe (WCAG 2.1 AA), terang dan gelap", async ({ page }) => {
    await page.goto("/");
    await expectNoA11yViolations(page);
    await page.emulateMedia({ colorScheme: "dark" });
    await expectNoA11yViolations(page);
  });
});
