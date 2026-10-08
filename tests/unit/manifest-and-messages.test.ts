import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AssetManifest } from "@/lib/assets/manifest";
import { UNITS } from "@/content/units";
import { PRIMARY_NAV } from "@/lib/nav/routes";
import messages from "@/messages/id.json";

describe("assets/manifest.json", () => {
  const raw = JSON.parse(readFileSync("assets/manifest.json", "utf8"));
  it("lolos skema (setiap aset punya lisensi, sumber, atribusi)", () => {
    expect(() => AssetManifest.parse(raw)).not.toThrow();
  });
  it("id aset unik", () => {
    const ids = AssetManifest.parse(raw).assets.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("messages/id.json", () => {
  function leaves(obj: unknown, prefix = ""): [string, unknown][] {
    if (obj && typeof obj === "object") {
      return Object.entries(obj).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
    }
    return [[prefix, obj]];
  }

  it("tidak ada teks kosong", () => {
    for (const [key, value] of leaves(messages)) {
      expect(typeof value, key).toBe("string");
      expect((value as string).trim(), key).not.toBe("");
    }
  });

  it("setiap unit punya judul dan ringkasan", () => {
    for (const u of UNITS) {
      const unit = (messages.units as Record<string, { title: string; summary: string }>)[u.key];
      expect(unit?.title, u.key).toBeTruthy();
      expect(unit?.summary, u.key).toBeTruthy();
    }
  });

  it("setiap tujuan navigasi punya label", () => {
    for (const item of PRIMARY_NAV) {
      expect((messages.nav as Record<string, string>)[item.key]).toBeTruthy();
    }
  });

  it("tidak memakai kata 'salah' atau 'benar' (PRD §8.6)", () => {
    for (const [key, value] of leaves(messages)) {
      expect(String(value).toLowerCase(), key).not.toMatch(/\b(salah|benar)\b/);
    }
  });

  it("tidak ada klaim kausal (PRD §0.6)", () => {
    for (const [key, value] of leaves(messages)) {
      expect(String(value).toLowerCase(), key).not.toMatch(/terbukti|pasti paham/);
    }
  });
});

describe("tekstur Viewer", () => {
  it("setiap objek punya tekstur WebP dan tercatat di manifest aset", async () => {
    const { existsSync } = await import("node:fs");
    const { CELESTIAL } = await import("@/lib/content/celestial");
    const manifest = AssetManifest.parse(JSON.parse(readFileSync("assets/manifest.json", "utf8")));
    for (const u of Object.values(CELESTIAL.units))
      for (const o of u.objects) {
        if (o.scene) continue; // adegan U3–U6 memakai tekstur benda yang sudah ada (lihat test berikut)
        expect(existsSync(`public/textures/${o.id}.webp`), o.id).toBe(true);
        expect(manifest.assets.some((a) => a.file === `public/textures/${o.id}.webp`), o.id).toBe(true);
      }
  });
  it("tekstur yang dipakai adegan U3–U6 tersedia", async () => {
    const { existsSync } = await import("node:fs");
    const src = readFileSync("components/viewer/Dioramas.tsx", "utf8");
    const ids = new Set([...src.matchAll(/(?:id|useSurface\()["=]\{?"?([a-z]+)"/g)].map((m) => m[1]!));
    const { ZONES } = await import("@/lib/viewer/dioramas");
    for (const p of ZONES.planets) ids.add(p.id);
    expect(ids.size).toBeGreaterThan(5);
    for (const id of ids) expect(existsSync(`public/textures/${id}.webp`), id).toBe(true);
  });
  it("warna skrip tekstur sama dengan token desain", async () => {
    const colors = (await import("../../scripts/planet-colors.mjs")).default as Record<string, string>;
    const { planet } = await import("@/lib/design/tokens");
    expect(colors).toEqual(planet);
  });
});
