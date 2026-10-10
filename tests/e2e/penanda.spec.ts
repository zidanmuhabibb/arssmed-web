import { expect, expectNoA11yViolations, expectNoHorizontalScroll, test } from "./fixtures";

/** M8 · AR penanda (FR-15, FR-16): layar penjelasan, cadangan 3D, kartu cetak di Panduan. */
test.describe("AR dengan kartu penanda", () => {
  test("dibuka dari Viewer; layar penjelasan kamera sebelum izin; lewati → 3D", async ({ page, consoleErrors }) => {
    void consoleErrors;
    await page.goto("/belajar/u2/viewer");
    await page.getByRole("link", { name: "AR dengan kartu" }).click();
    await expect(page).toHaveURL(/\/belajar\/u2\/penanda\?objek=/);
    const ar = page.getByTestId("marker-ar");
    await expect(ar).toHaveAttribute("data-status", "intro");
    await expect(ar).toContainText("Tidak ada foto atau video yang disimpan atau dikirim");
    await expect(ar.getByRole("link", { name: "Unduh kartu (PDF)" })).toHaveAttribute("href", "/markers/kartu-penanda.pdf");
    // Belum ada permintaan kamera / pustaka AR sebelum siswa setuju
    const loaded: string[] = [];
    page.on("request", (r) => loaded.push(r.url()));
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    expect(loaded.some((u) => u.includes("/vendor/mindar") || u.endsWith(".mind"))).toBe(false);
    await page.getByRole("link", { name: "Lewati, pakai 3D saja" }).click();
    await expect(page).toHaveURL(/\/belajar\/u2\/viewer$/);
  });

  test("kamera ditolak atau tidak ada → pesan ramah dan tombol 3D (FR-15 fallback)", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/belajar/u1/penanda");
    await page.getByRole("button", { name: "Izinkan kamera" }).click();
    const ar = page.getByTestId("marker-ar");
    await expect(ar).toHaveAttribute("data-status", /denied|unsupported/);
    await expect(page.getByTestId("marker-fallback").getByRole("link", { name: "Buka 3D" })).toHaveAttribute("href", "/belajar/u1/viewer");
    expect(errors).toEqual([]);
  });

  test("Panduan menyediakan PDF kartu penanda", async ({ page }) => {
    await page.goto("/panduan");
    const link = page.getByTestId("marker-guide").getByRole("link", { name: "Unduh kartu penanda (PDF)" });
    const res = await page.request.get((await link.getAttribute("href"))!);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/pdf");
    expect((await res.body()).subarray(0, 5).toString()).toBe("%PDF-");
  });
});
