import { expect, test } from "./fixtures";

test.describe("PWA shell", () => {
  test("manifest valid dan ikon tersedia", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.ok()).toBe(true);
    const m = await res.json();
    expect(m.lang).toBe("id");
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/");
    const sizes = m.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    expect(m.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
    for (const icon of m.icons) {
      expect((await request.get(icon.src)).ok(), icon.src).toBe(true);
    }
  });

  test("service worker tersaji dengan header yang benar", async ({ request }) => {
    const res = await request.get("/sw.js");
    expect(res.ok()).toBe(true);
    expect(res.headers()["service-worker-allowed"]).toBe("/");
    expect(res.headers()["cache-control"]).toContain("no-cache");
  });

  test("header keamanan dasar terpasang", async ({ request }) => {
    const h = (await request.get("/")).headers();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["permissions-policy"]).toContain("camera=(self)");
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("service worker aktif dan halaman offline tersedia tanpa jaringan", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "Diuji di Chromium");
    await page.goto("/");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    // Tunggu SW mengendalikan halaman (clientsClaim) lalu muat ulang agar precache dipakai
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await context.setOffline(true);
    await page.goto("/rute-yang-belum-pernah-dibuka").catch(() => undefined);
    await expect(page.getByRole("heading", { name: "Kamu sedang tidak terhubung internet" })).toBeVisible();
    await context.setOffline(false);
  });
});
