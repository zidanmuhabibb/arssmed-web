import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { NodeIO } from "@gltf-transform/core";
import { describe, expect, it } from "vitest";
import { CELESTIAL } from "@/lib/content/celestial";
import { AssetManifest } from "@/lib/assets/manifest";
import { buildModel } from "./build";
import { chooseArMode, deviceKind, NO_AR_HASH, sceneViewerIntent, type Capabilities } from "./capabilities";
import { alignY, arModelSpec, arModelUrls } from "./spec";
import { usdzEntries } from "./usdz";

const UA = {
  pixel: "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36",
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  ipad: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  windows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  firefoxAndroid: "Mozilla/5.0 (Android 13; Mobile; rv:126.0) Gecko/126.0 Firefox/126.0",
};
const caps = (c: Partial<Capabilities>): Capabilities => ({ device: "desktop", webgl: true, webxrAR: false, quickLook: false, camera: null, firefox: false, oculus: false, ...c });
const all = Object.values(CELESTIAL.units).flatMap((u) => u.objects);

describe("deteksi perangkat (FR-17)", () => {
  it("kategori kasar android/ios/desktop", () => {
    expect(deviceKind({ userAgent: UA.pixel })).toBe("android");
    expect(deviceKind({ userAgent: UA.iphone })).toBe("ios");
    expect(deviceKind({ userAgent: UA.ipad, platform: "MacIntel", maxTouchPoints: 5 })).toBe("ios"); // iPadOS
    expect(deviceKind({ userAgent: UA.ipad, platform: "MacIntel", maxTouchPoints: 0 })).toBe("desktop"); // Mac
    expect(deviceKind({ userAgent: UA.windows })).toBe("desktop");
    expect(deviceKind({ userAgent: "", uaDataPlatform: "Android" })).toBe("android");
    expect(deviceKind({ userAgent: "Bot/1.0" })).toBe("other");
  });
});

describe("pilihan mode AR (FR-14)", () => {
  it("iPhone → Quick Look bila didukung; Android → Scene Viewer; laptop → tidak ada", () => {
    expect(chooseArMode(caps({ device: "ios", quickLook: true }))).toEqual({ mode: "quick-look", reason: null });
    expect(chooseArMode(caps({ device: "ios", quickLook: false }))).toEqual({ mode: "none", reason: "browser" });
    expect(chooseArMode(caps({ device: "android" }))).toEqual({ mode: "scene-viewer", reason: null });
    expect(chooseArMode(caps({ device: "android", firefox: true }))).toEqual({ mode: "none", reason: "browser" });
    expect(chooseArMode(caps({ device: "desktop" }))).toEqual({ mode: "none", reason: "desktop" });
    expect(chooseArMode(caps({ device: "android" }), true)).toEqual({ mode: "none", reason: "failed" });
  });
  it("intent Scene Viewer: berkas absolut ter-encode, cadangan kembali ke halaman dengan penanda", () => {
    const i = sceneViewerIntent("https://arssmed.id/models/bumi.glb", "https://arssmed.id/belajar/u1/viewer", "Bumi");
    expect(i.startsWith("intent://arvr.google.com/scene-viewer/1.2?mode=ar_preferred")).toBe(true);
    expect(i).toContain(`file=${encodeURIComponent("https://arssmed.id/models/bumi.glb")}`);
    expect(i).toContain("title=Bumi");
    expect(i).toContain("package=com.google.android.googlequicksearchbox");
    expect(i).toContain(`S.browser_fallback_url=${encodeURIComponent(`https://arssmed.id/belajar/u1/viewer${NO_AR_HASH}`)}`);
    expect(i.endsWith(";end;")).toBe(true);
  });
});

describe("spesifikasi model AR", () => {
  it("setiap objek Rel Orbit punya model; ukuran muat di atas meja (≤ 1 m)", () => {
    for (const o of all) {
      const s = arModelSpec(o);
      expect(s.parts.length, o.id).toBeGreaterThan(0);
      for (const p of s.parts) for (const v of p.position) expect(Math.abs(v), `${o.id}/${p.name}`).toBeLessThan(0.5);
    }
  });
  it("alignY memutar sumbu +Y ke arah yang diminta", () => {
    const rot = (r: [number, number, number]) => {
      const [rx, , rz] = r.map((d) => (d * Math.PI) / 180) as [number, number, number];
      return [-Math.sin(rz), Math.cos(rz) * Math.cos(rx), Math.cos(rz) * Math.sin(rx)];
    };
    for (const d of [[0, 1, 0], [-0.4, 0.9, 0], [0.3, 0.8, 0.5]] as [number, number, number][]) {
      const l = Math.hypot(...d);
      rot(alignY(d)).forEach((x, i) => expect(x).toBeCloseTo(d[i]! / l, 6));
    }
  });
});

describe("berkas AR terbangun (pnpm assets:build)", () => {
  const manifest = AssetManifest.parse(JSON.parse(readFileSync("assets/manifest.json", "utf8")));
  it("GLB dan USDZ ada untuk setiap objek, tercatat di manifest, ≤ 1,5 MB; total per unit ≤ 15 MB (PRD §12.1)", () => {
    for (const [slug, u] of Object.entries(CELESTIAL.units)) {
      let total = 0;
      for (const o of u.objects) {
        const { glb, usdz } = arModelUrls(o);
        for (const f of [glb, usdz]) {
          const path = `public${f}`;
          expect(existsSync(path), path).toBe(true);
          const size = statSync(path).size;
          expect(size, path).toBeLessThanOrEqual(1.5 * 1024 * 1024);
          total += size;
          expect(manifest.assets.some((a) => a.file === path && a.kind === "model"), path).toBe(true);
        }
      }
      expect(total, slug).toBeLessThanOrEqual(15 * 1024 * 1024);
    }
  });

  it("USDZ: model.usda pertama, tanpa kompresi, data sejajar 64 byte, tekstur JPEG", () => {
    for (const o of all) {
      const entries = usdzEntries(new Uint8Array(readFileSync(`public${arModelUrls(o).usdz}`)));
      expect(entries[0]!.name).toBe("model.usda");
      for (const e of entries) {
        expect(e.method, e.name).toBe(0);
        expect(e.dataOffset % 64, `${o.id}:${e.name}`).toBe(0);
        if (e.name !== "model.usda") expect(e.name).toMatch(/^textures\/[a-z]+\.jpg$/);
      }
    }
  });

  it("GLB terbaca dan berisi jaring + material", async () => {
    const io = new NodeIO();
    for (const o of all.slice(0, 4)) {
      const doc = await io.readBinary(new Uint8Array(readFileSync(`public${arModelUrls(o).glb}`)));
      expect(doc.getRoot().listMeshes().length, o.id).toBeGreaterThan(0);
      expect(doc.getRoot().listMaterials().length, o.id).toBeGreaterThan(0);
    }
  });

  it("berkas di repo sama dengan hasil bangun ulang (jalankan `pnpm assets:build` bila gagal)", async () => {
    const sharp = createRequire(import.meta.url)("sharp") as (p: string) => { resize(w: number, h: number, o: object): { jpeg(o: object): { toBuffer(): Promise<Buffer> } } };
    const asteroid = all.find((o) => o.id === "asteroid")!;
    const built = await buildModel(arModelSpec(asteroid), async (id) =>
      new Uint8Array(await sharp(`public/textures/${id}.webp`).resize(512, 256, { fit: "fill" }).jpeg({ quality: 82, mozjpeg: true }).toBuffer()),
    );
    expect(Buffer.from(built.glb).equals(readFileSync("public/models/asteroid.glb"))).toBe(true);
    expect(Buffer.from(built.usdz).equals(readFileSync("public/models/asteroid.usdz"))).toBe(true);
  });
});
