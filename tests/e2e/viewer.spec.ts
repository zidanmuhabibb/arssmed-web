import { expect, expectNoA11yViolations, expectNoHorizontalScroll, test } from "./fixtures";

test.describe("Viewer 3D (FR-10 … FR-13)", () => {
  test("unit memiliki tautan jelajah 3D bebas", async ({ page }) => {
    await page.goto("/belajar/u2");
    await page.getByRole("link", { name: "Jelajah 3D bebas" }).click();
    await expect(page).toHaveURL(/\/belajar\/u2\/viewer$/);
    await expect(page.getByRole("heading", { level: 1, name: "Merkurius" })).toBeVisible();
  });

  test("Rel Orbit: navigasi antarobjek + kemajuan tersimpan", async ({ page, consoleErrors }) => {
    void consoleErrors;
    await page.goto("/belajar/u2/viewer");
    const rail = page.getByRole("navigation", { name: "Rel Orbit" });
    await expect(rail.getByRole("button")).toHaveCount(8);
    await expect(rail.getByText("Dilihat 1 dari 8")).toBeVisible();
    await expect(rail.getByText("Ukuran dan jarak tidak sesuai skala")).toBeVisible();
    await rail.getByRole("button", { name: /Venus/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Venus" })).toBeVisible();
    await expect(rail.getByRole("button", { name: /Venus/ })).toHaveAttribute("aria-current", "true");
    await expect(rail.getByText("Dilihat 2 dari 8")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("navigation", { name: "Rel Orbit" }).getByText("Dilihat 2 dari 8")).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("titik info membuka lembar info dengan sumber; Esc menutup", async ({ page }) => {
    await page.goto("/belajar/u2/viewer");
    await page.getByRole("navigation", { name: "Rel Orbit" }).getByRole("button", { name: /Venus/ }).click();
    await page.getByRole("group", { name: "Titik info" }).getByRole("button", { name: /Atmosfer tebal/ }).click();
    const sheet = page.getByRole("dialog", { name: "Atmosfer tebal" });
    await expect(sheet).toContainText("96,5% karbon dioksida");
    await expect(sheet.getByRole("link", { name: /NASA NSSDCA Venus Fact Sheet/ })).toHaveAttribute("href", /nssdc\.gsfc\.nasa\.gov/);
    await expect(page.getByRole("heading", { name: "Atmosfer tebal" })).toBeFocused();
    await sheet.getByRole("button", { name: "Info berikutnya" }).click();
    await expect(page.getByRole("dialog", { name: "Panas terperangkap" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("titik info di kanvas bisa ditekan", async ({ page }) => {
    await page.goto("/belajar/u1/viewer");
    const marker = page.getByRole("button", { name: /^Titik info 1:/ });
    await expect(marker).toBeVisible();
    // Seperti siswa: sentuh kanvas dulu → rotasi otomatis berhenti, titik diam, lalu ketuk titik.
    await page.getByRole("group", { name: /Tampilan 3D Matahari/ }).click({ position: { x: 8, y: 8 } });
    await marker.click();
    await expect(page.getByRole("dialog", { name: "Matahari adalah bintang" })).toBeVisible();
  });

  test("kontrol tombol dan papan ketik tersedia (alternatif gestur)", async ({ page, consoleErrors }) => {
    void consoleErrors;
    await page.goto("/belajar/u2/viewer");
    for (const name of ["Perbesar", "Perkecil", "Putar ke kiri", "Putar ke kanan", "Kembalikan tampilan"]) {
      await page.getByRole("button", { name }).click();
    }
    const canvas = page.getByRole("group", { name: /Tampilan 3D Merkurius/ });
    await canvas.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("+");
    await page.keyboard.press("0");
  });

  test("Baca penjelasan: alternatif teks tanpa 3D", async ({ page }) => {
    await page.goto("/belajar/u2/viewer");
    await page.getByRole("button", { name: "Baca penjelasan" }).click();
    const panel = page.getByRole("region", { name: "Penjelasan Merkurius" });
    await expect(panel).toContainText("Diameter Merkurius 4.879 km");
    await expect(panel).toContainText("Planet");
  });

  test("Bandingkan ukuran sesuai skala", async ({ page }) => {
    await page.goto("/belajar/u2/viewer");
    await page.getByRole("button", { name: "Bandingkan ukuran sesuai skala" }).click();
    const sec = page.getByRole("region", { name: "Ukuran planet sesuai skala" });
    await expect(sec).toContainText("Jupiter");
    await expect(sec).toContainText("11,2× Bumi");
    await expect(sec).toContainText("0,38× Bumi"); // Merkurius
    await page.getByRole("button", { name: "Kembali ke 3D" }).click();
    await expect(sec).toHaveCount(0);
  });

  test("animasi efek rumah kaca Venus: langkah, kecepatan, atmosfer", async ({ page, consoleErrors }) => {
    void consoleErrors;
    await page.goto("/belajar/u2/viewer");
    await expect(page.getByRole("group", { name: "Kontrol animasi" })).toHaveCount(0); // hanya Venus
    await page.getByRole("navigation", { name: "Rel Orbit" }).getByRole("button", { name: /Venus/ }).click();
    const controls = page.getByRole("group", { name: "Kontrol animasi" });
    await expect(page.getByText("Cahaya Matahari masuk menembus atmosfer Venus.")).toBeVisible();
    await controls.getByRole("button", { name: "Langkah berikutnya" }).click();
    await expect(page.getByText("Permukaan Venus menyerap cahaya dan menjadi panas.")).toBeVisible();
    await controls.getByRole("button", { name: "Langkah berikutnya" }).click();
    await expect(page.getByText("Panas ingin keluar, tetapi atmosfer yang tebal menahannya.")).toBeVisible();
    await controls.getByRole("button", { name: "Langkah sebelumnya" }).click();
    await expect(page.getByText("Permukaan Venus menyerap cahaya dan menjadi panas.")).toBeVisible();
    await controls.getByText("2×").click();
    await expect(controls.getByRole("radio", { name: "2×" })).toBeChecked();
    await controls.getByRole("button", { name: "Putar" }).click();
    await expect(controls.getByRole("button", { name: "Jeda" })).toBeVisible();
    await page.getByRole("group", { name: "Sakelar tampilan" }).getByRole("checkbox", { name: "Tampilkan atmosfer" }).uncheck();
  });

  test("tanpa WebGL: gambar statis + deskripsi (degradasi anggun)", async ({ page }) => {
    await page.addInitScript(() => {
      // Uji: matikan WebGL, biarkan konteks 2D bekerja
      const proto = HTMLCanvasElement.prototype as unknown as { getContext: (t: string, ...r: unknown[]) => unknown };
      const orig = proto.getContext;
      proto.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        if (type.startsWith("webgl")) return null;
        return orig.call(this, type, ...rest);
      };
    });
    await page.goto("/belajar/u1/viewer");
    await expect(page.getByText("Tampilan 3D belum bisa dibuka di perangkat ini")).toBeVisible();
    await expect(page.getByText("Matahari adalah bintang terdekat dari Bumi.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Perbesar" })).toHaveCount(0);
  });

  test("lolos axe", async ({ page }) => {
    await page.goto("/belajar/u2/viewer");
    await expect(page.getByRole("heading", { level: 1, name: "Merkurius" })).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test("unit tidak dikenal → halaman tidak ditemukan", async ({ page }) => {
    // Dengan prarender parsial, status bisa 200 bila kerangka sudah terkirim; yang diuji adalah isinya.
    await page.goto("/belajar/u9/viewer");
    await expect(page.getByRole("heading", { name: "Halaman tidak ditemukan" })).toBeVisible();
  });
});
