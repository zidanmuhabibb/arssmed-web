import type { Page } from "@playwright/test";
import { expect, expectNoA11yViolations, isDesktop, test } from "./fixtures";

/**
 * M5 · AR permukaan (FR-14), layar izin kamera (FR-16), deteksi perangkat (FR-17), cadangan 3D.
 * AR sungguhan butuh HP fisik; di sini diuji keputusan & tautan yang dibuka (klik tautan dicegat).
 */

/** Cegat klik tautan AR (intent:// atau rel="ar") agar tidak benar-benar meninggalkan halaman. */
async function captureArLinks(page: Page, opts: { quickLook?: boolean } = {}) {
  await page.addInitScript((ql) => {
    const w = window as unknown as { __ar: { href: string; rel: string; img: boolean }[] };
    w.__ar = [];
    const orig = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      if (this.href.startsWith("intent:") || this.rel === "ar") {
        w.__ar.push({ href: this.href, rel: this.rel, img: this.firstElementChild?.tagName === "IMG" });
        return;
      }
      return orig.call(this);
    };
    if (ql) {
      const supports = DOMTokenList.prototype.supports;
      DOMTokenList.prototype.supports = function (this: DOMTokenList, t: string) {
        return t === "ar" ? true : supports.call(this, t);
      };
    }
  }, !!opts.quickLook);
}
const launched = (page: Page) => page.evaluate(() => (window as unknown as { __ar: { href: string; rel: string; img: boolean }[] }).__ar);

test.describe("AR permukaan (FR-14, FR-16, FR-17)", () => {
  test("laptop: tombol nonaktif dengan penjelasan ramah, 3D tetap ada", async ({ page, consoleErrors }) => {
    void consoleErrors;
    test.skip(!isDesktop(page), "khusus laptop");
    await page.goto("/belajar/u2/viewer");
    await expect(page.getByTestId("ar-panel")).toHaveAttribute("data-ar-mode", "none");
    const btn = page.getByRole("button", { name: "Lihat di ruanganmu" });
    await expect(btn).toBeDisabled();
    await expect(page.getByText("AR hanya bisa di HP Android atau iPhone.", { exact: false })).toBeVisible();
    await expect(page.locator("canvas")).toBeVisible();
  });

  test("Android: layar izin kamera dulu, lalu Scene Viewer dengan model GLB", async ({ page, consoleErrors }, info) => {
    void consoleErrors;
    test.skip(info.project.name !== "pixel-5", "khusus Android");
    await captureArLinks(page);
    await page.goto("/belajar/u2/viewer");
    await expect(page.getByTestId("ar-panel")).toHaveAttribute("data-ar-mode", "scene-viewer");
    await page.getByRole("button", { name: "Lihat di ruanganmu" }).click();

    const dialog = page.getByRole("dialog", { name: "Kamera akan dipakai" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Tidak ada foto atau video yang disimpan atau dikirim.");
    await expectNoA11yViolations(page);

    // Lewati → tetap di 3D, tidak ada AR yang dibuka
    await dialog.getByRole("button", { name: "Lewati, pakai 3D saja" }).click();
    await expect(dialog).toBeHidden();
    expect(await launched(page)).toEqual([]);
    await expect(page.getByRole("button", { name: "Lihat di ruanganmu" })).toBeFocused();

    // Izinkan → intent Scene Viewer dengan berkas GLB benda yang sedang dilihat
    await page.getByRole("button", { name: "Lihat di ruanganmu" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Izinkan kamera" }).click();
    const [link] = await launched(page);
    expect(link!.href).toMatch(/^intent:\/\/arvr\.google\.com\/scene-viewer\/1\.2\?mode=ar_preferred/);
    expect(decodeURIComponent(link!.href)).toContain("/models/merkurius.glb");
    expect(decodeURIComponent(link!.href)).toContain("#tanpa-ar");

    // Izin diingat selama sesi: klik berikutnya langsung membuka AR
    await page.getByRole("navigation", { name: "Rel Orbit" }).getByRole("button", { name: /Venus$/ }).click();
    await page.getByRole("button", { name: "Lihat di ruanganmu" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    const links = await launched(page);
    expect(decodeURIComponent(links[1]!.href)).toContain("/models/venus.glb");
  });

  test("Android: Scene Viewer gagal → kembali ke 3D dengan pesan, tombol dinonaktifkan", async ({ page, consoleErrors }, info) => {
    void consoleErrors;
    test.skip(info.project.name !== "pixel-5", "khusus Android");
    await page.goto("/belajar/u5/viewer#tanpa-ar");
    await expect(page.getByRole("status").filter({ hasText: "AR belum bisa dibuka." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Lihat di ruanganmu" })).toBeDisabled();
    await expect(page).not.toHaveURL(/#tanpa-ar/);
    await expect(page.locator("canvas")).toBeVisible();
  });

  test("iPhone: AR Quick Look memakai tautan rel=ar berisi gambar ke berkas USDZ", async ({ page, consoleErrors }, info) => {
    void consoleErrors;
    test.skip(info.project.name !== "iphone-13", "khusus iPhone");
    await captureArLinks(page, { quickLook: true });
    await page.goto("/belajar/u6/viewer");
    await expect(page.getByTestId("ar-panel")).toHaveAttribute("data-ar-mode", "quick-look");
    await page.getByRole("button", { name: "Lihat di ruanganmu" }).click();
    await expect(page.getByRole("dialog")).toContainText("ketuk AR");
    await page.getByRole("dialog").getByRole("button", { name: "Izinkan kamera" }).click();
    const [link] = await launched(page);
    expect(link).toMatchObject({ rel: "ar", img: true });
    expect(link!.href).toMatch(/\/models\/gerhana-matahari\.usdz$/);
  });

  test("iPhone tanpa dukungan Quick Look: tombol nonaktif dengan saran browser", async ({ page }, info) => {
    test.skip(info.project.name !== "iphone-13", "khusus iPhone");
    await page.goto("/belajar/u1/viewer");
    await expect(page.getByTestId("ar-panel")).toHaveAttribute("data-ar-mode", "none");
    await expect(page.getByText("Browser ini belum bisa membuka AR.", { exact: false })).toBeVisible();
  });

  test("berkas model disajikan dengan tipe MIME yang tepat", async ({ request }) => {
    const usdz = await request.get("/models/bumi.usdz");
    expect(usdz.status()).toBe(200);
    expect(usdz.headers()["content-type"]).toBe("model/vnd.usdz+zip");
    const glb = await request.get("/models/zona-planet.glb");
    expect(glb.headers()["content-type"]).toBe("model/gltf-binary");
    expect((await glb.body()).subarray(0, 4).toString()).toBe("glTF");
  });
});
