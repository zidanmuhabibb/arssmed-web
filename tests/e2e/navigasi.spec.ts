import { expect, expectNoA11yViolations, expectNoHorizontalScroll, isDesktop, test } from "./fixtures";

test.describe("Navigasi (FR-02)", () => {
  test("tiga tujuan utama dengan penanda halaman aktif", async ({ page, consoleErrors }) => {
    void consoleErrors;
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Navigasi utama" });
    await expect(nav).toHaveCount(1); // hanya satu yang terlihat: tab bawah ATAU rel kiri
    for (const name of ["Belajar", "Tes", "Panduan"]) {
      await expect(nav.getByRole("link", { name })).toBeVisible();
    }
    await expect(nav.getByRole("link", { name: "Belajar" })).toHaveAttribute("aria-current", "page");

    await nav.getByRole("link", { name: "Tes" }).click();
    await expect(page).toHaveURL(/\/tes$/);
    await expect(nav.getByRole("link", { name: "Tes" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "Belajar" })).not.toHaveAttribute("aria-current", "page");

    await nav.getByRole("link", { name: "Panduan" }).click();
    await expect(page).toHaveURL(/\/panduan$/);
    await expect(page.getByRole("heading", { level: 1, name: "Panduan" })).toBeVisible();
  });

  test("tab bawah di mobile, rel kiri di desktop", async ({ page }) => {
    await page.goto("/belajar");
    const nav = page.getByRole("navigation", { name: "Navigasi utama" });
    const box = (await nav.boundingBox())!;
    const vp = page.viewportSize()!;
    if (isDesktop(page)) {
      expect(box.x).toBe(0);
      expect(box.height).toBeGreaterThanOrEqual(vp.height - 1);
    } else {
      expect(Math.round(box.y + box.height)).toBeGreaterThanOrEqual(vp.height - 1);
      expect(box.width).toBeGreaterThanOrEqual(vp.width - 1);
    }
  });

  test("area sentuh navigasi ≥ 48px", async ({ page }) => {
    await page.goto("/");
    const links = page.getByRole("navigation", { name: "Navigasi utama" }).getByRole("link");
    for (const link of await links.all()) {
      const b = (await link.boundingBox())!;
      expect(b.height).toBeGreaterThanOrEqual(48);
      expect(b.width).toBeGreaterThanOrEqual(48);
    }
  });

  test("tautan lewati-navigasi memindahkan fokus ke isi", async ({ page, browserName }) => {
    test.skip(browserName === "webkit", "Safari tidak memfokuskan tautan dengan Tab secara bawaan");
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Langsung ke isi" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#isi$/);
  });

  for (const path of ["/belajar", "/belajar/u2", "/tes", "/panduan", "/materi", "/pembuat", "/privasi", "/masuk", "/offline"]) {
    test(`halaman ${path}: axe dan tanpa geser horizontal`, async ({ page, consoleErrors }) => {
      void consoleErrors;
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 }).or(page.getByRole("heading", { level: 2 })).first()).toBeVisible();
      await expectNoHorizontalScroll(page);
      await expectNoA11yViolations(page);
    });
  }
});

test.describe("Tes untuk tamu", () => {
  test("diminta masuk dan tidak ada butir (skenario tertutup diuji di tes.spec.ts)", async ({ page }) => {
    await page.goto("/tes");
    await expect(page.getByRole("heading", { name: "Masuk dulu untuk mengerjakan tes" })).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(0);
  });
});

test.describe("Halaman tidak ditemukan", () => {
  test("404 berbahasa Indonesia dengan jalan kembali", async ({ page }) => {
    const res = await page.goto("/tidak-ada");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Halaman tidak ditemukan" })).toBeVisible();
    await page.getByRole("link", { name: "Kembali ke Beranda" }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});
