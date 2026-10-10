import type { Browser, Page } from "@playwright/test";
import { expect, isDesktop, test } from "./fixtures";

/**
 * M8 · Pentest dasar otomatis (PRD §12.4, §15 M8): header keamanan, tanpa pelacak pihak ketiga,
 * kontrol akses API per peran, kunci jawaban tidak sampai ke siswa, XSS tersimpan, pembatasan laju,
 * pemetaan nama khusus admin dengan konfirmasi. Lihat juga SECURITY.md.
 */

async function staff(page: Page, email: string) {
  await page.goto("/guru/masuk");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi").fill("rahasia123");
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/guru\/kelas$/);
}

async function student(page: Page, joinCode: string, code: string, pin: string) {
  await page.goto("/masuk");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Kode kelas").fill(joinCode);
  await page.getByLabel("Kode siswa").fill(code);
  await page.getByLabel("PIN", { exact: true }).fill(pin);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/belajar$/);
}

/** Kelas baru dengan satu siswa ber-nama panggilan berbahaya, persetujuan diberikan, pretest dibuka. */
async function classWithOpenTest(browser: Browser, nickname: string) {
  const t = await browser.newPage();
  await staff(t, "guru@contoh.id");
  await t.getByLabel("Nama kelas").fill(`Aman ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`);
  await t.getByRole("radio", { name: /Ikut penelitian/ }).check();
  await t.getByRole("button", { name: "Buat kelas" }).click();
  await expect(t).toHaveURL(/\/guru\/kelas\/[\w-]+$/);
  const classId = t.url().split("/").pop()!;
  const joinCode = (await t.getByTestId("join-code").textContent())!.trim();
  await t.getByLabel("Daftar siswa", { exact: true }).fill(`kode;nama panggilan\nS01;${nickname}\n`);
  await t.getByRole("button", { name: "Simpan 1 siswa" }).click();
  const pin = (await t.getByText(/^S01 · .* · PIN \d{4}$/).textContent())!.match(/PIN (\d{4})/)![1]!;
  await t.getByRole("button", { name: "Selesai" }).click();
  await t.getByLabel("Persetujuan orang tua untuk S01").selectOption("granted");
  await expect(t.getByLabel("Persetujuan orang tua untuk S01")).toHaveValue("granted");
  await t.getByTestId("control-pre").getByRole("button", { name: /Buka/ }).click();
  await t.getByRole("dialog").getByRole("button", { name: "Buka tes" }).click();
  await expect(t.getByTestId("status-pre")).toHaveText("Dibuka — siswa bisa mengerjakan");
  return { t, classId, joinCode, pin };
}

test.describe("Pentest dasar (M8)", () => {
  test("header keamanan: CSP ketat, tanpa bingkai, tanpa X-Powered-By", async ({ page }) => {
    const res = await page.goto("/");
    const h = res!.headers();
    const csp = h["content-security-policy"]!;
    for (const d of ["default-src 'self'", "object-src 'none'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'"]) expect(csp).toContain(d);
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toMatch(/https?:\/\/(?!127\.0\.0\.1|localhost)/);
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["permissions-policy"]).toContain("camera=(self)");
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("tidak ada permintaan ke pihak ketiga (pelacak, font, CDN)", async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin;
    const foreign: string[] = [];
    page.on("request", (r) => {
      const u = r.url();
      if (!u.startsWith(origin) && !u.startsWith("data:") && !u.startsWith("blob:")) foreign.push(u);
    });
    for (const path of ["/", "/belajar", "/belajar/u2/viewer", "/belajar/u3/kuis", "/panduan", "/belajar/u1/penanda"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
    }
    expect(foreign).toEqual([]);
  });

  test("API tanpa sesi ditolak; siswa tidak bisa memakai API guru/riset", async ({ page }) => {
    const r = page.request;
    expect((await r.get("/api/riset/statistik")).status()).toBe(401);
    expect((await r.get("/api/riset/ekspor?format=csv&kelas=syn-class-a")).status()).toBe(401);
    expect((await r.post("/api/riset/pemetaan", { data: { confirm: "x" } })).status()).toBe(401);
    expect((await r.get("/api/guru/kelas/mem-class-6a/tes")).status()).toBe(401);
    expect((await r.put("/api/tes/attempt/apa-saja/respons", { data: {} })).status()).toBe(400);
    expect((await r.post("/api/tes/attempt/apa-saja/selesai")).status()).toBe(401);
    expect(await (await r.get("/api/tes/status")).json()).toEqual({ tests: [] });

    await student(page, "K7M2QX", "S01", "1234");
    expect((await r.get("/api/riset/statistik")).status()).toBe(401);
    expect((await r.get("/api/riset/ekspor?format=json&kelas=mem-class-6a")).status()).toBe(401);
    expect((await r.get("/api/guru/kelas/mem-class-6a/tes")).status()).toBe(401);
    await page.goto("/guru/kelas");
    await expect(page).toHaveURL(/\/guru\/masuk/);
    await page.goto("/riset");
    await expect(page).toHaveURL(/\/guru\/masuk/);
  });

  test("guru tidak bisa membaca kelas guru lain lewat API", async ({ page }) => {
    await staff(page, "guru@contoh.id");
    expect((await page.request.get("/api/guru/kelas/mem-class-6b/tes")).status()).toBe(404);
    expect((await page.request.get("/api/riset/ekspor?format=json&kelas=mem-class-6b")).status()).toBe(404);
  });

  test("XSS tersimpan lewat nama panggilan tidak dieksekusi; kunci jawaban tidak dikirim ke siswa", async ({ page, browser }) => {
    test.setTimeout(120_000);
    const payload = "<img src=x onerror=alert(1)>";
    const dialogs: string[] = [];
    const { t, classId, joinCode, pin } = await classWithOpenTest(browser, payload);
    t.on("dialog", (d) => {
      dialogs.push(d.message());
      void d.dismiss();
    });
    await t.goto(`/guru/kelas/${classId}`);
    await expect(t.getByText(payload).first()).toBeVisible();
    expect(await t.locator("img[src='x']").count()).toBe(0);

    page.on("dialog", (d) => {
      dialogs.push(d.message());
      void d.dismiss();
    });
    await student(page, joinCode, "S01", pin);
    // Nama tampil sebagai teks biasa (sapaan), bukan elemen HTML.
    await expect(page.getByText(`Halo, ${payload}`).first()).toBeAttached();
    expect(await page.locator("img[src='x']").count()).toBe(0);
    const res = await page.request.get("/api/tes/pre/mulai");
    const body = await res.text();
    expect(JSON.parse(body).items).toHaveLength(20);
    expect(body).not.toMatch(/"correct"|"meta"|"maps_to_misconception"|"misconception/);
    expect(dialogs).toEqual([]);
    await t.close();
  });

  test("pemetaan nama: konfirmasi wajib, admin saja, CSV terpisah", async ({ page }) => {
    await staff(page, "guru3@contoh.id");
    expect((await page.request.post("/api/riset/pemetaan", { data: { confirm: "SAYA MENJAGA KERAHASIAAN DATA" } })).status()).toBe(401);
    await staff(page, "peneliti@contoh.id");
    expect((await page.request.post("/api/riset/pemetaan", { data: { confirm: "ya" } })).status()).toBe(400);
    await page.goto("/riset?kelas=syn-class-a");
    const box = page.getByTestId("name-map");
    await box.getByRole("textbox").fill("SAYA MENJAGA KERAHASIAAN DATA");
    const [download] = await Promise.all([page.waitForEvent("download"), box.getByRole("button", { name: "Unduh pemetaan" }).click()]);
    expect(download.suggestedFilename()).toMatch(/^arssmed_pemetaan_RAHASIA_\d{4}-\d{2}-\d{2}\.csv$/);
    const text = await (await import("node:fs/promises")).readFile((await download.path())!, "utf8");
    const lines = text.trimEnd().split("\r\n");
    expect(lines[0]).toBe("student_pseudo_id,class_name,student_code,nickname,consent");
    expect(lines).toHaveLength(21); // kelas A sintetis: 20 siswa
  });

  test("pembatasan laju: unduhan pemetaan berulang → 429 dengan Retry-After", async ({ page }) => {
    test.skip(!isDesktop(page), "satu kali cukup (akun khusus uji)");
    await staff(page, "peneliti2@contoh.id");
    // Batas riset_name_map 5 / 10 menit (×10 di uji e2e, ARSSMED_RATE_LIMIT_SCALE)
    let last = 0;
    let retryAfter: string | undefined;
    for (let i = 0; i < 51; i++) {
      const r = await page.request.post("/api/riset/pemetaan", { data: { confirm: "SAYA MENJAGA KERAHASIAAN DATA", kelas: "syn-class-b" } });
      last = r.status();
      retryAfter = r.headers()["retry-after"];
      if (last !== 200) break;
    }
    expect(last).toBe(429);
    expect(retryAfter).toBe("60");
  });
});
