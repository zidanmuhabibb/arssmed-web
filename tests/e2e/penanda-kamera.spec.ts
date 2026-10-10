import { expect, test } from "./fixtures";

/**
 * M8 · AR penanda dengan kamera palsu Chromium yang menampilkan kartu Unit 2 (tests/fixtures/
 * fake-camera-marker-u2.mjpeg): MindAR harus mengenali kartu dan menampilkan benda.
 * Bukti fungsi pelacakan di mesin uji; tetap perlu uji di HP nyata (PRD §14).
 */
test("kartu Unit 2 dikenali, benda tampil, kamera mati saat Selesai", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/belajar/u2/penanda?objek=jupiter");
  await page.getByRole("button", { name: "Izinkan kamera" }).click();
  const ar = page.getByTestId("marker-ar");
  await expect(ar).toHaveAttribute("data-status", /scanning|found/, { timeout: 90_000 });
  await expect(ar).toHaveAttribute("data-status", "found", { timeout: 90_000 });
  await expect(page.getByTestId("marker-status")).toContainText("Kartu dikenali: Jupiter");
  await page.getByRole("button", { name: "Selesai" }).click();
  await expect(ar).toHaveAttribute("data-status", "intro");
  const live = await page.evaluate(() => {
    const v = document.querySelector("video");
    const s = v?.srcObject as MediaStream | null;
    return s ? s.getTracks().some((t) => t.readyState === "live") : false;
  });
  expect(live).toBe(false);
  expect(errors).toEqual([]);
});
