import practice from "../../content/practice.json";
import { expect, expectNoA11yViolations, expectNoHorizontalScroll, test } from "./fixtures";

/** M8 · Kuis latihan (FR-26) dan kartu diskusi guru (FR-25, FR-45). */

test.describe("Kuis latihan (FR-26)", () => {
  test("umpan balik langsung, bahasa netral, tanpa menyimpan ke server", async ({ page, consoleErrors }) => {
    void consoleErrors;
    const posts: string[] = [];
    page.on("request", (r) => r.method() !== "GET" && posts.push(r.url()));
    await page.goto("/belajar/u2");
    await page.getByRole("link", { name: "Kuis latihan" }).click();
    await expect(page).toHaveURL(/\/belajar\/u2\/kuis$/);
    const qs = practice.units.u2;
    await expect(page.getByRole("group")).toHaveCount(qs.length);

    const [first, second] = qs;
    const wrong = first!.options.find((o) => o.key !== first!.correct)!;
    await page.getByTestId(`quiz-${first!.key}`).getByLabel(wrong.text).check();
    const fb = page.getByTestId(`feedback-${first!.key}`);
    await expect(fb).toHaveAttribute("data-result", "belum");
    await expect(fb).toContainText("Belum tepat.");
    await page.getByTestId(`quiz-${first!.key}`).getByLabel(first!.options.find((o) => o.key === first!.correct)!.text).check();
    await expect(fb).toHaveAttribute("data-result", "tepat");
    await expect(fb).toContainText(first!.feedback);

    for (const q of qs.slice(1)) await page.getByTestId(`quiz-${q.key}`).getByLabel(q.options.find((o) => o.key === q.correct)!.text).check();
    await expect(page.getByTestId("quiz-summary")).toContainText(`${qs.length} dari ${qs.length} jawabanmu tepat`);
    await expect(page.getByRole("main")).not.toContainText(/\b(salah|benar)\b/i);
    void second;
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    expect(posts).toEqual([]);
  });
});

test.describe("Aksesibilitas papan ketik (M8)", () => {
  test("kuis bisa dikerjakan hanya dengan papan ketik; umpan balik diumumkan", async ({ page, browserName }) => {
    test.skip(browserName === "webkit", "Safari tidak memfokuskan kontrol dengan Tab secara bawaan");
    await page.goto("/belajar/u5/kuis");
    const first = practice.units.u5[0]!;
    const group = page.getByTestId(`quiz-${first.key}`);
    await group.getByRole("radio").first().focus();
    await page.keyboard.press("Space");
    await expect(page.getByTestId(`feedback-${first.key}`)).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await expect(group.getByRole("radio").nth(1)).toBeChecked();
    await expect(group.locator("[aria-live=polite]")).toContainText(/Tepat\.|Belum tepat\./);
  });

  test("AR dengan kartu: tombol izin dan lewati terjangkau Tab", async ({ page, browserName }) => {
    test.skip(browserName === "webkit", "Safari tidak memfokuskan kontrol dengan Tab secara bawaan");
    await page.goto("/belajar/u3/penanda");
    const allow = page.getByRole("button", { name: "Izinkan kamera" });
    for (let i = 0; i < 40 && !(await allow.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Tab");
    await expect(allow).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Lewati, pakai 3D saja" })).toBeFocused();
  });
});

test.describe("Kartu diskusi guru (FR-25)", () => {
  test("dibuka dari Yang perlu dibahas, menuju kartu unit terkait", async ({ page }) => {
    await page.goto("/guru/masuk");
    await page.getByLabel("Email").fill("guru3@contoh.id");
    await page.getByLabel("Kata sandi").fill("rahasia123");
    await page.getByRole("button", { name: "Masuk" }).click();
    await expect(page).toHaveURL(/\/guru\/kelas$/);
    await page.goto("/guru/kelas/syn-class-a/hasil");
    // B08 (planet terbesar) → unit 2
    const link = page.getByTestId("discuss").getByRole("link", { name: "Kartu diskusi: Planet dan karakteristiknya" });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/guru\/kartu-diskusi#u2$/);
    const card = page.getByTestId("card-u2");
    await expect(card).toContainText("Merkurius paling dekat dengan Matahari, tetapi Venus yang paling panas");
    await expect(card).toContainText("MK-U2-A");
    await expect(page.getByTestId("card-u6")).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
  });

  test("hanya untuk guru", async ({ page }) => {
    await page.goto("/guru/kartu-diskusi");
    await expect(page).toHaveURL(/\/guru\/masuk/);
  });
});
