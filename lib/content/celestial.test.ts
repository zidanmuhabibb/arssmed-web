import { describe, expect, it } from "vitest";
import { CELESTIAL, unitObjects } from "./celestial";

const id = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 1 });

describe("konten Viewer", () => {
  it("lolos skema; semua sumber dikenal", () => {
    expect(Object.keys(CELESTIAL.units).sort()).toEqual(["u1", "u2", "u3", "u4", "u5", "u6"]);
  });

  it("U2 memuat 8 planet berurutan dari Matahari", () => {
    expect(unitObjects("u2").map((o) => o.id)).toEqual(["merkurius", "venus", "bumi", "mars", "jupiter", "saturnus", "uranus", "neptunus"]);
    const d = unitObjects("u2").map((o) => o.facts.distance_mkm!);
    expect([...d].sort((a, b) => a - b)).toEqual(d);
  });

  it("angka di teks anotasi sama dengan facts (satu sumber kebenaran)", () => {
    for (const o of unitObjects("u2")) {
      const text = o.annotations.map((a) => a.body).join(" ");
      if (o.annotations.some((a) => a.id === "ukuran")) expect(text, o.id).toContain(`${id(o.facts.diameter_km!)} km`);
      if (o.annotations.some((a) => a.id === "suhu")) {
        expect(text, o.id).toContain(`${id(Math.abs(o.facts.mean_temp_c!))} °C`);
        if (o.facts.mean_temp_c! < 0) expect(text, o.id).toContain(`−${id(-o.facts.mean_temp_c!)} °C`);
      }
    }
  });

  it("Venus terpanas meski lebih jauh dari Merkurius (konsepsi alternatif U2)", () => {
    const [me, ve] = unitObjects("u2");
    expect(ve!.facts.mean_temp_c!).toBeGreaterThan(me!.facts.mean_temp_c!);
    expect(ve!.facts.distance_mkm!).toBeGreaterThan(me!.facts.distance_mkm!);
    const temps = unitObjects("u2").map((o) => o.facts.mean_temp_c!);
    expect(Math.max(...temps)).toBe(ve!.facts.mean_temp_c);
  });

  it("Jupiter terbesar; Saturnus lebih kecil meski bercincin", () => {
    const by = Object.fromEntries(unitObjects("u2").map((o) => [o.id, o.facts.diameter_km!]));
    expect(Math.max(...Object.values(by))).toBe(by.jupiter);
    expect(by.saturnus!).toBeLessThan(by.jupiter!);
  });

  it("perbandingan di teks konsisten dengan angka", () => {
    const by = Object.fromEntries([...unitObjects("u1"), ...unitObjects("u2")].map((o) => [`${o.id}`, o.facts.diameter_km]));
    expect(Math.round(by.jupiter! / by.bumi!)).toBe(11);
    expect(by.mars! / by.bumi!).toBeCloseTo(0.5, 0);
    expect(by.bulan! / by.bumi!).toBeLessThan(1 / 3);
    expect(by.pluto!).toBeLessThan(by.bulan!);
    expect(Math.round(by.matahari! / by.bumi!)).toBe(109);
  });

  it("anotasi singkat: maksimal 3 kalimat (PRD §4.2)", () => {
    for (const u of Object.values(CELESTIAL.units))
      for (const o of u.objects)
        for (const a of o.annotations) expect(a.body.split(/(?<=\.)\s+/).length, `${o.id}/${a.id}`).toBeLessThanOrEqual(3);
  });

  it("tanpa kata 'salah' (PRD §8.6)", () => {
    expect(JSON.stringify(CELESTIAL)).not.toMatch(/\bsalah\b/i);
  });
});
